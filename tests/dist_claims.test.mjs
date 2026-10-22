// 配信物（astro build の出力 dist/）の「全部」を検査する。ファイルの一覧は手で書かず、dist を歩いて集める。
// 禁止表現・誇張表現の検査が記事本文や手で選んだファイルだけにかかっていると、meta description・RSS のチャンネル説明・
// 構造化データ（JSON-LD）・llms.txt・OGP 画像の文字のような「本文以外の公開テキスト」を素通りする（「毎朝」「マネタイズ実践法」「¥100k〜」が残った）。
// あわせて、ページが述べる事実（掲載本数・週間ダイジェストの範囲・自動検査の内容）を、記事データと検査の定義から導いた値と比べる
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { findForbiddenClaims, WEB_ADOPTION_RULES, PUBLIC_CHECK_GROUPS } from "../scripts/utils/claims_check.mjs";
import { findHype } from "../scripts/utils/hype_check.mjs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";
import { cadenceFacts } from "../src/utils/cadence.js";
import { jstDayStart, withinLastWeek } from "../src/utils/dates.js";
import { prepareBuildRoot, astroBuild, removeDir } from "./helpers/site_build.mjs";
import { readText } from "./helpers/read_src.mjs";

const root = path.resolve(import.meta.dirname, "..");
let buildRoot = "";
let out = "";
let build = null;
let builtAt = 0;
before(() => {
  builtAt = Date.now();
  buildRoot = prepareBuildRoot("atr-claims-");
  out = path.join(buildRoot, "dist");
  build = astroBuild(buildRoot, out);
});
after(() => {
  if (buildRoot) removeDir(buildRoot);
});
const assertBuilt = () => assert.equal(build?.status, 0, `astro build が失敗: ${(build?.stderr || "") + (build?.stdout || "")}`.slice(0, 4000));

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const TEXT_EXT = /\.(html|xml|txt|json|svg|webmanifest)$/i;

// 文字参照（&amp; &#12354; &#x3042;）を戻した文と、JSON の文字列値（\u 形式を戻したもの）も検査に含める
const decodeEntities = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[n]);
function jsonStrings(v, acc = []) {
  if (typeof v === "string") acc.push(v);
  else if (v && typeof v === "object") for (const x of Object.values(v)) jsonStrings(x, acc);
  return acc;
}
export function publicTextOf(file) {
  const raw = readText(file);
  const parts = [raw, decodeEntities(raw)];
  const jsons = /\.json$/i.test(file) ? [raw] : [...raw.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  for (const j of jsons) {
    try {
      parts.push(jsonStrings(JSON.parse(j)).join("\n"));
    } catch {
      // 壊れた JSON は配信物の監査（audit_dist）が止める。ここでは生の文字列だけで検査する
    }
  }
  return parts.join("\n");
}

export function claimHits(text) {
  const hits = [...findForbiddenClaims(text), ...findHype(text)];
  for (const [re, why] of WEB_ADOPTION_RULES) {
    const m = text.match(re);
    if (m) hits.push(`${why} ("${m[0]}")`);
  }
  return hits;
}

test("配信物の全テキスト（HTML・meta・JSON-LD・RSS・llms.txt・API の JSON・SVG）に、禁止表現・誇張表現・導入を勧める表現が無い", () => {
  assertBuilt();
  const files = walk(out).filter((f) => TEXT_EXT.test(f));
  const rel = files.map((f) => path.relative(out, f).split(path.sep).join("/"));
  for (const must of ["index.html", "rss.xml", "llms.txt", "api/radar.json", "og-card.svg", "about/index.html"]) {
    assert.ok(rel.includes(must), `検査の対象に ${must} が無い（dist を歩いて集められていない）`);
  }
  assert.ok(rel.some((f) => f.startsWith("ogp/") && f.endsWith(".svg")), "記事の OGP 画像（SVG）が検査の対象に無い");
  const hits = [];
  files.forEach((f, i) => {
    for (const h of claimHits(publicTextOf(f))) hits.push(`${rel[i]}: ${h}`);
  });
  assert.deepEqual(hits, []);
});

test("検査は文字参照や JSON の \\u 形式で書かれた表現も拾う（書き方を変えても素通りしない）", () => {
  const dir = fs.mkdtempSync(path.join(buildRoot || root, "zz-probe-"));
  try {
    const html = path.join(dir, "a.html");
    fs.writeFileSync(html, `<script type="application/ld+json">{"d":"\\u6708\\u53ce100\\u4e07"}</script><p>&#x7206;&#x767a;的</p>`);
    const hits = claimHits(publicTextOf(html));
    assert.ok(hits.some((h) => h.includes("月収100万")), hits.join("\n"));
    assert.ok(hits.some((h) => h.includes("爆発的")), hits.join("\n"));
  } finally {
    removeDir(dir);
  }
});

// 掲載中（ノイズ以外）の記事の公開日
function publishedDates() {
  const dir = path.join(root, "src/pages/radar");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !isNoise(f.replace(/\.md$/, "")))
    .map((f) => ({ slug: f.replace(/\.md$/, ""), date: readText(path.join(dir, f)).match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1] }))
    .filter((x) => x.date);
}

