// サイト・Zenn・X・note 公開部分の内容検査（過去に実際に起きた不具合を二度と出さない）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { stripProSection, findProLeaks } from "../scripts/utils/pro_boundary.mjs";
import { extractReferences } from "../scripts/utils/reference_check.mjs";
import { zennCta } from "../scripts/utils/funnel_copy.mjs";
import { splitPaid, isSealed } from "../scripts/utils/note_vault.mjs";

const read = (p) => fs.readFileSync(p, "utf8");
const list = (dir, re) => fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f));

test("PRO 見出し以降を Web 記事から除去する／README の MCP 設定の引用は有料扱いしない", () => {
  const md = "# t\n## 無料\n```json\n{\"mcpServers\":{}}\n```\n---\n\n## 🛠️ 【Auto Tech Radar PRO限定】商用化マニュアル\n秘密";
  const out = stripProSection(md);
  assert.ok(!out.includes("秘密"));
  assert.deepEqual(findProLeaks(out), [], "無料記事の README 引用で誤検出してビルドを止めてはいけない");
});

test("Web 記事に有料キットが無い", () => {
  for (const f of list("src/pages/radar", /\.md$/)) assert.deepEqual(findProLeaks(read(f)), [], f);
});

test("note 原稿は有料ライン以降がすべて暗号化されている", () => {
  for (const f of list("note_drafts", /_note\.md$/)) {
    const c = read(f);
    assert.ok(isSealed(c), `${f}: 有料部分が平文`);
    assert.equal(splitPaid(c).paid.length, 1, `${f}: 有料ライン以降に暗号化プレースホルダ以外がある`);
  }
});

test("Zenn 記事の送客文は共通の文面（funnel_copy）と一致する", () => {
  for (const f of [...list("articles", /\.md$/), ...list("zenn_drafts", /\.md$/)]) {
    const c = read(f);
    const slug = c.match(/auto-tech-radar\/radar\/([a-z0-9_-]+)\//)[1];
    assert.ok(c.includes(zennCta(slug)), `${f}: 送客文が古い`);
  }
});

// 公開される文面に出してはいけない表現（存在しない機能・架空の実績・根拠のない保証）
const FORBIDDEN = [
  [/アンロック/, "サイトに有料本文は無いのに「アンロック」をうたっている"],
  [/即受注|受注に直結|に直結します/, "受注・成果を保証する表現"],
  [/(分前|時間前).{0,40}(アンロック|購読|購入|参加)しました|(アンロック|購読|購入|参加)しました.{0,40}(分前|時間前)/, "架空の購入通知"],
  [/Stripe/, "Stripe では有料本文を届けられない"],
  [/Math\.random\(\)[^\n]{0,40}名/, "乱数で作った閲覧者数"],
  [/全編読み放題|全記事読み放題|全レポート読み放題/, "メンバーシップで全記事が読めるかのような表現（特典に追加した記事のみ）"],
  [/完全公開されています|全編公開されています/, "サイトで有料キットを公開しているかのような表現"],
];
function publicTexts() {
  const out = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(astro|md|js|ts|txt)$/.test(e.name)) out.push([p, read(p)]);
  });
  ["src", "articles", "zenn_drafts", "public"].forEach(walk);
  for (const f of list("note_drafts", /\.md$/)) out.push([f, read(f)]);
  const history = JSON.parse(read("scripts/publish_history.json"));
  for (const f of list("x_posts", /_x\.txt$/)) {
    // 投稿用URLに埋め込まれた本文も検査する（エンコードされた部分だけをデコード）
    const text = read(f).replace(/intent\/tweet\?text=([^\s&]+)/g, (m, q) => { try { return decodeURIComponent(q); } catch (e) { return m; } });
    if (!history[path.basename(f).replace(/_x\.txt$/, "")]?.x) out.push([f, text]);
  }
  return out;
}
test("公開される文面に禁止表現が無い", () => {
  const hits = [];
  for (const [f, text] of publicTexts()) {
    for (const [re, why] of FORBIDDEN) if (re.test(text)) hits.push(`${f}: ${why}`);
  }
  assert.deepEqual(hits, []);
});

test("生成物の参照抽出（イメージ・npm・PyPI）", () => {
  const r = extractReferences("services:\n  a:\n    image: ghcr.io/x/y:1\nFROM rust:1.95-slim AS builder\nnpx -y @scope/pkg@1.0 arg\npip install foo-bar\n");
  assert.deepEqual(r.images.sort(), ["ghcr.io/x/y:1", "rust:1.95-slim"]);
  assert.deepEqual(r.npm, ["@scope/pkg"]);
  assert.deepEqual(r.pypi, ["foo-bar"]);
});
