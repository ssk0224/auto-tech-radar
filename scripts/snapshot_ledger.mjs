// Radar Ledger の日次スナップショット（UTC 日付ごとに 1 回）。
// (a) 記事生成と同じ GitHub 検索クエリ（scripts/utils/github_queries.mjs）が返す全候補（検索結果の値だけ、リリースは null）
// (b) 掲載済みの全リポジトリ（src/pages/radar/*.md の repoUrl。リポジトリ情報＋最新リリース）
// を data/ledger/YYYY/MM/DD.jsonl に書き、data/derived/velocity.json（スター推移）を作り直す。
// - その日のファイルが既にあれば API を呼ばない（1 日 1 回）
// - 403 / 429（レート制限）や通信失敗では、そこまでの分を .partial に書いて止める（完了扱いにせず次の実行で取り直す）
// - 失敗しても終了コードは 0（GitHub API の一時的な不調でデプロイを止めない）
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import "dotenv/config";
import { trendingSearchQueries, searchReposUrl } from "./utils/github_queries.mjs";
import { utcDate, addDays, ledgerPaths, toLedgerRow, toJsonl, parseJsonl, repoFullNameFromUrl, readLedger, computeVelocity } from "./utils/ledger.mjs";

const DEFAULT_DELAY_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 403 / 429 がレート制限によるものか。403 は利用規約違反などでアクセスが止められたリポジトリ（"Repository access blocked"）でも返るため、
// それをレート制限と取り違えて毎日そこで止まり、以降のリポジトリが記録されなくならないよう、ヘッダーと本文で見分ける
export function isRateLimited(status, headers, body = "") {
  if (status === 429) return true;
  if (status !== 403) return false;
  return headers?.get?.("x-ratelimit-remaining") === "0" || !!headers?.get?.("retry-after") || /rate limit/i.test(body);
}