test("どのページの掲載本数の表示も、記事データ（公開日）から数えた値と一致する（手書きの「毎日更新」を出さない）", () => {
  assertBuilt();
  const dates = publishedDates().map((x) => x.date);
  // ビルドの開始時と今とで日付をまたいでも、どちらかの時点の値なら正しい
  const expected = new Set([cadenceFacts(dates, builtAt).count, cadenceFacts(dates, Date.now()).count]);
  const pages = walk(out).filter((f) => f.endsWith(".html"));
  const shown = [];
  for (const f of pages) {
    for (const m of readText(f).matchAll(/data-cadence-count="(\d+)"/g)) shown.push([path.relative(out, f), Number(m[1])]);
  }
  const relPages = new Set(shown.map(([f]) => f.split(path.sep).join("/")));
  assert.ok(relPages.has("index.html"), "トップページに掲載本数の表示が無い");
  assert.ok([...relPages].some((f) => f.startsWith("radar/")), "記事ページに掲載本数の表示が無い");
  for (const [f, n] of shown) assert.ok(expected.has(n), `${f}: 掲載本数 ${n} が記事データの値 ${[...expected].join("/")} と一致しない`);
});

test("週間ダイジェストは、直近7日（日本時間・今日を含む）に公開した記事をすべて載せ、それ以外を載せない（件数で切らない）", () => {
  assertBuilt();
  const html = readText(path.join(out, "weekly/index.html"));
  const listed = new Set([...html.matchAll(/href="\/auto-tech-radar\/radar\/([^/"]+)\/"/g)].map((m) => m[1]));
  const within = (now) => new Set(publishedDates().filter((x) => withinLastWeek(jstDayStart(x.date), now)).map((x) => x.slug));
  const a = within(builtAt);
  const b = within(Date.now());
  const same = (s) => s.size === listed.size && [...s].every((x) => listed.has(x));
  assert.ok(same(a) || same(b), `週間ダイジェスト: 載っている ${[...listed].sort().join(",")} / 直近7日 ${[...a].sort().join(",")}`);
});

test("運営方針ページの「自動で検査していること」は、検査の定義（claims_check の規則）から作られ、全規則の理由が載る", () => {
  assertBuilt();
  const text = decodeEntities(readText(path.join(out, "about/index.html")));
  assert.ok(PUBLIC_CHECK_GROUPS.length >= 4, "検査の定義の一覧が読めない");
  const missing = [];
  for (const g of PUBLIC_CHECK_GROUPS) {
    if (!text.includes(g.name)) missing.push(g.name);
    for (const r of g.rules) if (!text.includes(r.why)) missing.push(`${g.name}: ${r.why}`);
  }
  assert.deepEqual(missing, []);
  // 一覧は定義から作る（手で書いた一覧は定義より広い範囲を保証してしまう。「誇張表現は公開しません」と書いて「革新的」「極限」が残った）
  const src = readText(path.join(root, "src/pages/about.astro"));
  assert.match(src, /PUBLIC_CHECK_GROUPS\.map/, "about.astro が検査の定義から一覧を作っていない");
});

test("分類（チートシートの列・レーダーマップの象限）は記事のタグから導き、当てはまらない記事は「未分類」（既定の分類に入れない）", async () => {
  assertBuilt();
  const { categoryOf, UNCATEGORIZED } = await import("../src/utils/categories.js");
  const dir = path.join(root, "src/pages/radar");
  const articles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !isNoise(f.replace(/\.md$/, "")))
    .map((f) => {
      const tags = readText(path.join(dir, f)).match(/^tags:\s*\[(.*?)\]/m)?.[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean) || [];
      return { slug: f.replace(/\.md$/, ""), label: categoryOf(tags).label };
    });
  assert.ok(articles.some((a) => a.label === UNCATEGORIZED), "タグに当てはまらない記事で確かめる");
  const link = (slug) => `/auto-tech-radar/radar/${slug}/`;
  const cheat = readText(path.join(out, "cheatsheet/index.html")).split('<tr class="matrix-row"').slice(1);
  const map = readText(path.join(out, "radar-map/index.html")).split("<h4").slice(1);
  const wrong = [];
  for (const a of articles) {
    const row = cheat.find((r) => r.includes(`href="${link(a.slug)}"`));
    const cell = (row || "").match(/<span[^>]*data-category[^>]*>\s*([^<]*?)\s*<\/span>/)?.[1];
    if (cell !== a.label) wrong.push(`cheatsheet ${a.slug}: ${cell} ≠ ${a.label}`);
    const section = map.find((s) => s.includes(`href="${link(a.slug)}"`));
    const heading = (section || "").match(/^[^>]*>([\s\S]*?)<\/h4>/)?.[1].trim();
    if (!heading || !heading.includes(a.label)) wrong.push(`radar-map ${a.slug}: ${heading} ≠ ${a.label}`);
  }
  assert.deepEqual(wrong, []);
});
