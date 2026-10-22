// 公開している「事実」（更新頻度・ライセンス・リンク・実行時刻・モデル名・件数）を、手書きの文でなくデータ・コードと突き合わせる。
// 手で書いた事実は、仕組みを変えた日に古くなる（「毎日更新」「1日最大1本」「MIT License（LICENSE が無い）」「存在しないリポへのリンク」）。
// ここでは個々の誤りの文字列ではなく、主張の形（頻度・本数の形、ライセンスの系統、リンク、時刻）で探し、実物から導いた値と比べる
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { classifyLicenseText } from "../scripts/utils/license_resolver.mjs";
import { MODEL_PREFERENCE } from "../scripts/utils/gemini_models.mjs";
import { findSitePromises } from "../scripts/utils/claims_check.mjs";
import { CADENCE_CLAIM_RE, PUBLISH_COUNT_RE } from "../src/utils/cadence.js";
import { trackedFiles, siteChromeSources, operatorTexts, scriptFiles, isCodeFile, stripComments, textViews, readRepo, repoRoot } from "./helpers/public_text.mjs";

const files = trackedFiles();
// 頻度は src/utils/cadence.js（掲載データから数える）と、それを表示する Cadence コンポーネントだけが述べる
const CADENCE_OWNERS = new Set(["src/utils/cadence.js", "src/components/Cadence.astro"]);

