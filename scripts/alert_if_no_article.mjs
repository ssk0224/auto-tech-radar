// 日本時間の今日の記事（pubDate が今日）が 1 本も無ければ、このリポジトリの Issue でアラートを出す。
// GitHub Actions の第3便（12:17 JST）のデプロイ後に実行する（.github/workflows/daily-crawl.yml）。
// - 判定は記事ファイルの有無で行う（生成後に品質ゲートで取り除かれた記事は「無い」として扱う）。
//   CI では作業ツリーではなく push 済みの origin/main を見る（生成したが commit・push に失敗した記事を「ある」と数えない）。
//   理由は data/run_status/YYYY-MM-DD.json（scripts/utils/run_status.mjs）の記録を載せる
// - ラベル pipeline-alert の open な Issue があればそこにコメントし、無ければ 1 件だけ作る
// - 呼び出すのは GITHUB_REPOSITORY（このリポジトリ）の API だけ。GITHUB_TOKEN / GITHUB_REPOSITORY が無い（ローカル実行）ときは何もしない
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { spawnSync } from "child_process";
import { jstDate, readRunStatus } from "./utils/run_status.mjs";

export const ALERT_LABEL = "pipeline-alert";
export const ALERT_TITLE = "パイプライン停止アラート";

const RADAR = "src/pages/radar";
const publishedOn = (date) => {
  const re = new RegExp(`^pubDate:\\s*["']?${date}["']?\\s*$`, "m");
  return (content) => {
    const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return !!fm && re.test(fm[1]);
  };
};

// pubDate が date（YYYY-MM-DD）の記事のスラッグ一覧（作業ツリー）
export function articlesPublishedOn(radarDir, date) {
  if (!fs.existsSync(radarDir)) return [];
  const isOn = publishedOn(date);
  return fs.readdirSync(radarDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => isOn(fs.readFileSync(path.join(radarDir, f), "utf8")))
    .map((f) => f.replace(/\.md$/, ""));
}

// git の ref（push 済みの origin/main など）にある記事のうち、pubDate が date のもののスラッグ一覧。読めなければ例外
export function articlesPublishedOnRef(rootDir, ref, date) {
  const git = (...args) => {
    const r = spawnSync("git", args, { cwd: rootDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || "").trim()}`);
    return r.stdout;
  };
  const isOn = publishedOn(date);
  return git("ls-tree", "--name-only", `${ref}:${RADAR}`).split("\n")
    .filter((f) => f.endsWith(".md"))
    .filter((f) => isOn(git("show", `${ref}:${RADAR}/${f}`)))
    .map((f) => f.replace(/\.md$/, ""));
}

// ref を渡すと、その ref（push 済みの内容）で判定する。省くと作業ツリーで判定する
export function decideAlert({ rootDir = process.cwd(), now = Date.now(), ref = null } = {}) {
  const date = jstDate(now);
  const slugs = ref ? articlesPublishedOnRef(rootDir, ref, date) : articlesPublishedOn(path.join(rootDir, ...RADAR.split("/")), date);
  const status = readRunStatus(rootDir, date);
  const runs = Array.isArray(status?.runs) ? status.runs : [];
  return { date, alert: slugs.length === 0, slugs, runs };
}

export function alertBody({ date, runs }, { runUrl = "" } = {}) {
  const lines = [
    `### ${date}（日本時間）: 本日公開の記事がありません`,
    "",
    `pubDate が ${date} の記事が src/pages/radar/ にありません（第3便 12:17 JST の時点）。`,
    "",
    `#### この日の実行記録（data/run_status/${date}.json）`,
  ];
  if (runs.length === 0) {
    lines.push("- 実行記録がありません（記事生成のステップが起動していない・記録前に失敗した可能性があります）");
  } else {
    for (const r of runs) {
      lines.push(`- ${r.at} / ${r.event}: generated ${r.generated}, reason \`${r.reason}\`, model ${r.model ? `\`${r.model}\`` : "-"}`);
    }
  }
  if (runUrl) lines.push("", `この確認を行った実行: ${runUrl}`);
  return lines.join("\n");
}

// open なアラート Issue にコメントし、無ければ作る。戻り値は { action: "commented" | "created", number }
export async function sendAlert({ repo, token, body, fetchImpl = globalThis.fetch }) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo || "")) throw new Error(`GITHUB_REPOSITORY の形式が不正です: ${repo}`);
  const api = `https://api.github.com/repos/${repo}`;
  const headers = {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Auto-Tech-Radar/2.0",
  };
  const call = async (method, url, payload) => {
    const res = await fetchImpl(url, {
      method,
      headers: payload ? { ...headers, "Content-Type": "application/json" } : headers,
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    return res;
  };

  const listRes = await call("GET", `${api}/issues?state=open&labels=${encodeURIComponent(ALERT_LABEL)}&per_page=30`);
  if (!listRes.ok) throw new Error(`Issue 一覧の取得に失敗しました (HTTP ${listRes.status})`);
  const open = (await listRes.json()).filter((i) => !i.pull_request);
  if (open.length > 0) {
    const number = open[0].number;
    const res = await call("POST", `${api}/issues/${number}/comments`, { body });
    if (!res.ok) throw new Error(`Issue #${number} へのコメントに失敗しました (HTTP ${res.status})`);
    return { action: "commented", number };
  }

  // ラベルが無いと Issue に付けられないことがあるため先に作る（既にあれば 422 で、そのまま続ける）
  const labelRes = await call("POST", `${api}/labels`, { name: ALERT_LABEL, color: "d73a4a", description: "記事生成パイプラインの停止アラート（自動）" });
  if (!labelRes.ok && labelRes.status !== 422) console.warn(`ラベル ${ALERT_LABEL} を作成できませんでした (HTTP ${labelRes.status})`);
  const res = await call("POST", `${api}/issues`, { title: ALERT_TITLE, body, labels: [ALERT_LABEL] });
  if (!res.ok) throw new Error(`Issue の作成に失敗しました (HTTP ${res.status})`);
  const created = await res.json();
  return { action: "created", number: created.number };
}

// CI では最新の origin/main を取り込み、push 済みの記事で判定する（取り込めなければ作業ツリーで判定し、警告を出す）
function decideInCi() {
  if (!process.env.GITHUB_ACTIONS) return decideAlert();
  spawnSync("git", ["fetch", "--quiet", "origin", "main"], { encoding: "utf8" });
  try {
    return decideAlert({ ref: "origin/main" });
  } catch (e) {
    console.log(`::warning title=No article check::push 済みの記事（origin/main）を読めないため、作業ツリーで判定します: ${e.message}`);
    return decideAlert();
  }
}

async function main() {
  const decision = decideInCi();
  if (!decision.alert) {
    console.log(`✓ ${decision.date}（JST）の記事があります（${decision.slugs.join(", ")}）。アラートは不要です。`);
    return;
  }
  console.log(`::warning title=No article today::${decision.date}（JST）の記事がありません。理由: ${decision.runs.map((r) => r.reason).join(", ") || "実行記録なし"}`);
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log("GITHUB_TOKEN / GITHUB_REPOSITORY が無いため Issue は作成しません（ローカル実行）。");
    return;
  }
  const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${repo}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
  const result = await sendAlert({ repo, token, body: alertBody(decision, { runUrl }) });
  console.log(`アラートを送りました: Issue #${result.number}（${result.action === "created" ? "新規作成" : "コメント追加"}）`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(`::error title=Pipeline alert failed::アラートの送信に失敗しました: ${err.message}`);
    process.exit(1);
  });
}
