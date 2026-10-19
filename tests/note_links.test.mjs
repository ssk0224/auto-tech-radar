// Web 記事の購入案内（その記事の note 有料版へのリンクと、有料版に含まれる項目）を確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { matchNotesToSlugs, projectNameOf } from "../scripts/sync_note_urls.mjs";
import { paidContentSummary, isSealed } from "../scripts/utils/note_vault.mjs";
import { findProLeaks } from "../scripts/utils/pro_boundary.mjs";

test("note の記事と原稿の対応: タイトル一致を優先し、曖昧なときはリンクしない", () => {
  const notes = [
    { name: "海外急上昇OSS「ZCode」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き", noteUrl: "https://note.com/x/n/n1", price: 980 },
    { name: "Laya 解説", noteUrl: "https://note.com/x/n/n2", price: 980 },
    { name: "Laya-MLX 解説", noteUrl: "https://note.com/x/n/n3", price: 980 },
    { name: "【最新OSS解体新書】Magpieとは？ 改題版", noteUrl: "https://note.com/x/n/n4", price: 500 },
  ];
  const drafts = [
    { slug: "zcode", title: "海外急上昇OSS「ZCode」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き" },
    { slug: "laya", title: "海外急上昇OSS「Laya」商用化マニュアル" },
    { slug: "magpie", title: "【最新OSS解体新書】Magpieとは？機能解説" },
    { slug: "missing", title: "海外急上昇OSS「Nothing」" },
  ];
  const m = matchNotesToSlugs(notes, drafts);
  assert.equal(m.zcode.url, "https://note.com/x/n/n1");
  assert.equal(m.laya, undefined, "タイトルにもプロジェクト名にも一意に一致しないので推測でリンクしない");
  assert.equal(m.magpie.url, "https://note.com/x/n/n4");
  assert.equal(m.magpie.price, 500);
  assert.equal(m.missing, undefined);
  assert.equal(projectNameOf("【最新OSS解体新書】crates.io-indexとは？"), "crates.io-index");
});

test("有料版の内容一覧は見出しだけから作り、未検証の手順はそう表示する", () => {
  const s = paidContentSummary("## 📋 【コピペで即提案】社内DX・AI導入提案書 Markdown完全版\n本文\n## 🛠️ Docker の例（公式未提供・動作未検証）\n### 起動手順\n");
  assert.deepEqual(s.features, ["導入提案書テンプレート（Markdown）", "導入手順（公式未提供・動作未検証の例を含む）"]);
  assert.equal(s.chars, [..."##📋【コピペで即提案】社内DX・AI導入提案書Markdown完全版本文##🛠️Dockerの例（公式未提供・動作未検証）###起動手順"].length);
});

test("暗号化済みの原稿にはすべて内容一覧があり、有料本文を含まない", () => {
  for (const f of fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md"))) {
    if (!isSealed(fs.readFileSync(`note_drafts/${f}`, "utf8"))) continue;
    const p = `note_drafts/${f.replace(/\.md$/, ".paid.json")}`;
    assert.ok(fs.existsSync(p), `${p} が無い（node scripts/note_vault.mjs summarize）`);
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.deepEqual(Object.keys(j).sort(), ["chars", "features"]);
    assert.deepEqual(findProLeaks(JSON.stringify(j)), [], p);
  }
});

test("note の購入リンクは note.com の記事 URL だけ", () => {
  const urls = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"));
  for (const [slug, v] of Object.entries(urls)) assert.match(v.url, /^https:\/\/note\.com\/[\w-]+\/n\/\w+$/, slug);
});

test("プロジェクト名が完全一致する記事を、名前を含むだけの記事より優先する", () => {
  const notes = [
    { name: "# 【受託80万〜250万】海外急上昇OSS「laya」商用化マニュアル", noteUrl: "https://note.com/x/n/a", price: 980 },
    { name: "# 【受託80万〜250万】海外急上昇OSS「laya-mlx」商用化マニュアル", noteUrl: "https://note.com/x/n/b", price: 980 },
  ];
  const m = matchNotesToSlugs(notes, [
    { slug: "laya", title: "海外急上昇OSS「laya」商用化マニュアル｜社内DX提案書" },
    { slug: "laya-mlx", title: "海外急上昇OSS「laya-mlx」商用化マニュアル｜社内DX提案書" },
  ]);
  assert.equal(m.laya.url, "https://note.com/x/n/a");
  assert.equal(m["laya-mlx"].url, "https://note.com/x/n/b");
});
