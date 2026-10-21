// 配信サイト（astro build の出力）を、実際のビルド結果と「わざと崩した記事」のビルド結果で確かめる。
// - スマホ幅（320px）で横スクロールが出ないこと（記事本文の表・長い URL を含む）
// - 記事の構造化データ（JSON-LD）が壊れず、タイトルの </script> などで本文に任意のスクリプトが入らないこと
// - 日付・スター数・内部リンク・OGP 画像が、記事の frontmatter が少し変わっていても正しく出ること
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { dateLabel, jstDayStart, withinLastWeek } from "../src/utils/dates.js";
import { dateModifiedOf, datePublishedOf, jsonLdText, tagsOf, noteOfferFor, ellipsis } from "../src/utils/article_page.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(p, "utf8");
const astroBin = path.join(root, "node_modules", "astro", JSON.parse(read(path.join(root, "node_modules/astro/package.json"))).bin.astro);

function astroBuild(cwd, outDir) {
  return spawnSync(process.execPath, [astroBin, "build", "--outDir", outDir], { cwd, encoding: "utf8", timeout: 240000 });
}

function htmlFiles(dir) {
  const out = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) out.push(p);
  });
  walk(dir);
  return out;
}

// ---- 実際のサイトのビルド ----
let siteOut = "";
let siteBuild = null;
before(() => {
  siteOut = fs.mkdtempSync(path.join(os.tmpdir(), "atr-dist-"));
  siteBuild = astroBuild(root, siteOut);
});
after(() => {
  if (siteOut) fs.rmSync(siteOut, { recursive: true, force: true });
});
const assertSiteBuilt = () => assert.equal(siteBuild?.status, 0, `astro build が失敗: ${(siteBuild?.stderr || "") + (siteBuild?.stdout || "")}`.slice(0, 4000));

test("Layout のスタイルは is:global（Markdown 本文・スクリプトが作る要素・各ページの .post-card に当たる）", () => {
  // スコープ付き（<style>）だと set:html で入れた本文の表・コードにスタイルが当たらず、スマホで表が画面幅を超えた
  const layout = read(path.join(root, "src/layouts/Layout.astro"));
  const styles = [...layout.matchAll(/<style\b([^>]*)>/g)].map((m) => m[1]);
  assert.ok(styles.length > 0);
  for (const attrs of styles) assert.match(attrs, /\bis:global\b/, "Layout.astro の <style> に is:global が無い");
});

test("日付は引用符の有無によらず YYYY-MM-DD、時刻は日本時間のその日の 0 時、週間ダイジェストは今日を含む 7 日間", () => {
  assert.equal(dateLabel("2026-10-21"), "2026-10-21");
  assert.equal(dateLabel(new Date("2026-10-21")), "2026-10-21"); // YAML の引用符なしの日付
  assert.equal(dateLabel(""), null);
  assert.equal(dateLabel(undefined), null);
  assert.equal(dateLabel("2026-13-45"), null);
  assert.equal(jstDayStart("2026-10-21"), Date.parse("2026-10-20T15:00:00Z"));
  assert.equal(jstDayStart(new Date("2026-10-21")), Date.parse("2026-10-20T15:00:00Z"));
  // 定期実行（日本時間 6:17）のビルドで、10/15〜10/21 の 7 日分だけが入る
  const now = Date.parse("2026-10-21T06:17:00+09:00");
  assert.equal(withinLastWeek(jstDayStart("2026-10-21"), now), true);
  assert.equal(withinLastWeek(jstDayStart("2026-10-15"), now), true);
  assert.equal(withinLastWeek(jstDayStart("2026-10-14"), now), false);
  assert.equal(withinLastWeek(jstDayStart("2026-10-22"), now), false);
  assert.equal(withinLastWeek(null, now), false);
  // 構造化データの日付も同じ形にそろえ、無ければ出さない（固定の日付で代用しない）
  assert.equal(dateModifiedOf({ pubDate: new Date("2026-10-16"), updatedDate: new Date("2026-10-20") }), "2026-10-20");
  assert.equal(datePublishedOf({ pubDate: new Date("2026-10-16") }), "2026-10-16");
  assert.equal(datePublishedOf({}), undefined);
  assert.doesNotMatch(read(path.join(root, "src/layouts/Layout.astro")), /"datePublished":[^\n]*"20\d\d-\d\d-\d\d"/);
});