function githubHeaders(token) {
  const headers = { "User-Agent": "Auto-Tech-Radar/2.0", "Accept": "application/vnd.github+json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// 掲載済みリポジトリの full_name（記事 frontmatter の repoUrl から）。重複は除く
export function featuredRepos(radarDir) {
  if (!fs.existsSync(radarDir)) return [];
  const seen = new Map();
  for (const f of fs.readdirSync(radarDir).filter((x) => x.endsWith(".md")).sort()) {
    const fm = fs.readFileSync(path.join(radarDir, f), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const m = fm && fm[1].match(/^repoUrl:\s*["']?([^"'\s]+)["']?\s*$/m);
    const name = m && repoFullNameFromUrl(m[1]);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()];
}

export async function snapshotLedger({
  rootDir = process.cwd(),
  now = Date.now(),
  fetchImpl = globalThis.fetch,
  token = process.env.GITHUB_TOKEN || process.env.GH_PAT,
  delayMs = DEFAULT_DELAY_MS,
} = {}) {
  const date = utcDate(now);
  const { file, partial } = ledgerPaths(rootDir, date);
  if (fs.existsSync(file)) {
    console.log(`ledger: ${date}（UTC）のスナップショットは記録済みです（${path.relative(rootDir, file)}）。API は呼びません。`);
    return { status: "skipped", date, rows: 0 };
  }

  let calls = 0;
  // 戻り値: { ok, status, data } / レート制限は { stop: "rate_limit" }、通信失敗は { stop: "network" }
  const getJson = async (url) => {
    if (calls++ > 0 && delayMs > 0) await sleep(delayMs);
    try {
      const res = await fetchImpl(url, { headers: githubHeaders(token), signal: AbortSignal.timeout(15000) });
      if (res.status === 403 || res.status === 429) {
        const body = await res.text().catch(() => "");
        if (isRateLimited(res.status, res.headers, body)) {
          console.warn(`ledger: GitHub API のレート制限（HTTP ${res.status}, remaining: ${res.headers?.get?.("x-ratelimit-remaining")}）。ここで止めます。`);
          return { stop: "rate_limit" };
        }
        return { ok: false, status: res.status, message: body.slice(0, 120) };
      }
      if (!res.ok) return { ok: false, status: res.status };
      return { ok: true, status: res.status, data: await res.json() };
    } catch (e) {
      console.warn(`ledger: 通信に失敗しました（${url}）: ${e.message}`);
      return { stop: "network" };
    }
  };

  const rows = new Map(); // key: full_name（小文字）
  let stopped = null;
  let incomplete = false;

  // (a) 検索候補（検索結果の値だけを使う。リリースは取らない）
  for (const q of trendingSearchQueries(now)) {
    const r = await getJson(searchReposUrl(q));
    if (r.stop) { stopped = r.stop; break; }
    if (!r.ok) { console.warn(`ledger: 検索に失敗しました (HTTP ${r.status}): ${q}`); incomplete = true; continue; }
    // GitHub が時間内に探しきれなかった検索結果（incomplete_results: true）は、候補が欠けているので完了にしない
    if (r.data?.incomplete_results === true) { console.warn(`ledger: 検索結果が途中まで（incomplete_results）です: ${q}`); incomplete = true; }
    for (const item of r.data?.items || []) {
      if (item?.full_name && !rows.has(item.full_name.toLowerCase())) rows.set(item.full_name.toLowerCase(), toLedgerRow(date, item, null));
    }
  }

  // (b) 掲載済みリポジトリ（検索結果に無ければリポジトリ情報を取り、全件で最新リリースを取る）
  if (!stopped) {
    for (const name of featuredRepos(path.join(rootDir, "src", "pages", "radar"))) {
      let row = rows.get(name.toLowerCase());
      if (!row) {
        const r = await getJson(`https://api.github.com/repos/${name}`);
        if (r.stop) { stopped = r.stop; break; }
        // 404（削除・非公開化）・451（DMCA）・403（利用規約違反などでアクセス停止）は、この日は記録しない（取り直しても取れない）
        if ([403, 404, 451].includes(r.status)) { console.warn(`ledger: ${name} を取得できません（HTTP ${r.status}: 削除・非公開化・アクセス停止の可能性）。この日は記録しません。`); continue; }
        if (!r.ok) { console.warn(`ledger: ${name} の取得に失敗しました (HTTP ${r.status})`); incomplete = true; continue; }
        row = toLedgerRow(date, r.data, null);
      }
      const rel = await getJson(`https://api.github.com/repos/${row.full_name}/releases/latest`);
      if (rel.stop) { stopped = rel.stop; break; }
      if (rel.ok) {
        row.latest_release_tag = rel.data?.tag_name ?? null;
        row.latest_release_at = rel.data?.published_at ?? null;
      } else if (rel.status !== 404) { // 404 はリリースが無いだけ
        console.warn(`ledger: ${row.full_name} のリリース取得に失敗しました (HTTP ${rel.status})`);
        incomplete = true;
      }
      rows.set(row.full_name.toLowerCase(), row);
    }
  }

  const sorted = [...rows.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (stopped || incomplete) {
    // 同じ日の前回の .partial にあって今回取れなかった行は残す（今回の値を優先）
    if (fs.existsSync(partial)) {
      for (const old of parseJsonl(fs.readFileSync(partial, "utf8"))) {
        if (old?.full_name && !rows.has(old.full_name.toLowerCase())) sorted.push(old);
      }
      sorted.sort((a, b) => a.full_name.localeCompare(b.full_name));
    }
    if (sorted.length > 0) fs.writeFileSync(partial, toJsonl(sorted), "utf8");
    console.warn(`ledger: ${date} は途中までです（${stopped || "一部失敗"}、${sorted.length} 件）。${sorted.length ? path.relative(rootDir, partial) + " に書き、" : ""}次の実行で取り直します。`);
    return { status: "partial", date, rows: sorted.length, reason: stopped || "incomplete", calls };
  }
  fs.writeFileSync(file, toJsonl(sorted), "utf8");
  fs.rmSync(partial, { force: true });
  console.log(`ledger: ${date}（UTC）のスナップショットを記録しました（${sorted.length} 件、API ${calls} 回）: ${path.relative(rootDir, file)}`);
  return { status: "complete", date, rows: sorted.length, calls };
}

// 台帳全体から data/derived/velocity.json を作り直す（生成時刻は書かない＝台帳が同じなら同じ内容）
export function updateVelocity(rootDir = process.cwd()) {
  const velocity = computeVelocity(readLedger(rootDir));
  const out = path.join(rootDir, "data", "derived", "velocity.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(velocity, null, 2) + "\n", "utf8");
  console.log(`ledger: ${path.relative(rootDir, out)} を更新しました（${Object.keys(velocity.repos).length} リポジトリ、as_of ${velocity.as_of}）`);
  return velocity;
}

// 完了していない日（.partial だけで、その日のファイルが無い）が date から遡って何日続いているか
export function consecutivePartialDays(rootDir, date) {
  let n = 0;
  for (let day = date; ; day = addDays(day, -1)) {
    const { file, partial } = ledgerPaths(rootDir, day);
    if (fs.existsSync(file) || !fs.existsSync(partial)) return n;
    n++;
  }
}

// 完了していない日がこの日数続いたら ::error（レート制限・障害が一時的でなく、台帳が欠け続けている）
export const PARTIAL_ALERT_DAYS = 3;
// スナップショットの結果を GitHub Actions に出す行。途中までの日は ::warning、続いたら ::error（終了コードはデプロイを止めないよう 0 のまま）
export function ledgerAnnotations(result, consecutive) {
  if (result?.status !== "partial") return [];
  const lines = [`::warning title=Ledger snapshot partial::${result.date}（UTC）の台帳は途中まで（${result.reason}、${result.rows} 件）。次の実行で取り直します`];
  if (consecutive >= PARTIAL_ALERT_DAYS) lines.push(`::error title=Ledger snapshot incomplete::台帳の完了していない日が ${consecutive} 日続いています（最新 ${result.date}、${result.reason}）。GitHub API の制限・トークンを確認してください`);
  return lines;
}

async function main() {
  try {
    const r = await snapshotLedger();
    for (const l of ledgerAnnotations(r, r.status === "partial" ? consecutivePartialDays(process.cwd(), r.date) : 0)) console.log(l);
  } catch (e) {
    console.log(`::warning title=Ledger snapshot failed::${e.message}`);
  }
  try {
    updateVelocity();
  } catch (e) {
    console.log(`::warning title=Velocity update failed::${e.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  // ネットワークの不調でデプロイを止めないよう、常に終了コード 0
  main().finally(() => process.exit(0));
}
