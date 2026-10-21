// Radar Ledger: リポジトリの公開指標を日ごとに記録した台帳（data/ledger/YYYY/MM/DD.jsonl、UTC 日付）と、
// そこから計算するスター推移（data/derived/velocity.json）。過去の日の値は後から取り直せないので、毎日 1 回記録する。
// 記録するのはリポジトリ単位の公開値だけ（スターを付けた人・コントリビューターなど個人単位のデータは持たない）
import fs from "fs";
import path from "path";

// 1 行（1 リポジトリ）の項目。この順・この集合だけを書く
export const LEDGER_FIELDS = [
  "date", "full_name", "stars", "forks", "open_issues", "pushed_at", "created_at",
  "archived", "license", "latest_release_tag", "latest_release_at",
];

export function utcDate(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  const t = Date.parse(`${date}T00:00:00Z`) + n * 24 * 60 * 60 * 1000;
  return new Date(t).toISOString().slice(0, 10);
}

export function ledgerPaths(rootDir, date) {
  const [y, m, d] = date.split("-");
  const file = path.join(rootDir, "data", "ledger", y, m, `${d}.jsonl`);
  // レート制限などで途中までしか取れなかった日は .partial に書き、次の実行で取り直す（完了扱いにしない）
  return { file, partial: `${file}.partial` };
}

// GitHub API のリポジトリ情報（検索結果の item または GET /repos/{owner}/{repo}）から 1 行を作る
export function toLedgerRow(date, repo, release = null) {
  return {
    date,
    full_name: String(repo.full_name),
    stars: Number(repo.stargazers_count ?? 0),
    forks: Number(repo.forks_count ?? repo.forks ?? 0),
    open_issues: Number(repo.open_issues_count ?? repo.open_issues ?? 0),
    pushed_at: repo.pushed_at ?? null,
    created_at: repo.created_at ?? null,
    archived: !!repo.archived,
    license: repo.license?.spdx_id ?? null,
    latest_release_tag: release?.tag_name ?? null,
    latest_release_at: release?.published_at ?? null,
  };
}

// https://github.com/owner/repo(.git)(/...) → "owner/repo"。GitHub 以外・形式不正は null
export function repoFullNameFromUrl(url) {
  const m = String(url || "").trim().match(/^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/?#].*)?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function toJsonl(rows) {
  return rows.map((r) => JSON.stringify(Object.fromEntries(LEDGER_FIELDS.map((k) => [k, r[k] ?? null])))).join("\n") + (rows.length ? "\n" : "");
}

export function parseJsonl(text) {
  return String(text || "").split(/\r?\n/).filter((l) => l.trim()).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
}

// 台帳の全行を読む。同じ日に完了ファイルがあれば .partial は使わない
export function readLedger(rootDir) {
  const base = path.join(rootDir, "data", "ledger");
  if (!fs.existsSync(base)) return [];
  const rows = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".jsonl")) rows.push(...parseJsonl(fs.readFileSync(p, "utf8")));
      else if (e.name.endsWith(".jsonl.partial") && !fs.existsSync(p.replace(/\.partial$/, ""))) rows.push(...parseJsonl(fs.readFileSync(p, "utf8")));
    }
  };
  walk(base);
  return rows;
}

// 増加数の比較相手を探すとき、ちょうど N 日前の記録が無ければ何日前まで遡ってよいか
const GAIN_TOLERANCE_DAYS = { 1: 0, 7: 1, 30: 3 };

// 台帳の行からスター推移を計算する（純粋関数）。
// - stars_now / last_seen: そのリポジトリの最新の記録
// - first_seen: 最初に記録された日、days_on_radar: 記録された日数（重複しない日付の数）
// - gain_Nd: last_seen の N 日前（記録が無ければ少しだけ遡る）からのスター増加数。履歴が足りなければ null
export function computeVelocity(rows) {
  const byRepo = new Map();
  for (const r of rows) {
    if (!r || !r.full_name || !/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) || !Number.isFinite(Number(r.stars))) continue;
    const key = r.full_name;
    if (!byRepo.has(key)) byRepo.set(key, new Map());
    byRepo.get(key).set(r.date, Number(r.stars)); // 同じ日に複数あれば後の行を使う
  }
  const repos = {};
  let asOf = null;
  for (const name of [...byRepo.keys()].sort((a, b) => a.localeCompare(b))) {
    const hist = byRepo.get(name);
    const dates = [...hist.keys()].sort();
    const last = dates.at(-1);
    const starsNow = hist.get(last);
    const gain = (n) => {
      const target = addDays(last, -n);
      const earliest = addDays(target, -(GAIN_TOLERANCE_DAYS[n] ?? 0));
      const ref = dates.filter((d) => d <= target && d >= earliest).at(-1);
      return ref === undefined ? null : starsNow - hist.get(ref);
    };
    repos[name] = {
      stars_now: starsNow,
      last_seen: last,
      first_seen: dates[0],
      days_on_radar: dates.length,
      gain_1d: gain(1),
      gain_7d: gain(7),
      gain_30d: gain(30),
    };
    if (!asOf || last > asOf) asOf = last;
  }
  return { as_of: asOf, repos };
}

// full_name の大文字小文字の違い（記事の repoUrl と API の表記）を吸収して引く
export function velocityFor(velocity, fullName) {
  if (!velocity?.repos || !fullName) return null;
  if (velocity.repos[fullName]) return velocity.repos[fullName];
  const lower = String(fullName).toLowerCase();
  const key = Object.keys(velocity.repos).find((k) => k.toLowerCase() === lower);
  return key ? velocity.repos[key] : null;
}