// 文の中の頻度・掲載本数の主張（URL・パスの中の語は除く）。コードはコメントを除き、マークアップは画面に出る文（タグで分けた語をつないだ形）でも読む
export function cadenceClaims(f, text) {
  const src = isCodeFile(f) ? stripComments(text) : text;
  const hits = new Set();
  for (const view of textViews(src)) {
    view.split("\n").forEach((line) => {
      const t = line.replace(/(?:https?:)?\/\/[^\s)"'<>`]+/g, "");
      for (const re of [CADENCE_CLAIM_RE, PUBLISH_COUNT_RE]) {
        const m = t.match(re);
        if (m) hits.add(`${m[0]} ← ${line.trim().slice(0, 80)}`);
      }
    });
  }
  return [...hits].map((h) => `${f}: ${h}`);
}

test("更新頻度・掲載本数の主張（毎日・毎夕・デイリー・everyday・1日N本・直近N日の掲載: N本 など）は Cadence の外に書かない。対象は運営者が出す公開テキストのすべて（サイト・README・llms.txt・投稿文・リードマグネット・生成スクリプト）", () => {
  const sources = operatorTexts(files);
  for (const must of ["src/layouts/Layout.astro", "public/llms.txt", "README.md", "scripts/generate_weekly_thread.mjs", "note_drafts/LEAD_MAGNET_CHEAT_SHEET.md"]) assert.ok(sources.includes(must), `検査の対象に ${must} が無い`);
  assert.ok(sources.some((f) => f.startsWith("x_posts/")), "投稿文（x_posts）が検査の対象に無い");
  const hits = sources.filter((f) => !CADENCE_OWNERS.has(f)).flatMap((f) => cadenceClaims(f, readRepo(f)));
  assert.deepEqual(hits, []);
});

test("頻度の検査は、タグで分けた語・新しい投稿文を拾い、コメント・URL の中の語は主張と取り違えない", () => {
  assert.ok(cadenceClaims("src/layouts/X.astro", "<p>毎<strong>日</strong>更新</p>").length > 0, "タグで分けた語");
  assert.ok(cadenceClaims("x_posts/new.txt", "毎日更新中").length > 0, "新しい投稿文");
  assert.ok(cadenceClaims("public/llms.txt", "新着は毎夕に追加").length > 0);
  assert.ok(cadenceClaims("src/pages/index.astro", "<div>直近30日の掲載: 99本</div>").length > 0, "手で書いた掲載本数");
  assert.deepEqual(cadenceClaims("scripts/x.mjs", "// 毎日のビルドが止まる\nconst u = 'https://example.com/daily-report';"), [], "コメント・URL は主張ではない");
  assert.ok(cadenceClaims("scripts/x.mjs", "const s = `毎朝、${n} 本を解説`; // note").length > 0, "コメントの手前の文字列は検査する");
});

// note 記事の URL・記事キー（n + 12 桁の 16 進）・記事 URL の組み立て（"/n/"）
const NOTE_ARTICLE_URL = /note\.com\/[A-Za-z0-9_]+\/n\/n[0-9a-z]{6,}/;
const NOTE_KEY = /(?<![0-9a-z])n[0-9a-f]{12}(?![0-9a-z])/;
const NOTE_URL_BUILD = /note\.com\/[A-Za-z0-9_${}.]*\/n\/|["'`]\/n\/["'`]|\/n\/["'`]\s*\+/;
// スクリプトが書き出すデータファイル（実行記録）。そのファイル名を含むスクリプトが、書き込みの呼び出しも持つもの
function machineWrittenData(all, code) {
  const writers = code.filter((f) => /\b(?:writeFileSync|writeFile|appendFileSync|writeJson\w*)\s*\(/.test(readRepo(f)));
  return new Set(all.filter((f) => !isCodeFile(f) && writers.some((w) => readRepo(w).includes(path.basename(f)))));
}
export function noteUrlHits(f, text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    const m = line.match(NOTE_ARTICLE_URL) || line.match(NOTE_KEY) || (isCodeFile(f) ? line.match(NOTE_URL_BUILD) : null);
    if (m) hits.push(`${f}:${i + 1}: ${m[0]}`);
  });
  return hits;
}

test("scripts/ のすべてのテキスト（コード・データ）と src のコードに note 記事の URL・記事キーを手で書かない（記事の URL は scripts/note_urls.json と、スクリプトが書き出す実行記録だけが持つ）", () => {
  const all = scriptFiles(files);
  const code = all.filter(isCodeFile);
  assert.ok(all.includes("scripts/launcher.mjs") && all.includes("scripts/note_urls.json"), "検査の対象が git のファイル一覧から取れていない");
  const records = machineWrittenData(all, code);
  assert.ok(records.has("scripts/note_browser_log.json"), "スクリプトが書き出すデータを見分けられていない");
  const hits = all.filter((f) => f !== "scripts/note_urls.json" && !records.has(f)).flatMap((f) => noteUrlHits(f, readRepo(f)));
  assert.deepEqual(hits, []);
});

test("note の URL の検査は、連結で組み立てた URL・記事キーだけの文字列・.cjs やデータファイルも拾う", () => {
  assert.ok(noteUrlHits("scripts/a.mjs", 'const u = "https://note.com/someone/n/" + "n0123456789ab";').length > 0);
  assert.ok(noteUrlHits("scripts/a.cjs", "const k = 'n0123456789ab';").length > 0);
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = `https://note.com/${user}/n/${key}`;").length > 0);
  assert.ok(noteUrlHits("scripts/a.json", '{"url": "https://note.com/someone/n/n0123456789ab"}').length > 0);
  assert.deepEqual(noteUrlHits("scripts/a.mjs", "const u = 'https://note.com/dashboard'; const h = 'abc0123456789abcdef';"), []);
});

// ライセンスの系統（SPDX の綴り・正式名称・略称・日本語のどれで書いても同じ系統に入る）
const LICENSE_FAMILIES = [
  ["MIT", /\bMIT\b/],
  ["Apache", /\bApache\b/i],
  ["GPL", /\b[AL]?GPL|GNU\s+(?:Affero\s+|Lesser\s+)?General\s+Public/i],
  ["BSD", /\bBSD\b/i],
  ["MPL", /\bMPL\b|Mozilla\s+Public/i],
  ["ISC", /\bISC\b/],
  ["CC", /\bCC[-\s]?(?:BY|0|ZERO)\b|Creative\s+Commons|クリエイティブ・?コモンズ/i],
  ["PublicDomain", /\bUnlicense\b|public\s+domain|パブリック・?ドメイン/i],
  ["Proprietary", /all\s+rights\s+reserved|proprietary|無断(?:転載|複製|使用)|著作権者の許可/i],
  ["Other", /\b(?:WTFPL|EUPL|Zlib|Boost\s+Software|Artistic\s+License|SSPL|BUSL|Elastic\s+License|Commons\s+Clause)\b/i],
];
export const licenseFamiliesIn = (text) => LICENSE_FAMILIES.filter(([, re]) => re.test(text)).map(([name]) => name);

