// 配信物（astro build の出力 dist/）の「全部」を検査する。ファイルの一覧は手で書かず、dist を歩いて集める。テキストかどうかは中身で決める。
// 禁止表現・誇張表現の検査が記事本文や手で選んだファイルだけにかかっていると、meta description・RSS のチャンネル説明・
// 構造化データ（JSON-LD）・llms.txt・OGP 画像の文字のような「本文以外の公開テキスト」を素通りする（「毎朝」「マネタイズ実践法」「¥100k〜」が残った）。
// 文は「生の文字列」「文字参照を戻した文」「画面に出る文（タグで分けた語をつないだ形）」のすべてで読む（<strong>即</strong>受注 が素通りした）。
// あわせて、ページが述べる事実（掲載本数・週間ダイジェストの範囲・自動検査の内容・分類）を、記事データと検査の定義から導いた値と比べる。
// データから作った表示は data-derived を付けて出し、その値を検査する。それ以外の場所に掲載本数・頻度の主張を書かない
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { findForbiddenClaims, findSitePromises, WEB_ADOPTION_RULES, PUBLIC_CHECK_GROUPS } from "../scripts/utils/claims_check.mjs";
import { findHype } from "../scripts/utils/hype_check.mjs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";
import { cadenceFacts, CADENCE_CLAIM_RE, PUBLISH_COUNT_RE } from "../src/utils/cadence.js";
import { TOPIC_CATEGORIES, UNCATEGORIZED } from "../src/utils/categories.js";
import { jstDayStart, withinLastWeek, WEEK_DAYS } from "../src/utils/dates.js";
import { prepareBuildRoot, astroBuild, removeDir } from "./helpers/site_build.mjs";
import { readText } from "./helpers/read_src.mjs";
import { textViews, decodeEntities } from "./helpers/public_text.mjs";
import { isTextBuffer, derivedElements, removeDerived, operatorView, visibleLines } from "./helpers/dist_text.mjs";

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
const relOf = (f) => path.relative(out, f).split(path.sep).join("/");
const distTextFiles = () => walk(out).filter((f) => isTextBuffer(fs.readFileSync(f)));

