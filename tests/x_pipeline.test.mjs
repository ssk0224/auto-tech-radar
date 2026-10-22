// X 自動投稿・検索エンジン通知・スポンサーページの検査（過去に実際に起きた不具合を二度と出さない）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { sanitizeAndAttachUrlToTweet, extractTweet1, calcTwitterWeight } from "../scripts/utils/twitter_formatter.mjs";
import { classifyXResponse, postLatestTweet } from "../scripts/auto_tweet_x.mjs";
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

test("X の応答: 失敗として記録するのは記事のせいと分かる応答（400・422・重複投稿の 403）だけ。402（クレジット切れ）・408・425 などは再試行", () => {
  for (const s of [402, 404, 408, 409, 413, 425, 451]) assert.equal(classifyXResponse(s, ""), "retry", String(s));
  // 想定外の成功以外の値（1xx・3xx）も記録しない
  assert.equal(classifyXResponse(304, ""), "retry");
});

// X への投稿を、一時ディレクトリの記事・履歴と模擬の fetch で動かす（api.twitter.com には接続しない）
function runTweet(historyText, response, env = { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_TOKEN_SECRET: "u" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atr-x-"));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "x_posts"));
  fs.mkdirSync(path.join(root, "src/pages/radar"), { recursive: true });
  fs.writeFileSync(path.join(root, "x_posts/demo_x.txt"), "[TWEET 1]\n短い本文です\n👇\n\n[TWEET 2]\nx");
  fs.writeFileSync(path.join(root, "src/pages/radar/demo.md"), '---\npubDate: "2026-10-20"\n---\n本文');
  const historyFile = path.join(root, "scripts/publish_history.json");
  if (historyText !== null) fs.writeFileSync(historyFile, historyText);
  const calls = [];
  const lines = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (response instanceof Error) throw response;
    return new Response(response.body || "", { status: response.status });
  };
  return { root, historyFile, calls, lines, run: () => postLatestTweet({ root, env, fetchImpl, log: (l) => lines.push(l) }) };
}

test("X 投稿: 出品履歴が壊れて読めないときは投稿せず、履歴も書かず、::error で失敗にする（壊れた履歴を空として上書きしない）", async () => {
  const t = runTweet('{"a": {"note": true, "x": tr');
  const r = await t.run();
  assert.equal(r.exitCode, 1);
  assert.deepEqual(t.calls, [], "投稿しない");
  assert.equal(fs.readFileSync(t.historyFile, "utf8"), '{"a": {"note": true, "x": tr', "履歴を書き換えない");
  assert.ok(t.lines.some((l) => l.startsWith("::error") && /publish_history\.json/.test(l)), t.lines.join("\n"));
  fs.rmSync(t.root, { recursive: true, force: true });
});

test("X 投稿: 再試行の応答（402 など）・通信の失敗・鍵の未設定は記録せず ::warning で知らせる。記事のせいの 400 は failed として記録する", async () => {
  const credit = runTweet("{}", { status: 402, body: '{"title":"CreditsDepleted"}' });
  const r1 = await credit.run();
  assert.equal(credit.calls.length, 1);
  assert.deepEqual(JSON.parse(fs.readFileSync(credit.historyFile, "utf8")), {}, "402 を failed として記録しない");
  assert.ok(credit.lines.some((l) => l.startsWith("::warning") && /402/.test(l)), credit.lines.join("\n"));
  assert.equal(r1.outcome, "retry");
  const net = runTweet("{}", new Error("fetch failed"));
  await net.run();
  assert.ok(net.lines.some((l) => l.startsWith("::warning") && /fetch failed/.test(l)), net.lines.join("\n"));
  assert.deepEqual(JSON.parse(fs.readFileSync(net.historyFile, "utf8")), {});
  const nokey = runTweet("{}", { status: 201 }, {});
  await nokey.run();
  assert.deepEqual(nokey.calls, []);
  assert.ok(nokey.lines.some((l) => l.startsWith("::warning") && /キー/.test(l)), nokey.lines.join("\n"));
  const badReq = runTweet("{}", { status: 400, body: "bad" });
  await badReq.run();
  assert.equal(JSON.parse(fs.readFileSync(badReq.historyFile, "utf8")).demo.x, "failed");
  for (const t of [credit, net, nokey, badReq]) fs.rmSync(t.root, { recursive: true, force: true });
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
