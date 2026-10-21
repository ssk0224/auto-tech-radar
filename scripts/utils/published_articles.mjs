// 「その日の記事」の判定（記事の frontmatter の pubDate）と、push 済みの記事（origin/main）の読み取り。
// 生成スクリプトの 1 日の上限（scripts/crawl_and_generate.mjs）と、記事が無い日のアラート（scripts/alert_if_no_article.mjs）は
// 同じ判定を使う（片方だけ数え方が変わると、上限を超えて生成したり、記事がある日にアラートを出したりする）
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

export const RADAR_DIR = "src/pages/radar";

// 記事の本文（frontmatter を含む）の pubDate が date（YYYY-MM-DD）か
export function isPublishedOn(content, date) {
  const fm = String(content || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return !!fm && new RegExp(`^pubDate:\\s*["']?${date}["']?\\s*$`, "m").test(fm[1]);
}

// pubDate が date の記事のスラッグ一覧（作業ツリー）
export function articlesPublishedOn(radarDir, date) {
  if (!fs.existsSync(radarDir)) return [];
  return fs.readdirSync(radarDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => isPublishedOn(fs.readFileSync(path.join(radarDir, f), "utf8"), date))
    .map((f) => f.replace(/\.md$/, ""));
}

const git = (rootDir, args, opts = {}) => {
  const r = spawnSync("git", args, { cwd: rootDir, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, ...opts });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.error?.message || "").trim()}`);
  return r.stdout;
};

// git の ref（push 済みの origin/main など）にある記事 [{ slug, content }]。読めなければ例外
export function radarArticlesOnRef(rootDir, ref) {
  return git(rootDir, ["ls-tree", "--name-only", `${ref}:${RADAR_DIR}`]).split("\n")
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), content: git(rootDir, ["show", `${ref}:${RADAR_DIR}/${f}`]) }));
}

// git の ref にある記事のうち、pubDate が date のもののスラッグ一覧。読めなければ例外
export function articlesPublishedOnRef(rootDir, ref, date) {
  return radarArticlesOnRef(rootDir, ref).filter((a) => isPublishedOn(a.content, date)).map((a) => a.slug);
}

// 最新の origin/main を取り込む（認証の入力待ちで止まらないよう、入力を求めず時間の上限つき）。失敗したら例外
export function fetchOriginMain(rootDir, timeoutMs = 30000) {
  git(rootDir, ["fetch", "--quiet", "origin", "main"], { timeout: timeoutMs });
}
