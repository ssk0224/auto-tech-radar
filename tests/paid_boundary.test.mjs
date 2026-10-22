// 有料と無料の境界は、本文中の位置や見出し名ではなく「有料版にしか無い価値」で決める（leakhunt C4、2026-10-22）。
// (a) 有料版の売り（*.paid.json の features）の語が、無料側（Web 記事・note の無料部分）の見出しと重ならない
// (b) 生成時に不採用にした原稿の有料本文の断片が、公開リポジトリの Actions ログに出ない
// (c) 有料部分に Markdown の見出しが無い（note.com の目次に有料部分の見出しが表示されるため、各節の題は太字の行にする）
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { pathToFileURL } from "url";
import { linkDir } from "./helpers/links.mjs";
import { PAID_FEATURE_RULES, STANDARD_FOOTER, paidContentSummary, splitPaid, loadPrivateKeys, assembleNote, isSealed, decryptText, sealedFileFor } from "../scripts/utils/note_vault.mjs";
import { WEB_TEMPLATE_H2, NOTE_FREE_TEMPLATE_H2, sectionLabels, paidHeadingLines } from "../scripts/utils/article_template.mjs";
import { normalizeEol } from "../scripts/utils/eol.mjs";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => normalizeEol(fs.readFileSync(p, "utf8"));
const notes = fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md")).map((f) => f.replace(/_note\.md$/, ""));
const ruleOf = (feature) => PAID_FEATURE_RULES.find(([, label]) => feature === label || feature.startsWith(label));

test("有料版の売りの規則は、無料側のテンプレートの見出しと重ならない（README から作れる節を有料の売りにしない）", () => {
  const bad = [];
  for (const [re, label] of PAID_FEATURE_RULES) {
    for (const h of [...WEB_TEMPLATE_H2, ...NOTE_FREE_TEMPLATE_H2]) if (re.test(h)) bad.push(`${label} ↔ ${h}`);
  }
  assert.deepEqual(bad, []);
});

test("有料版の内容一覧は有料部分の節の題（太字の行）から作り、無料側と同じ題材（導入手順）を売りにしない", () => {
  const s = paidContentSummary("**📋 【提案書テンプレート】社内DX・AI導入提案書 Markdown版**\n本文\n**🛠️ Docker の例（公式未提供・動作未検証）**\n**🗣️ 想定問答**\n");
  assert.deepEqual(s.features, ["導入提案書テンプレート（Markdown）", "導入時の想定問答"]);
});

test("公開中の note の有料版の売り（features）の語が、無料部分と Web 記事の見出しに出てこない", () => {
  const bad = [];
  for (const slug of notes) {
    const summary = `note_drafts/${slug}_note.paid.json`;
    if (!fs.existsSync(summary)) continue;
    const { features } = JSON.parse(read(summary));
    const head = splitPaid(read(`note_drafts/${slug}_note.md`)).head.join("\n");
    const web = fs.existsSync(`src/pages/radar/${slug}.md`) ? read(`src/pages/radar/${slug}.md`) : "";
    const free = [...sectionLabels(head), ...sectionLabels(web)];
    for (const f of features) {
      const rule = ruleOf(f);
      assert.ok(rule, `${slug}: 規則に無い売り「${f}」`);
      for (const h of free) if (rule[0].test(h)) bad.push(`${slug}: 「${f}」 ↔ ${h}`);
    }
  }
  assert.deepEqual(bad, []);
});

// ---- (b) 不採用のログ ----
const SKIP = new Set(["node_modules", "dist", ".git", ".astro", ".claude"]);
function runGenerator(mockOut, extraEnv = {}, prepare = null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-paid-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  linkDir(path.join(root, "node_modules"), path.join(dir, "node_modules"));
  for (const f of fs.readdirSync(path.join(dir, "src/pages/radar"))) {
    const p = path.join(dir, "src/pages/radar", f);
    fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^pubDate:.*$/m, 'pubDate: "2000-01-01"'));
  }
  if (prepare) prepare(dir);
  const env = { ...process.env, GEMINI_API_KEY: "dummy", MOCK_OUT: mockOut, ...extraEnv };
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "tests/fixtures/mock_setup.mjs")).href, "scripts/crawl_and_generate.mjs"], { cwd: dir, encoding: "utf8", env });
  return { dir, log: r.stdout + r.stderr };
}
const FREE = "この記事では、公式 README に沿って概要と注意点を説明します。".repeat(15);
const mock = (paid) => `=== WEB ARTICLE ===
---
layout: "../../layouts/Layout.astro"
title: "testtool - test"
description: "test"
pubDate: "2000-01-01"
tags: ["Go"]
repoUrl: "https://github.com/acme/testtool"
stars: 1
---
# testtool: 概要
## 解決する主要な課題とアーキテクチャ
\`\`\`mermaid
graph TD
  A["CLI"] --> B["Core"]
\`\`\`
=== NOTE ARTICLE ===
# testtool note
## 主な機能とアーキテクチャ概要
${FREE}
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。
--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------
${paid}
---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS
=== X THREAD ===
[TWEET 1]
hello
`;