test("ライセンス: LICENSE の本文・package.json の license・README の記載が同じライセンスを指す（どの書き方で別のライセンスを名乗っても止める）", () => {
  const licenseFile = files.find((f) => /^(LICENSE|LICENCE|COPYING)(\.md|\.txt)?$/i.test(f));
  assert.ok(licenseFile, "リポジトリ直下に LICENSE ファイルが無い（README がライセンスを名乗っても、利用許諾の実体が無い）");
  const body = readRepo(licenseFile);
  const info = classifyLicenseText(body);
  assert.equal(info.status, "resolved", "LICENSE の本文からライセンスを判定できない");
  const family = licenseFamiliesIn(info.spdx);
  assert.equal(family.length, 1, `LICENSE の判定結果 ${info.spdx} の系統が決まらない`);
  assert.deepEqual(licenseFamiliesIn(body), family, "LICENSE の本文に別のライセンスの記載がある");
  const pkg = JSON.parse(readRepo("package.json"));
  assert.equal(pkg.license, info.spdx, "package.json の license が LICENSE の本文と一致しない");
  const named = licenseFamiliesIn(readRepo("README.md"));
  assert.ok(named.length > 0, "README にライセンスの記載が無い");
  assert.deepEqual(named, family, `README が LICENSE（${info.spdx}）と違うライセンスを名乗っている`);
});

test("ライセンスの系統の判定は、正式名称・略称・日本語の書き方でも拾う", () => {
  assert.deepEqual(licenseFamiliesIn("ライセンス: Apache License 2.0"), ["Apache"]);
  assert.deepEqual(licenseFamiliesIn("licensed under GPLv3"), ["GPL"]);
  assert.deepEqual(licenseFamiliesIn("CC BY 4.0"), ["CC"]);
  assert.deepEqual(licenseFamiliesIn("© 2026 All rights reserved"), ["Proprietary"]);
  assert.deepEqual(licenseFamiliesIn("MIT License"), ["MIT"]);
});

