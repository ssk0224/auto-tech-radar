// 公開物（README・サイト・画像の文字・生成スクリプトが出す文・データ）が、記事の作り方を実際と違う形で述べないことを確かめる。
// 記事は README の文を原文のまま（訳さずに）抜き出して示す形で、訳や AI の解説文は載せない（src/utils/site_copy.js の SITE_DESCRIPTION、
// scripts/crawl_and_generate.mjs の生成指示）。それなのに「日本語で解説」「AI が解説を下書き」型の古い言い回しが画像・ヒーロー・ヘッダーに残った（2026-10-26）。
// 正本（data/profile_copy.json の statements.subject。公開中の外部の面と照合する文）と同じ文は対象外。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { siteConfig } from "../src/config/site.js";
import { trackedFiles, operatorTexts, isCodeFile, stripComments, textViews, readRepo, repoRoot } from "./helpers/public_text.mjs";

const SUBJECT = JSON.parse(readRepo("data/profile_copy.json")).statements.subject;
// src/config/site.js の tagline は画面に出さず、正本の語「解説」の根拠（scripts/utils/profile_vocabulary.mjs の TERMS）としてだけ使う。
// 正本と同じ扱いにする（画面に出すようになったら、下のテストが赤にする）
const TAGLINE_DECL = `tagline: "${siteConfig.tagline}"`;

// 記事の作り方の古い言い回し（日本語の解説・訳を載せている／AI が解説・図・日本語の文を下書きしている、という主張）。
// 「AI が下書きした記事」だけの文は AI 生成の表示（正本の aiMade と同じ事実）なので対象外
const STALE_METHOD = [
  [/日本語(?:で|の)?解説/, "日本語の解説を載せているという主張"],
  [/日本語で確認/, "日本語で確かめられるという主張"],
  [/解説を下書き/, "AI が解説を下書きしているという主張"],
  [/AI\s?が\s?解説/, "AI が解説しているという主張"],
  [/日本語で下書き/, "AI が日本語の文を下書きしているという主張"],
  [/(?:解説|図)[^。\n]{0,12}の下書き/, "AI が解説・図を下書きしているという主張"],
];

export function staleMethodHits(f, text) {
  // コメントは画面に出ない作業メモ（コードは // と /* */ も、マークアップは <!-- --> を除く）
  let src = (isCodeFile(f) ? stripComments(text) : text).replace(/<!--[\s\S]*?-->/g, "");
  src = src.split(SUBJECT).join("");
  if (f === "src/config/site.js") src = src.split(TAGLINE_DECL).join("");
  const hits = new Set();
  for (const view of textViews(src)) {
    for (const line of view.split("\n")) {
      for (const [re, why] of STALE_METHOD) if (re.test(line)) hits.add(`${f}: ${why} (${line.trim().slice(0, 80)})`);
    }
  }
  return [...hits];
}

test("公開物（README・サイト・画像・生成スクリプト・データ）に、記事の作り方を実際と違う形で述べる言い回し（日本語で解説・AI が解説を下書き など）が無い", () => {
  const sources = operatorTexts(trackedFiles());
  for (const must of ["README.md", "src/layouts/Layout.astro", "src/pages/index.astro", "public/og-card.svg", "public/manifest.json", "scripts/generate_og_cards.mjs", "data/profile_copy.json"]) {
    assert.ok(sources.includes(must), `検査の対象に ${must} が無い`);
  }
  assert.ok(sources.some((f) => f.startsWith("public/ogp/") && f.endsWith(".svg")), "記事ごとの OGP 画像が検査の対象に無い");
  assert.deepEqual(sources.flatMap((f) => staleMethodHits(f, readRepo(f))), []);
});

test("古い言い回しの検査は、タグで分けた語・画像の文字を拾い、正本と同じ文・コメントは拾わない", () => {
  assert.ok(staleMethodHits("src/pages/x.astro", "<h1>世界のOSSを<span>日本語で解説</span></h1>").length > 0);
  assert.ok(staleMethodHits("public/x.svg", "<text>📖 日本語で<tspan>解説</tspan></text>").length > 0, "タグで分けた語");
  assert.ok(staleMethodHits("src/layouts/X.astro", "<p>OSS の日本語解説（README などの公開情報をもとに AI が下書き）</p>").length > 0);
  assert.ok(staleMethodHits("README.md", "Google Gemini が日本語の解説を下書きし").length > 0);
  assert.ok(staleMethodHits("README.md", 'AI["🧠 Google Gemini（README をもとにした解説・Mermaid 図の下書き）"]').length > 0);
  assert.ok(staleMethodHits("src/pages/about.astro", "<p>AI（Google Gemini）が日本語で下書きし、自動検査を通ったものを公開しています。</p>").length > 0);
  assert.deepEqual(staleMethodHits("src/layouts/X.astro", "<p>この記事は、README をもとに AI（Google Gemini）が下書きし、自動検査を通して公開しています。</p>"), [], "AI 生成の表示");
  assert.deepEqual(staleMethodHits("data/profile_copy.json", JSON.stringify({ subject: SUBJECT })), [], "正本の文");
  assert.deepEqual(staleMethodHits("src/pages/sponsor.astro", `<p>${SUBJECT}</p>`), [], "正本と同じ文");
  assert.deepEqual(staleMethodHits("scripts/x.mjs", "// バッジ: 日本語解説\nconst a = 1;"), [], "コメント");
  assert.deepEqual(staleMethodHits("src/pages/x.astro", "<p>README の文を原文のまま（訳さずに）抜き出しています。</p>"), []);
});

test("src/config/site.js の tagline（正本の語の根拠）は画面に出していない（出すなら古い言い回しの検査の対象にする）", () => {
  const users = trackedFiles().filter((f) => f.startsWith("src/") && f !== "src/config/site.js" && /\.(astro|m?js|ts|md)$/.test(f));
  const rendered = users.filter((f) => /\btagline\b/.test(fs.readFileSync(path.join(repoRoot, f), "utf8")));
  assert.deepEqual(rendered, []);
});
