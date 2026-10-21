// 記事にするリポジトリの選定（scripts/utils/selection.mjs）と、選定基準ページ・取り下げ・公開日の確認
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  rankCandidates,
  normalizeVelocity,
  watchlistDocument,
  pubDateProblem,
  findClusterOwners,
  SELECTION_CONFIG,
  REJECTION_REASONS,
} from "../scripts/utils/selection.mjs";
import { REMOVED_SLUGS, BLOCKED_SLUGS } from "../scripts/utils/blocklist.mjs";

const NOW = Date.parse("2026-10-21T00:00:00Z");
let seq = 0;
// GitHub 検索 API の items と同じ形
function repo(full_name, { stars = 2000, created = "2026-06-01T00:00:00Z", language = "Rust", description = "A fast command line tool for developers", topics = [], archived = false } = {}) {
  seq++;
  const name = full_name.split("/")[1];
  return { id: seq, name, full_name, html_url: `https://github.com/${full_name}`, stargazers_count: stars, created_at: created, language, description, topics, archived, fork: false };
}
const reasonOf = (res, full) => res.rejected.find((r) => r.full_name === full)?.reason;
const rankedNames = (res) => res.ranked.map((r) => r.full_name);

test("短期間に同一オーナーの高スター新規リポジトリが集中している場合は caution: cluster で見送る（評価の言葉は付けない）", () => {
  const cands = [
    repo("craftco/photo", { stars: 70000, created: "2026-09-30T13:37:48Z" }),
    repo("craftco/pdf", { stars: 16000, created: "2026-09-30T13:39:37Z" }),
    repo("craftco/film", { stars: 15000, created: "2026-09-30T13:41:20Z" }),
    repo("craftco/word", { stars: 15000, created: "2026-10-07T08:34:24Z" }),
    repo("solo/tool", { stars: 3000, created: "2026-09-01T00:00:00Z" }),
  ];
  const res = rankCandidates(cands, { now: NOW });
  assert.deepEqual(rankedNames(res), ["solo/tool"]);
  for (const n of ["craftco/photo", "craftco/pdf", "craftco/film", "craftco/word"]) {
    const r = res.rejected.find((x) => x.full_name === n);
    assert.equal(r.reason, "cluster");
    assert.equal(r.caution, "cluster");
  }
  assert.deepEqual(res.clusterOwners, ["craftco"]);
  assert.doesNotMatch(JSON.stringify(res.rejected) + REJECTION_REASONS.cluster + SELECTION_CONFIG.cluster.notice, /fake|偽|不正|水増し|購入/i);
});

test("集中の判定は掲載済み記事（作成日つき）も数え、窓の外・スターが少ないものは数えない", () => {
  const featured = [
    { full_name: "craftco/a", pubDate: "2026-09-01", stars: 5000, created_at: "2026-08-20" },
    { full_name: "craftco/b", pubDate: "2026-09-02", stars: 4000, created_at: "2026-08-25" },
  ];
  const res = rankCandidates([repo("craftco/c", { stars: 3000, created: "2026-08-30T00:00:00Z" })], { featured, now: NOW });
  assert.equal(reasonOf(res, "craftco/c"), "cluster");
  // 14 日を超えて離れている・スター 1000 以下は数えない
  assert.equal(findClusterOwners([
    { full_name: "x/a", created_at: "2026-08-01", stars: 5000 },
    { full_name: "x/b", created_at: "2026-08-20", stars: 5000 },
    { full_name: "x/c", created_at: "2026-09-10", stars: 5000 },
    { full_name: "y/a", created_at: "2026-10-01", stars: 5000 },
    { full_name: "y/b", created_at: "2026-10-02", stars: 900 },
    { full_name: "y/c", created_at: "2026-10-03", stars: 1000 },
  ]).size, 0);
});