test("構造化データの文字列は < > & を \\u 形式にし、JSON としては元の値のまま読める", () => {
  const title = 'x </script><script>alert(1)</script> & "q" <!-- c';
  const text = jsonLdText({ headline: title });
  assert.doesNotMatch(text, /[<>&]/);
  assert.equal(JSON.parse(text).headline, title);
  assert.deepEqual(tagsOf({ tags: ["Go", "OSS"] }), ["Go", "OSS"]);
  assert.deepEqual(tagsOf({ tags: "Go, OSS" }), ["Go", "OSS"]);
  assert.deepEqual(tagsOf({}), []);
});

test("note の価格が数値でない（\"¥980\"・\"abc\"）・負の値なら、見出しに価格を出さない（「¥NaN」にしない）", () => {
  const url = "https://note.com/x/n/n1";
  for (const price of ["¥980", "abc", -980, Infinity, true, {}]) {
    const o = noteOfferFor("z", { z: { url, price } }, undefined);
    assert.equal(o.heading, "有料版（note）に含まれるもの", String(price));
    assert.equal(o.priceLabel, "");
  }
  assert.equal(noteOfferFor("z", { z: { url, price: "980" } }, undefined).priceLabel, "¥980");
  assert.equal(noteOfferFor("z", { z: { url, price: 1480 } }, undefined).priceLabel, "¥1,480");
});

test("関連記事・新着ピックアップのタイトルは、長いものだけを切って「...」を付ける", () => {
  assert.equal(ellipsis("kev - short", 50), "kev - short");
  assert.equal(ellipsis("x".repeat(51), 50), `${"x".repeat(50)}...`);
  assertSiteBuilt();
  const titles = new Map();
  const radarDir = path.join(root, "src/pages/radar");
  for (const f of fs.readdirSync(radarDir).filter((x) => x.endsWith(".md"))) {
    const t = read(path.join(radarDir, f)).match(/^title:\s*"(.*)"\s*$/m)?.[1];
    if (t) titles.set(t.slice(0, 40), t);
  }
  for (const f of htmlFiles(siteOut)) {
    for (const m of read(f).matchAll(/>([^<>]{1,60})\.\.\.<\/a>/g)) {
      const shown = m[1].trim().replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const full = titles.get(shown.slice(0, 40));
      if (full) assert.ok(full.length > shown.length, `${path.relative(siteOut, f)}: 切れていないタイトルに「...」: ${shown}`);
    }
  }
});

test("実際のビルド: RSS の日付は日本時間の公開日の 0 時、記事への内部リンクは末尾スラッシュ付き、配信物の監査に合格する", () => {
  assertSiteBuilt();
  const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), siteOut], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout + r.stderr).split("\n").filter((l) => l.includes("❌")).slice(0, 20).join("\n"));
  const rss = read(path.join(siteOut, "rss.xml"));
  const radarDir = path.join(root, "src/pages/radar");
  const md = read(path.join(radarDir, fs.readdirSync(radarDir).find((f) => f.endsWith(".md"))));
  const slug = fs.readdirSync(radarDir).find((f) => f.endsWith(".md")).replace(/\.md$/, "");
  const pub = md.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m)[1];
  const item = rss.split("<item>").find((it) => it.includes(`/radar/${slug}/</link>`));
  assert.ok(item, `${slug} が RSS に無い`);
  assert.equal(item.match(/<pubDate>([^<]+)<\/pubDate>/)[1], new Date(`${pub}T00:00:00+09:00`).toUTCString());
  for (const f of htmlFiles(siteOut)) {
    assert.doesNotMatch(read(f), /href="\/auto-tech-radar\/radar\/[a-z0-9_.-]+"/, `${path.relative(siteOut, f)}: 末尾スラッシュの無い記事リンク`);
  }
});

// ---- 表示している主張が記事の中身と合っている ----
// 記事に無い節を「付き」と書かない・README しか読んでいないのに「コードを解析」と書かない・誇張しない
const UNSUPPORTED = [
  [/英語コードをAIが直接解析|コードをAIが直接解析/, "記事は README などの公開情報から作っており、コードは解析していない"],
  [/商用手順書/, "Web 記事に商用の手順書は無い（実務キットは note の有料版）"],
  [/完全解剖/, "README をもとにした解説を「完全解剖」と呼ばない"],
  [/急増中/, "スター数の推移を確かめずに「急増中」と書かない"],
  [/Media Kit|メディアキット/, "スポンサーの媒体資料（読者数など）は公開していない"],
];

