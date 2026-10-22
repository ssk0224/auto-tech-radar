// OGP 画像（public/og-card.svg と記事ごとの public/ogp/*.svg・*.png）の「画像の中の文字」を検査する。
// 画像はページの本文検査にかからず、SNS で共有したときに最初に見える。サイト側で撤回した表示（「B2B協賛・受託(¥100k〜)」
// 「毎日自動更新」、記事と関係のないカテゴリ名）が画像にだけ残った。対象は git の追跡ファイルから集める（手で一覧を書かない）
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { findForbiddenClaims } from "../scripts/utils/claims_check.mjs";
import { findHype } from "../scripts/utils/hype_check.mjs";
import { CADENCE_CLAIM_RE } from "../src/utils/cadence.js";
import { renderOgSvg, categoryLabelOf, readPngText, PNG_SOURCE_KEY, UNCATEGORIZED } from "../scripts/generate_og_cards.mjs";
import { trackedFiles, readRepo, repoRoot } from "./helpers/public_text.mjs";
import { normalizeEol } from "./helpers/read_src.mjs";

const files = trackedFiles();
const svgs = files.filter((f) => f.startsWith("public/") && f.endsWith(".svg"));

// SVG の <text>・<tspan> の文字（実体参照を戻す）
export function svgTextNodes(svg) {
  const out = [];
  for (const m of svg.matchAll(/<(text|tspan)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const t = m[2].replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
}

// 画像は記事やページと一緒に書き換わらないので、価格・提供内容（受託・協賛・収益化）と更新頻度を焼き込まない
const OFFER_IN_IMAGE = /[¥￥]|\d\s*円|\$\s?\d|受託|協賛|スポンサー|収益化|マネタイズ|単価/;

function imageTextProblems(texts) {
  const text = texts.join("\n");
  const hits = [...findForbiddenClaims(text), ...findHype(text)];
  const offer = text.match(OFFER_IN_IMAGE);
  if (offer) hits.push(`画像に価格・提供内容 ("${offer[0]}")`);
  const cadence = text.match(CADENCE_CLAIM_RE);
  if (cadence) hits.push(`画像に更新頻度 ("${cadence[0]}")`);
  return hits;
}

test("OGP 画像（SVG）の文字に、禁止表現・誇張・価格や提供内容・更新頻度が無い", () => {
  assert.ok(svgs.includes("public/og-card.svg") && svgs.some((f) => f.startsWith("public/ogp/")), "検査の対象が git の追跡ファイルから取れていない");
  const hits = [];
  for (const f of svgs) for (const h of imageTextProblems(svgTextNodes(readRepo(f)))) hits.push(`${f}: ${h}`);
  assert.deepEqual(hits, []);
});

test("画像の文字の検査は、価格・頻度・誇張を書き方を変えても拾う", () => {
  for (const ng of ["B2B協賛(¥100k〜)", "単発 980 円", "毎朝更新", "Daily digest", "爆発的に成長", "受託開発の窓口"]) {
    assert.ok(imageTextProblems([ng]).length > 0, ng);
  }
  assert.deepEqual(imageTextProblems(["README ベースの解説", "★ 2,400", "Rust ｜ OSS"]), []);
  assert.deepEqual(svgTextNodes('<text x="1">A &amp; <tspan>B</tspan></text><tspan>&#x5186;</tspan>'), ["A & B", "円"]);
  // 文字参照で書いた価格も拾う
  assert.ok(imageTextProblems(svgTextNodes("<text>980&#20870;</text>")).length > 0);
});

// 記事の frontmatter（ビルドと同じ書き方の範囲）
function frontmatterOf(md) {
  const fm = md.match(/^---\n([\s\S]*?)\n---/)?.[1] || "";
  const tags = fm.match(/^tags:\s*\[(.*?)\]/m)?.[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean) || [];
  return { tags };
}

test("記事の OGP 画像のカテゴリ表示は、記事のタグ（言語）から導いたもので、当てはまらなければ「未分類」", () => {
  assert.equal(categoryLabelOf([]), UNCATEGORIZED);
  assert.equal(categoryLabelOf(["Rust", "OSS"]), "RUST");
  assert.equal(categoryLabelOf(["OSS", "GitHub"]), UNCATEGORIZED, "汎用のタグはカテゴリにしない");
  // 記事の内容と無関係な決まり文句（キーワードの部分一致で選んだ「セキュア実行サンドボックス」など）を出さない
  const svg = renderOgSvg({ slug: "zz", title: "zz - A TV debloat tool with sandbox audit", desc: "sandbox audit fast agent model", tags: [], stars: 0 });
  const texts = svgTextNodes(svg);
  assert.ok(texts.some((t) => t.includes(UNCATEGORIZED)), texts.join(" / "));
  assert.deepEqual(imageTextProblems(texts), []);
  for (const t of texts) assert.doesNotMatch(t, /サンドボックス|エージェント基盤|超高速|生産性極大化|急上昇$/, t);

  const mismatched = [];
  for (const f of svgs.filter((x) => x.startsWith("public/ogp/"))) {
    const slug = path.basename(f, ".svg");
    const md = path.join(repoRoot, "src/pages/radar", `${slug}.md`);
    if (!fs.existsSync(md)) continue;
    const want = categoryLabelOf(frontmatterOf(normalizeEol(fs.readFileSync(md, "utf8"))).tags);
    if (!svgTextNodes(readRepo(f)).some((t) => t.includes(`｜ ${want}`))) mismatched.push(`${f}: ${want}`);
  }
  assert.deepEqual(mismatched, []);
});

const sha256 = (s) => crypto.createHash("sha256").update(normalizeEol(s)).digest("hex");

test("PNG は、同じ名前の SVG（生成に失敗した記事はサイト共通のカード）から作り直したもの（SVG を直して PNG が古いまま残らない）", () => {
  const siteCard = sha256(readRepo("public/og-card.svg"));
  const stale = [];
  for (const f of svgs) {
    const png = f.replace(/\.svg$/, ".png");
    if (!files.includes(png)) continue;
    const stamp = readPngText(fs.readFileSync(path.join(repoRoot, png)))[PNG_SOURCE_KEY];
    const own = sha256(readRepo(f));
    if (stamp !== own && !(f.startsWith("public/ogp/") && stamp === siteCard)) stale.push(`${png}: ${stamp ? "SVG と一致しない" : "元の SVG の記録が無い"}`);
  }
  assert.deepEqual(stale, []);
});