test("書籍・リンク集（言語なし・文書のみで説明が書籍・一覧）は除外し、コードのあるリポジトリは除外しない", () => {
  const res = rankCandidates([
    repo("someone/handbook", { language: null, description: "The complete handbook of system design" }),
    repo("cdy/life-book", { language: "HTML", description: "《高性价比人生指南》全书 528 条的在线单页阅读版" }),
    repo("dev/guide-cli", { language: "Rust", description: "A CLI guide generator for your codebase" }),
    repo("cfg/no-lang-tool", { language: null, description: "Configuration snippets for terminal emulators" }),
  ], { now: NOW });
  assert.equal(reasonOf(res, "someone/handbook"), "doc_only");
  assert.equal(reasonOf(res, "cdy/life-book"), "doc_only");
  assert.ok(rankedNames(res).includes("dev/guide-cli"));
  assert.ok(rankedNames(res).includes("cfg/no-lang-tool"));
});

test("アーカイブ済み・ノイズ・ブロックリスト・有料モデルの無料無制限をうたう説明は除外する", () => {
  const res = rankCandidates([
    repo("old/tool", { archived: true }),
    repo("rust-lang/crates.io-index", { description: "Registry index for crates.io" }),
    repo("cdyforever/how-to-live-better", { language: "Rust" }),
    repo("someone/awesome-agents", { description: "A list of agent frameworks and tools" }),
    repo("vinyl/free-model", { language: "JavaScript", description: "No login, no API key — the frontier models are just there, DeepSeek and Kimi among them. Completely free, with no usage cap." }),
    repo("jp/free-gpt", { language: "Python", description: "GPT-5 と Claude を無料で無制限に使えるツール" }),
    repo("ok/free-tool", { language: "Go", description: "A free and open source unlimited history shell" }),
  ], { now: NOW });
  assert.equal(reasonOf(res, "old/tool"), "archived");
  assert.equal(reasonOf(res, "rust-lang/crates.io-index"), "blocklist");
  assert.equal(reasonOf(res, "cdyforever/how-to-live-better"), "blocklist");
  assert.equal(reasonOf(res, "someone/awesome-agents"), "noise_filter");
  assert.equal(reasonOf(res, "vinyl/free-model"), "free_paid_model");
  assert.equal(reasonOf(res, "jp/free-gpt"), "free_paid_model");
  // 有料モデルに触れていない「free / unlimited」は対象外
  assert.deepEqual(rankedNames(res), ["ok/free-tool"]);
});

test("同じオーナーは 30 日間に 1 本まで（掲載済み・同じ実行内の両方）", () => {
  const featured = [
    { full_name: "acme/old", pubDate: "2026-10-10" },
    { full_name: "past/old", pubDate: "2026-09-01" },
  ];
  const res = rankCandidates([
    repo("acme/new"),
    repo("past/new"),
    repo("beta/big", { stars: 9000 }),
    repo("beta/small", { stars: 3000 }),
  ], { featured, now: NOW });
  assert.equal(reasonOf(res, "acme/new"), "owner_cap");
  assert.ok(rankedNames(res).includes("past/new"), "30 日より前の掲載は上限に数えない");
  assert.ok(rankedNames(res).includes("beta/big"));
  assert.equal(reasonOf(res, "beta/small"), "owner_cap");
});

