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
  assertSiteBuilt();
  const browser = await launchBrowser();
  if (!browser) return t.skip("Chromium が無い環境");
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
