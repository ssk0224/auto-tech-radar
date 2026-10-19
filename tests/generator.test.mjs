// 生成スクリプト（毎日 CI で無人実行）が、不正な生成物を保存せずに止めることを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".astro"]);

const PAID = "## 有料の中身 SECRET_PAID_TEXT\n" + "提案書と見積の本文。".repeat(200);
const output = ({ mermaid = true, footer = true, image = "" } = {}) => `=== WEB ARTICLE ===
---
layout: "../../layouts/Layout.astro"
title: "testtool - test"
description: "test"
pubDate: "2000-01-01"
tags: ["Go"]
repoUrl: "https://github.com/acme/testtool"
stars: 1234
---
# testtool: 概要と革新性
## 解決する主要な課題とアーキテクチャ
${mermaid ? '```mermaid\ngraph TD\n  A["CLI"] --> B["Core"]\n```' : "図なし"}
=== NOTE ARTICLE ===
# testtool note
無料部分の導入。経費精算にも使えます。
--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------
${PAID}
${image ? `\`\`\`yaml\nservices:\n  app:\n    image: ${image}\n\`\`\`` : ""}
${footer ? "---\n**【note出品時用 推奨ハッシュタグ】**\n#AI #OSS" : ""}
=== X THREAD ===
[TWEET 1]
hello
`;

function run(mockOut) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gen-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"));
  // 「本日分は生成済み」で即終了しないよう、複製側の記事の公開日を過去にずらす
  const radar = path.join(dir, "src/pages/radar");
  for (const f of fs.readdirSync(radar)) {
    const p = path.join(radar, f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^pubDate:.*$/m, 'pubDate: "2000-01-01"'));
  }
  const r = spawnSync(process.execPath, ["--import", path.join(root, "tests/fixtures/mock_setup.mjs"), "scripts/crawl_and_generate.mjs"], {
    cwd: dir, encoding: "utf8", env: { ...process.env, GEMINI_API_KEY: "dummy", MOCK_OUT: mockOut },
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
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("末尾の案内・ハッシュタグが欠けた生成物は標準の末尾で補って採用する", () => {
  const { dir, log } = run(output({ footer: false }));
  try {
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /#AI #OSS/, log);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [name, opts, why] of [
  ["構成図が無い", { mermaid: false }, /Mermaid/],
  ["実在しないイメージを含む", { image: "ghcr.io/acme/does-not-exist:latest" }, /実在を確認できない参照/],
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
