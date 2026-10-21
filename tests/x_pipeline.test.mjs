// X 自動投稿・検索エンジン通知・スポンサーページの検査（過去に実際に起きた不具合を二度と出さない）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { sanitizeAndAttachUrlToTweet, extractTweet1, calcTwitterWeight } from "../scripts/utils/twitter_formatter.mjs";
import { classifyXResponse } from "../scripts/auto_tweet_x.mjs";
import { recentArticleUrls } from "../scripts/ping_search_engines.mjs";

test("ツイートは行数に関係なく weight 245 以内に収まり、URL と 👇 を残す", () => {
  const long = "あ".repeat(200);
  const cases = [long, `${long}\n${long}`, `見出し\n${long}\n${long}\n続きはこちら👇`, `${long} 👇 ${long}`, "短い本文"];
  for (const raw of cases) {
    const r = sanitizeAndAttachUrlToTweet(raw, "demo");
    assert.ok(r.weight <= 245, `weight ${r.weight}: ${raw.slice(0, 20)}`);
    assert.equal(r.weight, calcTwitterWeight(r.tweet));
    assert.ok(r.isSafe);
    assert.ok(r.tweet.endsWith("https://ssk0224.github.io/auto-tech-radar/radar/demo/"));
    assert.ok(r.tweet.includes("👇"));
  }
  assert.ok(sanitizeAndAttachUrlToTweet(`見出し\n${long}`, "demo").tweet.startsWith("見出し\n"), "先頭のフックは残す");
});

// x_posts/*.txt は Windows の作業ツリーでは CRLF のことがある。\r が本文に残ると、文字数（weight）が行ごとに増え、投稿文に \r\n と \n が混ざる
test("CRLF の x_posts から取り出したツイートも LF と同じ文面・同じ weight になり、\\r が残らない", () => {
  const lines = ["[TWEET 1]", "行1あ", "行2い", "行3う 👇", "", "[TWEET 2]", "続き"];
  const results = ["\n", "\r\n"].map((eol) => sanitizeAndAttachUrlToTweet(extractTweet1(lines.join(eol)), "demo"));
  assert.equal(results[1].tweet, results[0].tweet);
  assert.equal(results[1].weight, results[0].weight);
  assert.ok(!results[1].tweet.includes("\r"));
  // 上限ぎりぎりで切り詰める分岐（行ごとに split する）でも \r を持ち込まない
  const long = ["[TWEET 1]", ...Array.from({ length: 6 }, (_, i) => `${i}行目 ${"あ".repeat(30)}`), "👇", "", "[TWEET 2]", "x"];
  const trimmed = ["\n", "\r\n"].map((eol) => sanitizeAndAttachUrlToTweet(extractTweet1(long.join(eol)), "demo"));
  assert.equal(trimmed[1].tweet, trimmed[0].tweet);
  assert.ok(!trimmed[1].tweet.includes("\r"));
});

test("X の応答: 429 と 5xx だけ再試行し、他の 4xx は失敗として記録してキューを止めない", () => {
  assert.equal(classifyXResponse(201), "posted");
  assert.equal(classifyXResponse(429), "retry");
  assert.equal(classifyXResponse(503), "retry");
  for (const s of [400, 422]) assert.equal(classifyXResponse(s), "failed");
  assert.equal(classifyXResponse(403, '{"detail":"You are not allowed to create a Tweet with duplicate content."}'), "failed");
  // 認証・権限エラーは記事のせいではないので記録しない（記録すると鍵を直しても二度と投稿されない）
  assert.equal(classifyXResponse(401), "auth");
  assert.equal(classifyXResponse(403, '{"title":"Forbidden","detail":"oauth1 app permissions"}'), "auth");
});

test("出品履歴のマージ: true は failed より優先、failed は true に化けない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-merge-"));
  try {
    const w = (n, o) => (fs.writeFileSync(path.join(dir, n), JSON.stringify(o)), path.join(dir, n));
    const base = w("base", {});
    const ours = w("ours", { a: { x: "failed" }, b: { x: "failed" }, c: { x: false } });
    const theirs = w("theirs", { a: { x: true }, c: { x: "failed" } });
    execFileSync(process.execPath, ["scripts/merge_publish_history.mjs", base, ours, theirs]);
    const m = JSON.parse(fs.readFileSync(ours, "utf8"));
    assert.equal(m.a.x, true);
    assert.equal(m.b.x, "failed");
    assert.equal(m.c.x, "failed");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("IndexNow には直近の記事だけ送り、ノイズ記事は送らない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-ping-"));
  try {
    fs.writeFileSync(path.join(dir, "new-tool.md"), 'pubDate: "2026-10-19"\n');
    fs.writeFileSync(path.join(dir, "old-tool.md"), 'pubDate: "2026-01-01"\n');
    fs.writeFileSync(path.join(dir, "awesome-list.md"), 'pubDate: "2026-10-19"\n');
    const urls = recentArticleUrls(dir, new Date("2026-10-19T22:00:00Z"));
    assert.ok(urls.some((u) => u.endsWith("/radar/new-tool/")));
    assert.ok(!urls.some((u) => u.includes("old-tool")));
    assert.ok(!urls.some((u) => u.includes("awesome-list")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("スポンサーページに根拠のない読者数値・被リンク販売・未実装の掲載約束が無い", () => {
  const s = fs.readFileSync("src/pages/sponsor.astro", "utf8");
  for (const [re, why] of [
    [/\d+%<\/div>/, "計測していない読者属性の割合"],
    [/dofollow/i, "検索順位目的の被リンク販売（rel=sponsored が必要）"],
    [/枠限定/, "根拠のない希少性"],
    [/RSSフィード内への協賛/, "未実装の RSS 掲載"],
    [/全ページ最上部/, "未実装のヘッダー掲載"],
    [/永久/, "保証できない永久掲載"],
  ]) assert.ok(!re.test(s), why);
  assert.ok(s.includes("PR"), "PR 表記の方針を示す");
});
