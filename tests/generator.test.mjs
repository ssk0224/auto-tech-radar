// 生成スクリプト（毎日 CI で無人実行）が、不正な生成物を保存せずに止めることを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";

const root = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".astro"]);

const PAID = "## 有料の中身 SECRET_PAID_TEXT\n" + "提案書と見積の本文。".repeat(200);
// receipt: 無料部分の領収書の案内（生成モデルが雛形の定型文を少し言い換えた形。保存時に定型文にそろえる）
const output = ({ mermaid = true, footer = true, image = "", hype = "", paidExtra = "", receipt = "> ※noteは購入後、マイページから領収書を発行できます。" } = {}) => `=== WEB ARTICLE ===
---
layout: "../../layouts/Layout.astro"
title: "testtool - test"
description: "test"
pubDate: "2000-01-01"
tags: ["Go"]
repoUrl: "https://github.com/acme/testtool"
stars: 99999
---
# testtool: 概要と革新性
## 解決する主要な課題とアーキテクチャ
${mermaid ? '```mermaid\ngraph TD\n  A["CLI"] --> B["Core"]\n```' : "図なし"}
=== NOTE ARTICLE ===
# testtool note
無料部分の導入。${hype}経費精算にも使えます。
${receipt}
--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------
${PAID}
${paidExtra}
${image ? `\`\`\`yaml\nservices:\n  app:\n    image: ${image}\n\`\`\`` : ""}
${footer ? "---\n**【note出品時用 推奨ハッシュタグ】**\n#AI #OSS #副業 #受託開発" : ""}
=== X THREAD ===
[TWEET 1]
hello
`;

function run(mockOut, extraEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gen-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction"); // Windows ではディレクトリの symlink に権限が要るため junction を使う
  // 「本日分は生成済み」で即終了しないよう、複製側の記事の公開日を過去にずらす
  const radar = path.join(dir, "src/pages/radar");
  for (const f of fs.readdirSync(radar)) {
    const p = path.join(radar, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^pubDate:.*$/m, 'pubDate: "2000-01-01"'));
  }
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "tests/fixtures/mock_setup.mjs")).href, "scripts/crawl_and_generate.mjs"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, GEMINI_API_KEY: "dummy", MOCK_OUT: mockOut, ...extraEnv },
  });
  return { dir, log: r.stdout + r.stderr, status: r.status };
}
const grepRepo = (dir, needle) => {
  const hits = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    if (SKIP.has(e.name) || e.name === "tests") return; // tests/ は検査用の文字列そのものを含む
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (fs.readFileSync(p).includes(needle)) hits.push(p);
  });
  walk(dir);
  return hits;
};

test("正常な生成物は保存され、有料本文は平文でどこにも残らない", () => {
  const { dir, log } = run(output());
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    assert.ok(fs.existsSync(path.join(dir, "note_drafts/testtool_note.paid.enc")), log);
    assert.deepEqual(grepRepo(dir, "SECRET_PAID_TEXT"), []);
    // 公開日・スター数は生成モデルの出力（2000-01-01 / 99999）ではなく実データ
    const web = fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8");
    const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    assert.match(web, new RegExp(`^pubDate: "${jstToday}"$`, "m"));
    assert.match(web, /^stars: 1234$/m);
    // リポジトリの作成日（JST）を残し、選定のウォッチリストを書く
    assert.match(web, /^repoCreatedAt: "2026-01-15"$/m);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "data/watchlist.json"), "utf8")).date, jstToday);
    // 推奨ハッシュタグは生成モデルの固定タグ（#副業 #受託開発 を含む）ではなく、言語・トピックから作ったもの
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /^#OSS #Go #cli #devops$/m);
    assert.doesNotMatch(pub, /#副業|#受託開発/);
    // 領収書の案内は定型文にそろえて保存する（tests/receipt_wording.test.mjs が全原稿で確かめる文）
    assert.ok(pub.split("\n").includes("> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。"), pub);
    // Zenn への自動公開は停止中: articles/ には下書き（published: false）として書く
    const zenn = fs.readFileSync(path.join(dir, "articles/testtool-tech-radar.md"), "utf8");
    assert.match(zenn, /^published: false$/m);
    assert.doesNotMatch(zenn, /^published: true$/m);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("1 回の実行で生成する新規記事は 1 本まで（候補が複数あっても 2 本目は生成しない）", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-count-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output(), { MOCK_SECOND_REPO: "1", MOCK_CALLS: calls });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/othertool.md")), log);
    assert.equal(fs.readFileSync(calls, "utf8").length, 1, log);
    assert.match(log, /Reached target count \(1\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

test("末尾の案内・ハッシュタグが欠けた生成物は標準の末尾で補って採用する", () => {
  const { dir, log } = run(output({ footer: false }));
  try {
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /^#OSS #Go #cli #devops$/m, log);
    assert.doesNotMatch(pub, /#副業|#受託開発/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [name, opts, why] of [
  ["構成図が無い", { mermaid: false }, /Mermaid/],
  ["実在しないイメージを含む", { image: "ghcr.io/acme/does-not-exist:latest" }, /実在を確認できない参照/],
  ["無料部分に誇張表現（一発起動）を含む", { hype: "コピペで本番一発起動できます。" }, /誇張・結果保証の表現/],
  ["有料部分に収入の金額を含む", { paidExtra: "このSaaSでMRR 50万円を見込めます。" }, /誇張・結果保証の表現/],
  ["無料部分に領収書の案内が無い", { receipt: "" }, /領収書の案内（定型文）が無料部分にありません/],
  ["無料部分でインボイス対応をうたう", { hype: "インボイス制度にも対応しています。" }, /インボイス対応・即時発行・経費精算できるという断定/],
]) {
  test(`不採用になる: ${name}`, () => {
    const { dir, log } = run(output(opts));
    try {
      assert.match(log, why);
      assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), "不採用の生成物が保存された");
      assert.ok(!fs.existsSync(path.join(dir, "note_drafts/testtool_note.md")), "不採用の生成物が保存された");
      assert.match(log, /::warning title=No new article::/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test("Gemini の利用枠切れ（429 quota）では再試行も次の候補も試さず、警告を出して止める", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output(), {
    MOCK_ERROR: '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}',
    MOCK_CALLS: calls,
  });
  try {
    assert.equal(fs.readFileSync(calls, "utf8").length, 1, log);
    assert.match(log, /Gemini quota exhausted/);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});