test("配信物（HTML・llms.txt）に、記事の中身で裏付けられない表示が無い", () => {
  assertSiteBuilt();
  const hits = [];
  for (const f of [...htmlFiles(siteOut), path.join(siteOut, "llms.txt")]) {
    const text = read(f);
    for (const [re, why] of UNSUPPORTED) if (re.test(text)) hits.push(`${path.relative(siteOut, f)}: ${why}（${text.match(re)[0]}）`);
  }
  assert.deepEqual(hits, []);
});

test("llms.txt が「各技術レポートにある」と書く節は、すべての記事に見出しとしてある", () => {
  const llms = read(path.join(root, "public/llms.txt"));
  const section = llms.split(/^## /m).find((s) => s.startsWith("主な提供コンテンツと構造")) || "";
  const names = [...section.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)].map((m) => m[1]);
  assert.ok(names.length >= 3, "llms.txt の節の一覧が読めない");
  const radarDir = path.join(root, "src/pages/radar");
  const missing = [];
  for (const f of fs.readdirSync(radarDir).filter((x) => x.endsWith(".md"))) {
    const heads = [...read(path.join(radarDir, f)).matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
    for (const n of names) if (!heads.some((h) => h.includes(n))) missing.push(`${f}: ${n}`);
  }
  assert.deepEqual(missing, []);
});

// 記事ページのスクリプト（目次・メタバー・要約）を jsdom で実行し、バッジの表示を確かめる
async function runArticleScripts(html) {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(html, {
    url: "https://ssk0224.github.io/auto-tech-radar/radar/x/",
    runScripts: "dangerously",
    beforeParse(window) {
      Object.defineProperty(window.HTMLElement.prototype, "innerText", { get() { return this.textContent; }, configurable: true });
      window.scrollTo = () => {};
    },
  });
  return dom.window.document;
}

test("「商用・マネタイズ分析付き」「活用領域」の表示は、本文にマネタイズの節がある記事だけ", async () => {
  assertSiteBuilt();
  const radarDir = path.join(root, "src/pages/radar");
  const slugs = fs.readdirSync(radarDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  const hasSection = (slug) => /^##\s+.*マネタイズ/m.test(read(path.join(radarDir, `${slug}.md`)));
  const withSection = slugs.filter(hasSection);
  const without = slugs.filter((s) => !hasSection(s));
  assert.ok(withSection.length > 0 && without.length > 0, "節のある記事と無い記事の両方で確かめる");
  for (const slug of [withSection[0], ...without]) {
    const doc = await runArticleScripts(read(path.join(siteOut, "radar", slug, "index.html")));
    const bar = doc.querySelector(".reading-meta-bar");
    assert.ok(bar, `${slug}: メタバーが作られていない`);
    const text = doc.getElementById("article-body").textContent;
    assert.equal(text.includes("商用・マネタイズ分析付き"), hasSection(slug), `${slug}: 「商用・マネタイズ分析付き」の表示が本文と合わない`);
    assert.equal(text.includes("活用領域: 受託開発"), hasSection(slug), `${slug}: 「活用領域」の表示が本文と合わない`);
    assert.ok(text.includes("スター数区分"), `${slug}: スター数区分のバッジが無い`);
  }
});

// ---- わざと崩した記事（GitHub の説明そのままのタイトル・引用符なしの日付・スター 0・OGP 画像なし・tags が文字列）でビルドする ----
const PROBE_SLUG = "zz-probe-oddities";
const PROBE_TITLE = 'zz-probe - Render </script><script>window.__pwned=1</script> & "quotes" <!-- x';
const PROBE_MD = `---
layout: "../../layouts/Layout.astro"
title: ${JSON.stringify(PROBE_TITLE)}
description: "Desc with </script> and <b>tags</b> & ampersand"
pubDate: 2026-10-20
tags: "Go, OSS"
repoUrl: "https://github.com/example/zz-probe-oddities"
stars: 0
---

# zz-probe: 概要と革新性

導入文です。https://example.com/a/very/long/path/that/does/not/contain/any/break/opportunity/at/all/for/narrow/screens

## 解決する主要な課題とアーキテクチャ

| 評価軸 | zz-probe (OSS) | 商用SaaS（例: とても長い製品名のサービス） | 他のOSS（例: 別の長い名前のプロジェクト） |
|---|---|---|---|
| ライセンス | MIT（LICENSE ファイル） | プロプライエタリ（月額課金） | Apache-2.0 / MIT デュアルライセンス |
`;
let probeRoot = "";
let probeOut = "";
let probeBuild = null;
before(() => {
  probeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atr-probe-"));
  for (const d of ["node_modules", "public", "scripts", "data", "note_drafts"]) fs.symlinkSync(path.join(root, d), path.join(probeRoot, d), "dir");
  for (const f of ["astro.config.mjs", "package.json"]) fs.copyFileSync(path.join(root, f), path.join(probeRoot, f));
  fs.cpSync(path.join(root, "src"), path.join(probeRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(probeRoot, "src/pages/radar", `${PROBE_SLUG}.md`), PROBE_MD);
  probeOut = path.join(probeRoot, "dist");
  probeBuild = astroBuild(probeRoot, probeOut);
});
after(() => {
  if (probeRoot) fs.rmSync(probeRoot, { recursive: true, force: true });
});
const assertProbeBuilt = () => assert.equal(probeBuild?.status, 0, `astro build が失敗: ${(probeBuild?.stderr || "") + (probeBuild?.stdout || "")}`.slice(0, 4000));
const probePage = (rel) => read(path.join(probeOut, rel));

test("崩した記事: タイトルの </script> で構造化データが閉じず、値は JSON として元のタイトルのまま", () => {
  assertProbeBuilt();
  const html = probePage(`radar/${PROBE_SLUG}/index.html`);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(blocks.length, 1);
  const ld = JSON.parse(blocks[0]);
  assert.equal(ld.headline, PROBE_TITLE);
  // 属性値（"…" の中）の < はただの文字なので除いて見る
  assert.ok(!html.replace(/="[^"]*"/g, '=""').includes("<script>window.__pwned=1</script>"), "タイトルのスクリプトがそのまま HTML に入っている");
  // 日付は YYYY-MM-DD（Date の文字列にしない）、画像は実在するもの
  assert.equal(ld.datePublished, "2026-10-20");
  assert.equal(ld.dateModified, "2026-10-20");
  assert.equal(ld.image, "https://ssk0224.github.io/auto-tech-radar/og-card.png");
  assert.equal(ld.keywords, "Go, OSS");
  assert.match(html, /<meta property="og:image" content="https:\/\/ssk0224\.github\.io\/auto-tech-radar\/og-card\.png"/);
});

test("崩した記事: 一覧・週間・API・チートシートに Date の文字列や根拠のない「急増中」を出さず、配信物の監査に合格する", () => {
  assertProbeBuilt();
  const api = JSON.parse(probePage("api/radar.json"));
  const item = api.data.find((d) => d.slug === PROBE_SLUG);
  assert.equal(item.pubDate, "2026-10-20");
  assert.deepEqual(item.tags, ["Go", "OSS"]);
  for (const rel of ["index.html", "weekly/index.html", "cheatsheet/index.html", `radar/${PROBE_SLUG}/index.html`]) {
    if (!fs.existsSync(path.join(probeOut, rel))) continue;
    const html = probePage(rel);
    assert.doesNotMatch(html, /T00:00:00\.000Z|GMT[+-]\d{4}/, `${rel}: 日付が Date の文字列のまま`);
  }
  assert.ok(!probePage("cheatsheet/index.html").includes("急増中"), "スター数が 0・不明の記事に「急増中」と出している");
  // 一覧のサムネイルも、OGP 画像の無い記事は共通カードを使う（存在しない画像を参照しない）
  assert.ok(!probePage("index.html").includes(`/ogp/${PROBE_SLUG}.png`));
  const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), probeOut], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout + r.stderr).split("\n").filter((l) => l.includes("❌")).slice(0, 20).join("\n"));
});