// GitHub のリポジトリへのリンク（https・http・スキーム無しのどれでも）
const GITHUB_REPO_LINK = /(?<![\w.-])(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/gi;
export function githubRepoLinks(text) {
  return [...text.matchAll(GITHUB_REPO_LINK)].map((m) => `${m[1]}/${m[2].replace(/\.git$/i, "")}`.toLowerCase());
}

test("サイト・README・llms.txt の GitHub リポジトリへのリンクは、このリポか、掲載中の記事の repoUrl だけ（手で書いた URL は実在しないリポを指しうる）", () => {
  const radar = files.filter((f) => /^src\/pages\/radar\/[^/]+\.md$/.test(f));
  const self = readRepo("src/config/site.js").match(/githubUrl:\s*["']https:\/\/github\.com\/([^"'/]+\/[^"'/]+)["']/)?.[1];
  assert.ok(self, "このリポの URL（siteConfig.githubUrl）が読めない");
  const known = new Set([self.toLowerCase()]);
  for (const f of radar) {
    const m = readRepo(f).match(/^repoUrl:\s*["']?https:\/\/github\.com\/([^"'\s/]+\/[^"'\s/]+?)["']?\s*$/m);
    if (m) known.add(m[1].toLowerCase());
  }
  assert.ok(known.size > 10, "記事の repoUrl が読めない");
  const sources = siteChromeSources(files);
  assert.ok(sources.includes("README.md") && sources.includes("public/llms.txt"));
  const bad = sources.flatMap((f) => githubRepoLinks(readRepo(f)).filter((r) => !known.has(r)).map((r) => `${f}: ${r}`));
  assert.deepEqual(bad, []);
});

test("GitHub のリンクの検出は、http・スキーム無しの書き方も拾い、api.github.com は拾わない", () => {
  assert.deepEqual(githubRepoLinks("see http://github.com/a/b and github.com/c/d.git"), ["a/b", "c/d"]);
  assert.deepEqual(githubRepoLinks("https://api.github.com/repos/x"), []);
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

test("README（サイトの配信物に含まれない運営者の文）にも、速さ・無料のサービス・検査の網羅を約束する表現が無い", () => {
  const hits = textViews(readRepo("README.md"))
    .flatMap((v) => v.split("\n"))
    .flatMap((line) => findSitePromises(line).map((h) => `${h} ← ${line.trim().slice(0, 80)}`));
  assert.deepEqual([...new Set(hits)], []);
});

// robots.txt は機械が読む指定だけを書く（コメントの文は人が「保護されている」と読む）。ホスト直下でない base では指定自体が効かない（RFC 9309）
export function robotsProblems(robots, base) {
  const atHostRoot = base.replace(/\/$/, "") === "";
  const problems = [];
  robots.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const m = t.match(/^(User-agent|Allow|Disallow|Sitemap|Crawl-delay)\s*:\s*(.*)$/i);
    if (!m) problems.push(`${i + 1}: 指定でない行（コメント・文）: ${t.slice(0, 60)}`);
    else if (!atHostRoot && /^(Disallow|Crawl-delay)$/i.test(m[1])) problems.push(`${i + 1}: ${base}/robots.txt はクローラーに読まれず、${m[1]} は効かない`);
  });
  if (!/^Sitemap:\s*https:\/\/\S+sitemap-index\.xml$/m.test(robots)) problems.push("Sitemap の行が無い");
  return problems;
}

test("robots.txt は指定の行だけで、効力の無い場所（ホストの直下でない base）なら拒否の指定も書かない（守られない保護を名乗らない）", () => {
  const base = readRepo("astro.config.mjs").match(/^\s*base:\s*["']([^"']*)["']/m)?.[1] || "/";
  assert.deepEqual(robotsProblems(readRepo("public/robots.txt"), base), []);
});

test("robots.txt の検査は、言い回しを変えた拒否のコメントや空白の無い Disallow も拾う", () => {
  const ok = "User-agent: *\nAllow: /\n\nSitemap: https://x.example/a/sitemap-index.xml\n";
  assert.deepEqual(robotsProblems(ok, "/a"), []);
  assert.ok(robotsProblems(ok + "# AI の学習用クローラーはお断りしています\n", "/a").length > 0);
  assert.ok(robotsProblems(ok + "# Scrapers are not welcome here\n", "/a").length > 0);
  assert.ok(robotsProblems(ok + "Disallow:/\n", "/a").length > 0);
  assert.deepEqual(robotsProblems(ok + "Disallow: /private/\n", "/"), []);
});

test("検査の対象の取り方は、まだ add していない新しいファイル・拡張子の一覧に無い形式も拾い、記事の本文は slug から見分ける（手書きの一覧ではない）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-scope-"));
  try {
    const put = (f, body) => {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), body);
    };
    execFileSync("git", ["init", "-q"], { cwd: dir });
    for (const f of ["src/pages/radar/zz.md", "note_drafts/zz_note.md", "articles/zz-tech-radar.md", "note_drafts/LEAD.md", "x_posts/zz_new.txt", "scripts/zz.cjs", "scripts/zz.json", "public/zz.css", "public/zz.csv", "src/components/Zz.astro", "README.md"]) put(f, "probe\n");
    put("public/zz.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
    const now = trackedFiles(dir);
    assert.ok(now.includes("x_posts/zz_new.txt") && now.includes("public/zz.png"), "まだ add していないファイルを拾わない");
    const op = operatorTexts(now, dir);
    for (const f of ["x_posts/zz_new.txt", "scripts/zz.cjs", "public/zz.css", "public/zz.csv", "src/components/Zz.astro", "note_drafts/LEAD.md"]) assert.ok(op.includes(f), f);
    for (const f of ["src/pages/radar/zz.md", "note_drafts/zz_note.md", "articles/zz-tech-radar.md", "public/zz.png"]) assert.ok(!op.includes(f), f);
    const sf = scriptFiles(now, dir);
    assert.ok(sf.includes("scripts/zz.json") && sf.includes("scripts/zz.cjs"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  }
});