function jsonStrings(v, acc = [], skipArrays = false) {
  if (typeof v === "string") acc.push(v);
  else if (Array.isArray(v)) {
    if (!skipArrays) for (const x of v) jsonStrings(x, acc, skipArrays);
  } else if (v && typeof v === "object") for (const x of Object.values(v)) jsonStrings(x, acc, skipArrays);
  return acc;
}
const parseJson = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined; // 壊れた JSON は配信物の監査（audit_dist）が止める。ここでは生の文字列だけで検査する
  }
};
const jsonLdBlocks = (raw) => [...raw.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// 生の文字列・文字参照を戻した文・画面に出る文・JSON の文字列値（\u 形式を戻したもの）
export function publicTextOf(file) {
  const raw = readText(file);
  const parts = textViews(raw);
  for (const j of /\.json$/i.test(file) ? [raw] : jsonLdBlocks(raw)) {
    const v = parseJson(j);
    if (v !== undefined) parts.push(jsonStrings(v).join("\n"));
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

test("配信物の全テキスト（HTML・meta・JSON-LD・RSS・llms.txt・API の JSON・SVG・CSS）に、禁止表現・誇張表現・導入を勧める表現が無い", () => {
  assertBuilt();
  const files = distTextFiles();
  const rel = files.map(relOf);
  for (const must of ["index.html", "rss.xml", "llms.txt", "api/radar.json", "og-card.svg", "about/index.html"]) {
    assert.ok(rel.includes(must), `検査の対象に ${must} が無い（dist を歩いて集められていない）`);
  }
  assert.ok(rel.some((f) => f.startsWith("ogp/") && f.endsWith(".svg")), "記事の OGP 画像（SVG）が検査の対象に無い");
  assert.ok(rel.some((f) => f.endsWith(".css")), "CSS が検査の対象に無い（テキストを拡張子で選んでいる）");
  const hits = [];
  files.forEach((f, i) => {
    for (const h of claimHits(publicTextOf(f))) hits.push(`${rel[i]}: ${h}`);
  });
  assert.deepEqual(hits, []);
});

test("検査は文字参照・JSON の \\u 形式・タグで分けた語で書かれた表現も拾う（書き方を変えても素通りしない）", () => {
  const dir = fs.mkdtempSync(path.join(buildRoot || root, "zz-probe-"));
  try {
    const html = path.join(dir, "a.html");
    fs.writeFileSync(html, `<script type="application/ld+json">{"d":"\\u6708\\u53ce100\\u4e07"}</script><p>&#x7206;&#x767a;的</p><p><strong>即</strong>受注のチャンス</p>`);
    const hits = claimHits(publicTextOf(html));
    assert.ok(hits.some((h) => h.includes("月収100万")), hits.join("\n"));
    assert.ok(hits.some((h) => h.includes("爆発的")), hits.join("\n"));
    assert.ok(hits.some((h) => h.includes("即受注")), hits.join("\n"));
  } finally {
    removeDir(dir);
  }
});

// 運営者の文（記事本文・記事のデータを除く）。API の JSON は記事の一覧（配列）を除いた部分、記事ごとの OGP 画像は tests/og_text が検査する
function operatorDistFiles() {
  return distTextFiles()
    .map((f) => ({ f, rel: relOf(f) }))
    .filter(({ rel }) => !rel.startsWith("ogp/") && !rel.startsWith("_astro/"));
}
// 記事のデータ（タイトル・説明文）は取り上げた OSS についての文で、一覧・カード・JSON-LD に出ても運営者の文ではない。
// どの文が記事のデータかは、記事の frontmatter（データ）から決める（一覧で省略した説明文は先頭 20 文字から行末まで）
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function withoutArticleData(line, articles) {
  let s = line;
  for (const a of articles) {
    for (const t of [a.title, ...String(a.title || "").split(" - "), a.description].filter((x) => x && x.length >= 4)) s = s.split(t).join(" ");
    if (a.description && a.description.length > 20) s = s.replace(new RegExp(`${escapeRe(a.description.slice(0, 20))}.*$`), " ");
  }
  return s;
}
function operatorTextOf(rel, raw, articles = []) {
  if (/\.json$/i.test(rel)) {
    const v = parseJson(raw);
    return v === undefined ? [raw] : jsonStrings(v, [], true);
  }
  // data-derived の要素は、別のテストが記事データ・検査の定義と一致することを確かめる
  const view = removeDerived(operatorView(rel, raw)).replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, "");
  const ld = jsonLdBlocks(raw).flatMap((j) => jsonStrings(parseJson(j) ?? j));
  return [...visibleLines(view), ...ld].map((l) => withoutArticleData(l, articles));
}
export function cadenceHitsIn(rel, raw, articles) {
  const hits = [];
  for (const line of operatorTextOf(rel, raw, articles)) {
    for (const re of [CADENCE_CLAIM_RE, PUBLISH_COUNT_RE]) {
      const m = line.match(re);
      if (m) hits.push(`${rel}: ${m[0]} ← ${line.slice(0, 80)}`);
    }
  }
  return hits;
}
export function promiseHitsIn(rel, raw, articles) {
  return operatorTextOf(rel, raw, articles).flatMap((line) => findSitePromises(line).map((h) => `${rel}: ${h} ← ${line.slice(0, 80)}`));
}

test("運営者の文（ページの見出し・案内・meta・JSON-LD・RSS のチャンネル・llms.txt）に、データから作った表示の外で更新頻度・掲載本数を書かない（文字列を連結して作った文も、画面に出る形で読む）", () => {
  assertBuilt();
  const files = operatorDistFiles();
  assert.ok(files.some(({ rel }) => rel === "llms.txt") && files.some(({ rel }) => rel === "rss.xml"));
  const articles = publishedArticles();
  assert.deepEqual(files.flatMap(({ f, rel }) => cadenceHitsIn(rel, readText(f), articles)), []);
});

test("運営者の文に、速さ・無料のサービス・検査の網羅を約束する表現が無い（即時・1秒で・無料相談・一切公開しません）", () => {
  assertBuilt();
  const articles = publishedArticles();
  assert.deepEqual(operatorDistFiles().flatMap(({ f, rel }) => promiseHitsIn(rel, readText(f), articles)), []);
  // 検査の一覧（data-derived）は定義から作るので上では読まない。定義の側の説明文（scope）にも約束の表現を書かない
  assert.deepEqual(PUBLIC_CHECK_GROUPS.flatMap((g) => findSitePromises(g.scope).map((h) => `${g.name}: ${h}`)), []);
});

test("運営者の文の検査は、Cadence の隣に手で書いた本数・連結で作った頻度・定義の隣に手で書いた保証を拾い、記事本文とデータから作った表示は拾わない", () => {
  const derived = '<span class="cadence" data-derived="cadence" data-derived-value="5">直近30日の掲載: 5本</span>';
  assert.deepEqual(cadenceHitsIn("index.html", `<div>${derived}</div>`), []);
  assert.ok(cadenceHitsIn("index.html", `<div>${derived}<div>直近30日の掲載: 99本</div></div>`).length > 0, "手で書いた本数");
  assert.ok(cadenceHitsIn("index.html", "<p>（毎<!-- -->日更新）</p>").length > 0, "連結・コメントで分けた頻度");
  assert.deepEqual(cadenceHitsIn("radar/x/index.html", '<article id="article-body"><p>毎日の業務を自動化する OSS</p></article>'), [], "記事本文は OSS についての文");
  assert.ok(cadenceHitsIn("radar/x/index.html", '<article id="article-body"><aside class="note-offer x">毎朝更新の有料版</aside></article>').length > 0, "本文の中の有料版の案内は運営者の文");
  assert.ok(promiseHitsIn("about/index.html", "<ul><li>誇張表現・結果を保証する表現は、言い回しにかかわらず一切公開しません。</li></ul>").length > 0);
  assert.ok(promiseHitsIn("about/index.html", "<p>あらゆる誇張を自動で取り除いています</p>").length > 0);
  assert.ok(promiseHitsIn("estimate/index.html", "<h1>即時見積もり</h1><a>この構成で無料相談する</a>").length >= 1);
  assert.deepEqual(promiseHitsIn("about/index.html", "<p>規則に無い言い回しは検出できません。</p>"), []);
  const art = [{ title: "fastx - 画像を瞬時に変換する CLI", description: "毎日の作業を瞬時に片付ける、画像変換のための小さなコマンドラインツールです" }];
  assert.deepEqual(promiseHitsIn("index.html", "<h3>fastx - 画像を瞬時に変換する CLI</h3><p>毎日の作業を瞬時に片付ける、画像変換のための小さな…</p>", art), [], "記事のデータ（タイトル・説明文）は OSS についての文");
  assert.ok(promiseHitsIn("index.html", "<h3>fastx - 画像を瞬時に変換する CLI</h3><p>瞬時にお届け</p>", art).length > 0, "記事のデータの隣の運営者の文は読む");
});

// 掲載中（ノイズ以外）の記事の公開日・タグ
function publishedArticles() {
  const dir = path.join(root, "src/pages/radar");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !isNoise(f.replace(/\.md$/, "")))
    .map((f) => {
      const md = readText(path.join(dir, f));
      const tags = md.match(/^tags:\s*\[(.*?)\]/m)?.[1].split(",").map((s) => s.replace(/["'\s]/g, "")).filter(Boolean) || [];
      const field = (k) => md.match(new RegExp(String.raw`^${k}:\s*["']?(.*?)["']?\s*$`, "m"))?.[1] || "";
      return { slug: f.replace(/\.md$/, ""), date: md.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)?.[1], tags, title: field("title"), description: field("description") };
    })
    .filter((x) => x.date);
}

// data-derived の種類ごとの正しい値（記事データ・定数から導く）。知らない種類は通さない（手で書いた文に印だけ付けて検査を逃れない）
function expectedDerived() {
  const dates = publishedArticles().map((x) => x.date);
  return {
    // ビルドの開始時と今とで日付をまたいでも、どちらかの時点の値なら正しい
    cadence: new Set([cadenceFacts(dates, builtAt).count, cadenceFacts(dates, Date.now()).count].map(String)),
    "weekly-window": new Set([String(WEEK_DAYS)]),
    checks: new Set([String(PUBLIC_CHECK_GROUPS.length)]),
  };
}

test("データから作った表示（data-derived）は、どのページでも記事データ・定数から導いた値と一致し、表示の文にもその値が出ている", () => {
  assertBuilt();
  const expected = expectedDerived();
  const seen = new Set();
  const wrong = [];
  for (const f of walk(out).filter((x) => x.endsWith(".html"))) {
    const rel = relOf(f);
    for (const el of derivedElements(readText(f))) {
      seen.add(`${el.kind}@${rel.startsWith("radar/") ? "radar/" : rel}`);
      const ok = expected[el.kind];
      if (!ok) wrong.push(`${rel}: 知らない種類 ${el.kind}`);
      else if (!ok.has(el.value)) wrong.push(`${rel}: ${el.kind}=${el.value}（正しい値 ${[...ok].join("/")}）`);
      else if (el.kind !== "checks" && !new RegExp(`(?<!\\d)${el.value}(?!\\d)`).test(el.text)) wrong.push(`${rel}: ${el.kind} の表示「${el.text}」に値 ${el.value} が無い`);
    }
  }
  for (const must of ["cadence@index.html", "cadence@radar/", "weekly-window@weekly/index.html", "checks@about/index.html"]) assert.ok(seen.has(must), `${must} にデータから作った表示が無い`);
  assert.deepEqual(wrong, []);
});

test("週間ダイジェストは、直近 WEEK_DAYS 日（日本時間・今日を含む）に公開した記事をすべて載せ、それ以外を載せない（件数で切らない）", () => {
  assertBuilt();
  const html = readText(path.join(out, "weekly/index.html"));
  const listed = new Set([...html.matchAll(/href="\/auto-tech-radar\/radar\/([^/"]+)\/"/g)].map((m) => m[1]));
  const within = (now) => new Set(publishedArticles().filter((x) => withinLastWeek(jstDayStart(x.date), now)).map((x) => x.slug));
  const a = within(builtAt);
  const b = within(Date.now());
  const same = (s) => s.size === listed.size && [...s].every((x) => listed.has(x));
  assert.ok(same(a) || same(b), `週間ダイジェスト: 載っている ${[...listed].sort().join(",")} / 直近${WEEK_DAYS}日 ${[...a].sort().join(",")}`);
});

test("運営方針ページの「自動で検査していること」は、検査の定義（claims_check の規則）だけから作られ、全規則の理由が載り、定義に無い項目が混ざらない", () => {
  assertBuilt();
  const html = readText(path.join(out, "about/index.html"));
  const text = decodeEntities(html);
  assert.ok(PUBLIC_CHECK_GROUPS.length >= 4, "検査の定義の一覧が読めない");
  const missing = [];
  for (const g of PUBLIC_CHECK_GROUPS) {
    if (!text.includes(g.name)) missing.push(g.name);
    for (const r of g.rules) if (!text.includes(r.why)) missing.push(`${g.name}: ${r.why}`);
  }
  assert.deepEqual(missing, []);
  const list = derivedElements(html).find((el) => el.kind === "checks");
  assert.ok(list, "検査の一覧に data-derived が無い");
  const listHtml = html.slice(list.start, list.end);
  const items = [...listHtml.matchAll(/<li\b/g)].length;
  const fromDefinition = PUBLIC_CHECK_GROUPS.reduce((n, g) => n + 1 + g.rules.length, 0);
  assert.equal(items, fromDefinition, "検査の一覧の項目数が定義から作った数と違う（手で書いた項目が混ざっている）");
});

// 分類の期待値: 記事のタグ（小文字）に、分類の定義のタグがそのまま含まれるか（部分一致ではない）。src/utils/categories.js の実装とは別に、定義のデータから導く
const expectedCategory = (tags) => {
  const have = new Set(tags.map((t) => t.toLowerCase()));
  return TOPIC_CATEGORIES.find((c) => c.tags.some((t) => have.has(t))) || { key: "none", label: UNCATEGORIZED };
};

test("分類（チートシートの列・レーダーマップの象限・トップの絞り込み）は記事のタグの完全一致から導き、当てはまらない記事は「未分類」（既定の分類・部分一致に入れない）", () => {
  assertBuilt();
  const articles = publishedArticles().map((a) => ({ ...a, cat: expectedCategory(a.tags) }));
  assert.ok(articles.some((a) => a.cat.label === UNCATEGORIZED), "タグに当てはまらない記事で確かめる");
  const link = (slug) => `/auto-tech-radar/radar/${slug}/`;
  const cheat = readText(path.join(out, "cheatsheet/index.html")).split('<tr class="matrix-row"').slice(1);
  const map = readText(path.join(out, "radar-map/index.html")).split("<h4").slice(1);
  const index = readText(path.join(out, "index.html"));
  const cards = index.split('<article class="post-card"').slice(1);
  const wrong = [];
  for (const a of articles) {
    const row = cheat.find((r) => r.includes(`href="${link(a.slug)}"`));
    const cell = (row || "").match(/<span[^>]*data-category[^>]*>\s*([^<]*?)\s*<\/span>/)?.[1];
    if (cell !== a.cat.label) wrong.push(`cheatsheet ${a.slug}: ${cell} ≠ ${a.cat.label}`);
    const section = map.find((s) => s.includes(`href="${link(a.slug)}"`));
    const heading = (section || "").match(/^[^>]*>([\s\S]*?)<\/h4>/)?.[1].trim();
    if (!heading || !heading.includes(a.cat.label)) wrong.push(`radar-map ${a.slug}: ${heading} ≠ ${a.cat.label}`);
    const card = cards.find((c) => c.includes(`href="${link(a.slug)}"`));
    const key = (card || "").match(/^[^>]*\bdata-category="([^"]*)"/)?.[1];
    if (key !== a.cat.key) wrong.push(`index ${a.slug}: ${key} ≠ ${a.cat.key}`);
  }
  assert.deepEqual(wrong, []);
  // トップの絞り込みのボタンは分類の定義そのもの（手で書いた分類名を出さない）
  const pills = [...index.matchAll(/<button class="cat-pill[^"]*" data-cat="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => [m[1], decodeEntities(m[2]).trim()]);
  const want = [["", "すべて"], ...TOPIC_CATEGORIES.map((c) => [c.key, c.label]), ["none", UNCATEGORIZED]];
  assert.deepEqual(pills, want);
});