test("配信物の監査は、壊れた構造化データ・存在しない OGP 画像・末尾スラッシュの無い記事リンク・Date の文字列を止める", () => {
  assertProbeBuilt();
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), "atr-broken-"));
  try {
    fs.cpSync(probeOut, broken, { recursive: true });
    const rel = `radar/${PROBE_SLUG}/index.html`;
    let html = read(path.join(broken, rel));
    html = html.replace(/(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/, `$1{"@type":"TechArticle","headline":"a </script><script>x()</script>"}$2`);
    html = html.replace(/og-card\.png/g, `ogp/${PROBE_SLUG}.png`);
    html = html.replace(/(<article id="article-body"[^>]*>)/, '$1<p><img alt="" onerror="alert(1)"></p>');
    html = html.replace("</main>", `<a href="/auto-tech-radar/radar/${PROBE_SLUG}">x</a><span>Tue Oct 20 2026 09:00:00 GMT+0900 (日本標準時)</span><p>有料版（note ¥NaN）</p></main>`);
    fs.writeFileSync(path.join(broken, rel), html);
    const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), broken], { cwd: root, encoding: "utf8" });
    const out = r.stdout + r.stderr;
    assert.notEqual(r.status, 0);
    for (const s of ["JSON-LD", "404 DEAD LINK", "NO TRAILING SLASH", "Date の文字列", "NaN / undefined", "スクリプトを動かす"]) assert.ok(out.includes(s), `${s} を検出していない\n${out.slice(0, 3000)}`);
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
  }
});