test("7日間の増加数（velocity）を累計スター数 ÷ 経過日数より優先する", () => {
  const big = repo("legacy/huge", { stars: 50000, created: "2025-01-01T00:00:00Z" });
  const rising = repo("new/rising", { stars: 5000, created: "2025-06-01T00:00:00Z" });
  const young = repo("fresh/young", { stars: 3000, created: "2026-10-11T00:00:00Z" });
  // 記録が無い場合は累計 ÷ 経過日数（1 日平均 × 7）
  const noVel = rankCandidates([big, rising, young], { now: NOW });
  assert.ok(noVel.ranked.every((r) => r.basis === "stars_per_age"));
  assert.ok(rankedNames(noVel).indexOf("legacy/huge") < rankedNames(noVel).indexOf("new/rising"));

  const velocity = {
    "legacy/huge": { stars_now: 50000, gain_7d: 100, first_seen: "2026-10-01" },
    "new/rising": { stars_now: 5000, gain_7d: 2000, first_seen: "2026-10-01" },
    "fresh/young": { stars_now: 3000, gain_7d: 50, first_seen: "2026-10-12" },
  };
  const withVel = rankCandidates([big, rising, young], { velocity, now: NOW });
  const by = Object.fromEntries(withVel.ranked.map((r) => [r.full_name, r]));
  assert.equal(by["new/rising"].basis, "gain_7d");
  assert.equal(by["new/rising"].score, 2000);
  assert.equal(by["legacy/huge"].score, 100);
  assert.ok(rankedNames(withVel).indexOf("new/rising") < rankedNames(withVel).indexOf("legacy/huge"));
  // 作成から 30 日未満は増加数があっても累計 ÷ 経過日数で見積もる
  assert.equal(by["fresh/young"].basis, "stars_per_age");
  assert.equal(by["fresh/young"].score, 2100);
  // gain_7d が null なら代用
  const nullGain = rankCandidates([big], { velocity: { "legacy/huge": { stars_now: 50000, gain_7d: null } }, now: NOW });
  assert.equal(nullGain.ranked[0].basis, "stars_per_age");
});

test("velocity ファイルが無い・形式が違う場合でも動き、{ repos: {...} } の形も読める", () => {
  assert.deepEqual(normalizeVelocity(undefined), {});
  assert.deepEqual(normalizeVelocity(null), {});
  assert.deepEqual(normalizeVelocity("broken"), {});
  const r = rankCandidates([repo("a/b", { created: "2025-01-01T00:00:00Z" })], { now: NOW });
  assert.equal(r.ranked.length, 1);
  assert.equal(r.ranked[0].basis, "stars_per_age");
  const wrapped = rankCandidates([repo("A/B", { created: "2025-01-01T00:00:00Z" })], { velocity: { repos: { "a/b": { gain_7d: 42 } } }, now: NOW });
  assert.equal(wrapped.ranked[0].basis, "gain_7d");
  assert.equal(wrapped.ranked[0].score, 42);
});

test("重点テーマ（エージェント・MCP 等）はスコアを themeWeight 倍にする", () => {
  const res = rankCandidates([
    repo("ta/agent", { description: "An autonomous coding agent for your terminal" }),
    repo("tp/plain", { description: "A fast command line tool for developers" }),
    repo("tm/mcp", { description: "Tooling for servers", topics: ["mcp"] }),
  ], { now: NOW });
  const by = Object.fromEntries(res.ranked.map((r) => [r.full_name, r]));
  assert.deepEqual(by["ta/agent"].themes, ["agent"]);
  assert.equal(by["ta/agent"].weight, SELECTION_CONFIG.themeWeight);
  assert.equal(by["tp/plain"].weight, 1);
  assert.deepEqual(by["tm/mcp"].themes, ["mcp"]);
  assert.equal(by["ta/agent"].score, Math.round(by["tp/plain"].score * SELECTION_CONFIG.themeWeight * 100) / 100);
});