test("生成時に不採用にした原稿の有料本文の断片は、ログ（公開リポジトリの Actions ログ）に出ない: 規則の名前と記事のスラッグだけを出す", () => {
  // 有料部分に、誇張（売上の金額）・禁止表現・実在しないイメージを入れて不採用にさせる
  const paid = [
    "**有料の節 QZXPAIDSENTINEL**",
    "このSaaSの売上 87万円 を見込めるQZXPAIDSENTINEL。",
    "累計99,999+ Stars のQZXPAIDSENTINEL。",
    "```yaml\nservices:\n  app:\n    image: ghcr.io/acme/qzxpaidsentinel-image:latest\n```",
    "提案書と見積の本文QZX。".repeat(150),
  ].join("\n");
  const { dir, log } = runGenerator(mock(paid));
  try {
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), "不採用になるはずの原稿が保存された");
    assert.match(log, /::warning title=No new article::/);
    // 不採用の理由（規則の名前）はわかる
    assert.match(log, /Failed to process testtool: .*実在を確認できない参照があります（1件）/);
    assert.match(log, /集計していないスター数の合計/);
    assert.match(log, /根拠のない収入・売上の金額/);
    // 有料本文の 6 文字以上の連続した断片が、ログのどこにも無い（英字の組み合わせを大文字小文字を区別せずに見る）
    const text = paid.replace(/\s+/g, " ");
    const leaks = new Set();
    const lower = log.toLowerCase();
    for (let i = 0; i + 6 <= text.length; i++) {
      const w = text.slice(i, i + 6);
      if (w.trim().length < 6) continue;
      if (lower.includes(w.toLowerCase())) leaks.add(w);
    }
    assert.deepEqual([...leaks], [], log);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- (c) 有料部分の見出し ----
test("見出しの判定: コードブロックの外の # 行だけを見出しとする", () => {
  assert.deepEqual(paidHeadingLines("**節**\n## 見出し\n```bash\n# コメント\n```\n### 小見出し"), ["## 見出し", "### 小見出し"]);
});

test("生成スクリプトは有料部分の見出しを太字の行にして暗号化する（目次に有料の見出しを出さない）", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const paid = ["## 💡 マネタイズ戦略", "本文。".repeat(400), "### 📋 提案書テンプレート", "```bash\n# コメントは見出しではない\n```", "## 🗣️ 想定問答", "回答。".repeat(400)].join("\n");
  const { dir, log } = runGenerator(mock(paid), {}, (d) => fs.writeFileSync(path.join(d, "keys/note_vault_public.pem"), publicKey));
  try {
    const noteFile = path.join(dir, "note_drafts/testtool_note.md");
    assert.ok(fs.existsSync(noteFile), log);
    const plain = decryptText(fs.readFileSync(sealedFileFor(noteFile), "utf8"), [privateKey], "testtool_note.md");
    assert.deepEqual(paidHeadingLines(plain), []);
    assert.ok(plain.split("\n").includes("**💡 マネタイズ戦略**"), "見出しは太字の行として残る");
    assert.ok(plain.includes("# コメントは見出しではない"));
    const features = JSON.parse(fs.readFileSync(path.join(dir, "note_drafts/testtool_note.paid.json"), "utf8")).features;
    assert.deepEqual(features, ["導入提案書テンプレート（Markdown）", "活用・収益化の考え方", "導入時の想定問答"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("復号可能な環境では、公開中の全 note の有料部分に Markdown の見出しが無い", (t) => {
  let keys = [];
  try { keys = loadPrivateKeys(); } catch {}
  if (keys.length === 0) return t.skip("秘密鍵が無いため未実施（オーナー端末で npm test すると実行される）");
  const bad = [];
  for (const slug of notes) {
    const f = `note_drafts/${slug}_note.md`;
    if (!isSealed(read(f))) continue;
    const n = paidHeadingLines(splitPaid(normalizeEol(assembleNote(f, keys))).paid.join("\n")).length;
    if (n) bad.push(`${slug}: ${n} 行`); // 見出しの文言は出さない（有料本文）
  }
  assert.deepEqual(bad, []);
});

test("末尾の案内（公開されたまま暗号化しない部分）に置けるのは標準の末尾の行とハッシュタグだけで、メンバーシップに触れた有料本文は有料部分に入る", () => {
  const note = [
    "# t", "無料部分", "【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】", "**有料の節**", "有料の本文。",
    "---", "### 🎁 【メンバーシップのご案内】", "メンバーシップ会員だけに教える受託単価の決め方は、まず見積の前提をそろえることです。",
    "---", "**【note出品時用 推奨ハッシュタグ】**", "#AI #OSS",
  ].join("\n");
  const parts = splitPaid(note);
  assert.ok(parts.paid.some((l) => l.includes("受託単価の決め方")), "メンバーシップに触れた有料本文が公開側（末尾）に入った");
  assert.ok(!parts.tail.some((l) => l.includes("受託単価の決め方")));
  // 標準の末尾はそのまま公開側に残る
  const std = splitPaid(["# t", "無料", "【有料ライン ここから先は有料会員限定】", "有料", STANDARD_FOOTER.trim()].join("\n"));
  assert.ok(std.hasTail);
  assert.ok(std.tail.some((l) => /メンバーシップ特典に追加した有料記事/.test(l)));
});

test("サイト・スクリプトの案内文は、無料の Web 記事に README から転記している導入手順を有料の売りとして案内しない", () => {
  // 無料側の題材（Web 記事のテンプレートのインストールの節）。「導入手順」はその言い換え
  const freeTopic = new RegExp(`${WEB_TEMPLATE_H2.find((h) => /インストール/.test(h)).replace(/^## /, "").split("（")[0]}手順|導入手順`);
  const paidContext = /有料|実務キット|メンバーシップ特典|note の有料記事/;
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(astro|mjs|js|ts|txt|md)$/.test(e.name)) files.push(p);
  });
  ["src/pages", "src/layouts", "src/components", "public", "scripts"].filter((d) => fs.existsSync(d)).forEach(walk);
  const bad = [];
  for (const f of files) {
    if (f.startsWith(path.join("src", "pages", "radar"))) continue; // 記事本文は readme_grounding の検査
    read(f).split("\n").forEach((l, i) => {
      if (/^\s*\/\//.test(l)) return; // コードのコメント
      if (paidContext.test(l) && freeTopic.test(l)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