test("配信物の監査は、記事一覧（サイトマップ・RSS・API）と実際の記事ページの食い違い・取り下げた記事へのリンクを止める", () => {
  assertProbeBuilt();
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), "atr-feeds-"));
  try {
    fs.cpSync(probeOut, broken, { recursive: true });
    // 記事ページを消したのに、サイトマップ・RSS・API には残っている
    fs.rmSync(path.join(broken, "radar", PROBE_SLUG), { recursive: true });
    fs.appendFileSync(path.join(broken, "llms.txt"), "\n- https://ssk0224.github.io/auto-tech-radar/radar/nixpkgs/\n");
    const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), broken], { cwd: root, encoding: "utf8" });
    const out = r.stdout + r.stderr;
    assert.notEqual(r.status, 0);
    for (const s of ["サイトマップの URL が実在しません", "RSS の項目のリンクが実在しません", "api/radar.json に記事一覧に無い URL", "トップページの記事数の表示", "取り下げた記事 nixpkgs"]) {
      assert.ok(out.includes(s), `${s} を検出していない\n${out.split("\n").filter((l) => l.includes("❌")).join("\n").slice(0, 3000)}`);
    }
  } finally {
    fs.rmSync(broken, { recursive: true, force: true });
  }
});

// ---- ブラウザでの確認（Chromium が無い環境ではスキップ） ----
async function launchBrowser() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    return null;
  }
  const candidates = [undefined, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const executablePath of candidates) {
    if (executablePath && !fs.existsSync(executablePath)) continue;
    try {
      return await chromium.launch(executablePath ? { executablePath } : {});
    } catch {}
  }
  return null;
}

function serve(dir) {
  const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };
  const server = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split("?")[0]);
    if (!u.startsWith("/auto-tech-radar/")) { res.writeHead(404); return res.end(); }
    let p = path.join(dir, u.slice("/auto-tech-radar/".length));
    if (u.endsWith("/")) p = path.join(p, "index.html");
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" });
    res.end(fs.readFileSync(p));
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("スマホ幅（320px）で、どのページにも横スクロールが出ない（記事本文の表・長い URL・インラインコードを含む）", async (t) => {
  // 実際の全ページ＋わざと幅の広い表・長い URL を入れた記事（probe のビルドは実際のサイトのページも含む）
  assertProbeBuilt();
  const browser = await launchBrowser();
  if (!browser) return t.skip("Chromium が無い環境");
  const siteOut = probeOut;
  const server = await serve(siteOut);
  try {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 720 }, isMobile: true, hasTouch: true });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort()); // 外部（フォント・CDN）は読まない
    const pages = htmlFiles(siteOut).map((f) => path.relative(siteOut, path.dirname(f)).split(path.sep).join("/"));
    const overflow = [];
    for (const rel of pages) {
      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${server.address().port}/auto-tech-radar/${rel ? rel + "/" : ""}`, { waitUntil: "load" });
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      if (r.sw > r.cw + 1) overflow.push(`${rel || "/"}: 幅 ${r.sw}px（画面 ${r.cw}px）`);
      await page.close();
    }
    assert.deepEqual(overflow, []);
  } finally {
    await browser.close();
    server.close();
  }
});