test("ウォッチリストは 2〜10 位", () => {
  const cands = Array.from({ length: 15 }, (_, i) => repo(`owner${i}/repo${i}`, { stars: 1000 * (i + 1), created: "2026-01-01T00:00:00Z" }));
  const res = rankCandidates(cands, { now: NOW });
  assert.equal(res.ranked.length, 15);
  assert.equal(res.watchlist.length, 9);
  assert.deepEqual(res.watchlist.map((r) => r.full_name), res.ranked.slice(1, 10).map((r) => r.full_name));
  const doc = watchlistDocument(res, NOW);
  assert.equal(doc.date, "2026-10-21");
  assert.deepEqual(doc.items.map((i) => i.rank), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(doc.items[0].full_name, res.ranked[1].full_name);
  assert.ok(doc.items.every((i) => typeof i.score === "number" && i.url.startsWith("https://github.com/")));
  // 候補が少なければ短くなるだけ
  assert.deepEqual(rankCandidates([repo("one/only")], { now: NOW }).watchlist, []);
});

test("公開日はリポジトリの作成日（JST）より前にしない", () => {
  assert.equal(pubDateProblem("2026-10-18", "2026-10-01T14:24:46Z"), null);
  assert.match(pubDateProblem("2024-07-20", "2026-10-01T14:24:46Z"), /作成日/);
  // UTC では前日でも JST では同じ日
  assert.equal(pubDateProblem("2026-10-02", "2026-10-01T15:30:00Z"), null);
  assert.match(pubDateProblem("2026/10/02", "2026-10-01T00:00:00Z"), /YYYY-MM-DD/);
});

const frontmatter = (s) => Object.fromEntries(
  (s.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/)?.[1] || "").split("\n")
    .map((l) => l.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/)).filter(Boolean)
    .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
);

test("掲載中の記事の公開日は、リポジトリの作成日とサイト開始日（2026-10-09）より前ではない", () => {
  const dir = "src/pages/radar";
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    const fm = frontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
    assert.ok(fm.pubDate >= "2026-10-09", `${f}: pubDate ${fm.pubDate} がサイト開始前`);
    if (fm.repoCreatedAt) assert.ok(fm.pubDate >= fm.repoCreatedAt, `${f}: pubDate ${fm.pubDate} < repoCreatedAt ${fm.repoCreatedAt}`);
  }
});

test("取り下げた記事はサイトに無く、選定のブロックリストに載っている", () => {
  for (const s of REMOVED_SLUGS) {
    assert.ok(!fs.existsSync(`src/pages/radar/${s}.md`), `${s}.md が残っています`);
    assert.ok(BLOCKED_SLUGS.includes(s));
  }
  // note の有料版が公開中の記事は取り下げない
  const noteUrls = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"));
  for (const s of REMOVED_SLUGS) assert.ok(!noteUrls[s]?.url, `${s} は note で公開中のため取り下げられない`);
});

test("選定基準ページは selection.mjs の設定をそのまま表示し、フッターからリンクされる", () => {
  const src = fs.readFileSync("src/pages/criteria.astro", "utf8");
  assert.match(src, /import \{[^}]*SELECTION_CONFIG[^}]*\} from "\.\.\/\.\.\/scripts\/utils\/selection\.mjs"/);
  assert.match(src, /REJECTION_REASONS/);
  // テーマ名・除外理由・集中の文言・数値はページに書き写さず、設定から表示する
  for (const t of SELECTION_CONFIG.themes) assert.ok(!src.includes(t.label), `テーマ「${t.label}」がページに直書きされています`);
  for (const label of Object.values(REJECTION_REASONS)) assert.ok(!src.includes(label), `除外理由がページに直書きされています: ${label}`);
  assert.ok(!src.includes(SELECTION_CONFIG.cluster.notice));
  for (const expr of ["cfg.themeWeight", "cfg.cluster.notice", "cfg.ownerCap.windowDays", "cfg.ownerCap.maxArticles", "cfg.score.windowDays", "cfg.cluster.windowDays", "cfg.cluster.minRepos", "cfg.cluster.minStars", "cfg.themes.map", "STAR_TIER_NOTE"]) {
    assert.ok(src.includes(expr), `${expr} を表示していません`);
  }
  assert.equal(SELECTION_CONFIG.cluster.notice, "短期間に同一オーナーの高スター新規リポジトリが集中している場合は選定を見送ります");
  const layout = fs.readFileSync("src/layouts/Layout.astro", "utf8");
  const footer = layout.slice(layout.indexOf("<footer>"), layout.indexOf("</footer>"));
  assert.match(footer, /href=\{`\$\{baseUrl\}\/criteria\/`\}/);
});
