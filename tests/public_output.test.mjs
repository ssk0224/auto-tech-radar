// 配信するサイト（astro build の出力 dist/）に、個人の連絡先・オーナー端末のパスなどの形が無いことを、ビルドした結果で確かめる。
// ソースの検査（tests/public_tree.test.mjs の (a)）は、ビルドの時に組み立てる書き方（{user}@{domain}・[a, b].join("@")・テンプレート）を
// 読めない。描画した後の HTML・JS・画像を、同じ形の検査（scripts/utils/public_tree.mjs）で見る
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { prepareBuildRoot, astroBuild, removeDir } from "./helpers/site_build.mjs";

const root = path.resolve(import.meta.dirname, "..");
const scanner = path.join(root, "scripts", "utils", "public_tree.mjs");
const run = (dir) => spawnSync(process.execPath, [scanner, "scan", dir], { encoding: "utf8" });

test("配信物の検査は、描画した HTML に組み立てた連絡先・ページの JS の中の連結・圧縮したファイルを見つけ、見つけた文字列そのものは出さない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-dist-shape-"));
  try {
    const at = "@";
    const put = (rel, body) => {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), body);
    };
    put("index.html", "<p>ok</p>");
    let r = run(dir);
    assert.equal(r.status, 0, r.stderr);
    put("privacy/index.html", `<p>連絡先: <span>taro.yamada</span>${at}<span>gmail.com</span></p>`);
    put("contact/index.html", `<input type="hidden" name="_cc" value="jiro.suzuki${at}yahoo.co.jp">`);
    put("_astro/page.js", `const m="hanako.sato"+"${at}"+"outlook.jp";`);
    r = run(dir);
    assert.notEqual(r.status, 0);
    for (const f of ["privacy/index.html", "contact/index.html", "_astro/page.js"]) assert.ok(r.stderr.includes(f), `${f} を見逃した: ${r.stderr}`);
    for (const s of ["taro", "jiro", "hanako"]) assert.ok(!r.stderr.includes(s), "見つけた文字列を出力した（CI のログは公開される）");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("サイトのビルド（npm run build）は、astro build のあとに配信物の検査をする", () => {
  const build = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts.build.split("&&").map((s) => s.trim());
  const astro = build.findIndex((s) => /^astro build\b/.test(s));
  const scan = build.findIndex((s) => /^node scripts\/utils\/public_tree\.mjs scan dist$/.test(s));
  assert.ok(astro >= 0 && scan > astro, `build: ${build.join(" && ")}`);
});

// ---- 実際のサイトのビルド（テスト専用のコピーの中で） ----
let siteRoot = "";
let siteBuild = null;
before(() => {
  siteRoot = prepareBuildRoot("atr-pubout-");
  siteBuild = astroBuild(siteRoot, path.join(siteRoot, "dist"));
});
after(() => {
  if (siteRoot) removeDir(siteRoot);
});

test("実際にビルドしたサイトのすべてのファイル（お問い合わせ・プライバシーポリシーを含む）に、個人の連絡先・オーナー端末の情報の形が無い", () => {
  assert.equal(siteBuild?.status, 0, `astro build が失敗: ${(siteBuild?.stderr || "") + (siteBuild?.stdout || "")}`.slice(0, 4000));
  const out = path.join(siteRoot, "dist");
  for (const page of ["contact/index.html", "privacy/index.html"]) assert.ok(fs.existsSync(path.join(out, page)), `${page} がビルドされていない`);
  const r = run(out);
  assert.equal(r.status, 0, r.stderr);
});
