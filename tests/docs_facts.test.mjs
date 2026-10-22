// 公開している「事実」（更新頻度・ライセンス・リンク・実行時刻・モデル名・件数）を、手書きの文でなくデータ・コードと突き合わせる。
// 手で書いた事実は、仕組みを変えた日に古くなる（「毎日更新」「1日最大1本」「MIT License（LICENSE が無い）」「存在しないリポへのリンク」）。
// ここでは個々の誤りの文字列ではなく、主張の形（頻度の語・ライセンス名・リンク・時刻）で探し、実物から導いた値と比べる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { classifyLicenseText } from "../scripts/utils/license_resolver.mjs";
import { MODEL_PREFERENCE } from "../scripts/utils/gemini_models.mjs";
import { CADENCE_CLAIM_RE } from "../src/utils/cadence.js";
import { trackedFiles, siteChromeSources, scriptCodeFiles, readRepo, repoRoot } from "./helpers/public_text.mjs";

const files = trackedFiles();
// 頻度は src/utils/cadence.js（掲載データから数える）と、それを表示する Cadence コンポーネントだけが述べる
const CADENCE_OWNERS = new Set(["src/utils/cadence.js", "src/components/Cadence.astro"]);

test("更新頻度の語（毎日・毎朝・daily・速報・1日最大 など）は Cadence の外に書かない（頻度は掲載データから数えて出す）", () => {
  const sources = siteChromeSources(files);
  assert.ok(sources.includes("src/layouts/Layout.astro") && sources.includes("public/llms.txt") && sources.includes("README.md"), "検査の対象が git の追跡ファイルから取れていない");
  const hits = [];
  for (const f of sources) {
    if (CADENCE_OWNERS.has(f)) continue;
    readRepo(f).split("\n").forEach((line, i) => {
      // URL の中の語（ワークフローのファイル名 daily-crawl.yml など）は文の主張ではない
      const m = line.replace(/https?:\/\/[^\s)"'<>]+/g, "").match(CADENCE_CLAIM_RE);
      if (m) hits.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("スクリプト・サイトのコードに note 記事の URL を直接書かない（記事の URL は scripts/note_urls.json だけが持つ）", () => {
  const NOTE_ARTICLE_URL = /note\.com\/[A-Za-z0-9_]+\/n\/n[0-9a-z]{6,}/;
  const code = scriptCodeFiles(files);
  assert.ok(code.includes("scripts/launcher.mjs"), "検査の対象が git の追跡ファイルから取れていない");
  const hits = [];
  for (const f of code) {
    readRepo(f).split("\n").forEach((line, i) => {
      const m = line.match(NOTE_ARTICLE_URL);
      if (m) hits.push(`${f}:${i + 1}: ${m[0]}`);
    });
  }
  assert.deepEqual(hits, []);
});

test("ライセンス: LICENSE の本文・package.json の license・README の記載が同じライセンスを指す（サイトが他のリポに使う判定を自リポにも使う）", () => {
  const licenseFile = files.find((f) => /^(LICENSE|LICENCE|COPYING)(\.md|\.txt)?$/i.test(f));
  assert.ok(licenseFile, "リポジトリ直下に LICENSE ファイルが無い（README がライセンスを名乗っても、利用許諾の実体が無い）");
  const info = classifyLicenseText(readRepo(licenseFile));
  assert.equal(info.status, "resolved", "LICENSE の本文からライセンスを判定できない");
  const pkg = JSON.parse(readRepo("package.json"));
  assert.equal(pkg.license, info.spdx, "package.json の license が LICENSE の本文と一致しない");
  const readme = readRepo("README.md");
  const named = [...readme.matchAll(/\b(MIT|Apache[- ]2\.0|BSD-[23]-Clause|GPL-[23]\.0|AGPL-3\.0|MPL-2\.0|ISC)\b(?: License)?/g)].map((m) => m[1].replace(" ", "-"));
  assert.ok(named.length > 0, "README にライセンスの記載が無い");
  for (const n of named) assert.equal(n, info.spdx, `README が LICENSE と違うライセンス（${n}）を名乗っている`);
});

test("README の GitHub リポジトリへのリンクは、このリポか、掲載中の記事の repoUrl だけ（手で書いた URL は実在しないリポを指しうる）", () => {
  const radar = files.filter((f) => /^src\/pages\/radar\/[^/]+\.md$/.test(f));
  const known = new Set(["ssk0224/auto-tech-radar"]);
  for (const f of radar) {
    const m = readRepo(f).match(/^repoUrl:\s*["']?https:\/\/github\.com\/([^"'\s/]+\/[^"'\s/]+?)["']?\s*$/m);
    if (m) known.add(m[1].toLowerCase());
  }
  assert.ok(known.size > 10, "記事の repoUrl が読めない");
  const bad = [];
  for (const m of readRepo("README.md").matchAll(/https:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g)) {
    if (!known.has(m[1].toLowerCase())) bad.push(m[0]);
  }
  assert.deepEqual(bad, []);
});

test("README に書く実行時刻（日本時間）は、ワークフローの cron から計算した時刻だけ", () => {
  const yml = readRepo(".github/workflows/daily-crawl.yml");
  const jst = new Set(
    [...yml.matchAll(/cron:\s*["'](\d+) (\d+) \* \* \*["']/g)].map(([, mi, h]) => `${(Number(h) + 9) % 24}:${mi.padStart(2, "0")}`),
  );
  assert.ok(jst.size > 0, "cron が読めない");
  const bad = [];
  for (const line of readRepo("README.md").split("\n")) {
    if (!/JST|日本時間/.test(line)) continue;
    for (const m of line.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) if (!jst.has(`${Number(m[1])}:${m[2]}`)) bad.push(`${m[0]}（${line.trim().slice(0, 60)}）`);
  }
  assert.deepEqual(bad, [], `cron の時刻（日本時間）: ${[...jst].join(", ")}`);
});

test("README のモデル名は、生成スクリプトが使うモデルの一覧にあるものだけ", () => {
  const bad = [...readRepo("README.md").matchAll(/gemini-[0-9][\w.-]*/gi)].map((m) => m[0]).filter((m) => !MODEL_PREFERENCE.includes(m));
  assert.deepEqual(bad, []);
});

test("README に「N段階の監査」と書くなら、監査スクリプトの段の数と一致する", () => {
  const steps = (readRepo("scripts/audit_quality.mjs").match(/^console\.log\(['"`]▶ \[/gm) || []).length;
  assert.ok(steps > 0, "監査スクリプトの段が読めない");
  for (const m of readRepo("README.md").matchAll(/(\d+)\s*段階/g)) assert.equal(Number(m[1]), steps, `README の「${m[0]}」は監査スクリプトの ${steps} 段と一致しない`);
});

test("robots.txt は、効力の無い場所（ホストの直下でない base）に置いているなら、拒否・ブロックを書かない（守られない保護を名乗らない）", () => {
  const base = readRepo("astro.config.mjs").match(/^\s*base:\s*["']([^"']*)["']/m)?.[1] || "/";
  const robots = readRepo("public/robots.txt");
  assert.match(robots, /^Sitemap:\s*https:\/\/\S+sitemap-index\.xml$/m, "Sitemap の行が無い");
  if (base.replace(/\/$/, "") === "") return; // ホストの直下に置くサイトなら効力がある
  assert.doesNotMatch(robots, /^\s*Disallow:\s*\S/im, `robots.txt は ${base}/robots.txt に置かれ、クローラーはホスト直下の robots.txt しか読まない（RFC 9309）。拒否の行は効かない`);
  assert.doesNotMatch(robots, /block|harvester|unauthori[sz]ed|拒否|禁止|遮断/i, "効かない保護をうたうコメントがある");
});

test("検査の対象の取り方は、新しく追加したファイルも拾う（手書きの一覧ではない）", () => {
  const extra = ["src/pages/zz-new.astro", "public/zz-new.txt", "src/components/Zz.astro", "src/pages/radar/zz.md", "scripts/zz.mjs", "scripts/zz.json"];
  const chrome = siteChromeSources([...files, ...extra]);
  assert.ok(chrome.includes("src/pages/zz-new.astro") && chrome.includes("public/zz-new.txt") && chrome.includes("src/components/Zz.astro"));
  assert.ok(!chrome.includes("src/pages/radar/zz.md"));
  const code = scriptCodeFiles([...files, ...extra]);
  assert.ok(code.includes("scripts/zz.mjs") && !code.includes("scripts/zz.json"));
  assert.ok(fs.existsSync(path.join(repoRoot, "package.json")));
});
