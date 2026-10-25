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
import { findCadenceClaims } from "../src/utils/cadence.js";
import { isGitIgnored } from "./helpers/tracked_files.mjs";
import { trackedFiles, siteChromeSources, operatorTexts, scriptFiles, isCodeFile, stripComments, textViews, readRepo, repoRoot } from "./helpers/public_text.mjs";

const files = trackedFiles();
// 頻度の文は src/utils/cadence.js（掲載データから数えて文を作る）だけが持つ。表示する Cadence コンポーネントも、その関数の結果だけを出す
// （コンポーネントを例外にすると、データから作った文の隣に手で書いた「（毎日更新）」が素通りした）
const CADENCE_OWNERS = new Set(["src/utils/cadence.js"]);

// 文の中の頻度・掲載本数の主張（URL・パスの中の語は除く）。コードはコメントを除き、マークアップは画面に出る文（タグで分けた語をつないだ形）でも読む
export function cadenceClaims(f, text) {
  const src = isCodeFile(f) ? stripComments(text) : text;
  const hits = new Set();
  for (const view of textViews(src)) {
    view.split("\n").forEach((line) => {
      const t = line.replace(/(?:https?:)?\/\/[^\s)"'<>`]+/g, "");
      for (const m of findCadenceClaims(t)) hits.add(`${m} ← ${line.trim().slice(0, 80)}`);
    });
  }
  return [...hits].map((h) => `${f}: ${h}`);
}

test("更新頻度・掲載本数の主張（毎日・毎夕・デイリー・everyday・1日N本・直近N日の掲載: N本 など）は Cadence の外に書かない。対象は運営者が出す公開テキストのすべて（サイト・README・llms.txt・投稿文・リードマグネット・生成スクリプト）", () => {
  const sources = operatorTexts(files);
  for (const must of ["src/layouts/Layout.astro", "public/llms.txt", "README.md", "scripts/crawl_and_generate.mjs", "scripts/generate_lead_magnet_note.mjs", "note_drafts/LEAD_MAGNET_CHEAT_SHEET.md"]) assert.ok(sources.includes(must), `検査の対象に ${must} が無い`);
  // X の投稿文は作らなくなり（85ed57e）、x_posts/ は .gitignore で公開リポに入らない。追跡に戻した投稿文は、ここで検査の対象に入る
  assert.ok(sources.some((f) => f.startsWith("x_posts/")) || isGitIgnored(repoRoot, "x_posts/probe.txt"), "投稿文（x_posts）が検査の対象にも .gitignore にも無い");
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
  assert.ok(cadenceClaims("README.md", "週に3回更新しています").length > 0, "言い換えた頻度");
  assert.ok(cadenceClaims("src/pages/index.astro", "<p>新しいレポートが日々追加されます</p>").length > 0, "日々＋追加");
  assert.ok(cadenceClaims("src/components/Cadence.astro", "<span>{cadenceText(facts)}（毎日更新）</span>").length > 0, "データから作った文の隣の手書きの頻度");
});

// note 記事の URL・記事キー（n + 12 桁の 16 進）・記事 URL の組み立て（"/n/"）
const NOTE_ARTICLE_URL = /note\.com\/[A-Za-z0-9_]+\/n\/n[0-9a-z]{6,}/;
const NOTE_KEY = /(?<![0-9a-z])n[0-9a-f]{12}(?![0-9a-z])/;
// 組み立ては書き方（連結・テンプレート・配列の join・new URL）によらず、記事の区切り "n" を文字列で持つ形で拾う:
// "/n/" を含む文字列・"n/" で始まる・"/n" で終わる文字列・パスの部品としての 'n'（配列の要素・連結・引数）
const NOTE_URL_BUILD = /note\.com\/[A-Za-z0-9_${}.]*\/n\/|["'`][^"'`\n]*\/n\/|["'`]n\/|\/n["'`]|[[({,+]\s*(["'`])n\1\s*[,+\])}]/;
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
  // note の操作の実行記録（note_browser_log.json）はオーナー端末の専用フォルダに移した（scripts/utils/owner_dir.mjs）。公開リポに残る実行記録で見分けを確かめる
  assert.ok(records.has("scripts/publish_history.json"), "スクリプトが書き出すデータを見分けられていない");
  const hits = all.filter((f) => f !== "scripts/note_urls.json" && !records.has(f)).flatMap((f) => noteUrlHits(f, readRepo(f)));
  assert.deepEqual(hits, []);
});

test("note の URL の検査は、連結で組み立てた URL・記事キーだけの文字列・.cjs やデータファイルも拾う", () => {
  assert.ok(noteUrlHits("scripts/a.mjs", 'const u = "https://note.com/someone/n/" + "n0123456789ab";').length > 0);
  assert.ok(noteUrlHits("scripts/a.cjs", "const k = 'n0123456789ab';").length > 0);
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = `https://note.com/${user}/n/${key}`;").length > 0);
  assert.ok(noteUrlHits("scripts/a.json", '{"url": "https://note.com/someone/n/n0123456789ab"}').length > 0);
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = ['https://note.com', user, 'n', key].join('/');").length > 0, "配列の join");
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = new URL(`/n/${key}`, 'https://note.com/' + user + '/');").length > 0, "new URL");
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = path.posix.join(base, user, \"n\", key);").length > 0, "引数の 'n'");
  assert.ok(noteUrlHits("scripts/a.mjs", "const u = base + '/' + 'n' + '/' + key;").length > 0, "連結の 'n'");
  assert.deepEqual(noteUrlHits("scripts/a.mjs", "const u = 'https://note.com/dashboard'; const h = 'abc0123456789abcdef';"), []);
  assert.deepEqual(noteUrlHits("scripts/a.mjs", "case 'n':\nif (answer.toLowerCase() !== \"n\") {}\nconst lines = s.split('\\n');"), [], "メニューの n・改行は組み立てではない");
});

// ライセンスの系統（SPDX の綴り・正式名称・略称・日本語のどれで書いても同じ系統に入る）
const LICENSE_FAMILIES = [
  ["MIT", /\bMIT\b/],
  ["Apache", /\bApache\b/i],
  ["GPL", /\b[AL]?GPL|\bGNU\b|General\s+Public\s+Licen[cs]e|一般公衆(?:利用)?(?:許諾|使用許諾|ライセンス)/i],
  ["BSD", /(?<![A-Za-z])0?BSD\b/i],
  ["MPL", /\bMPL\b|Mozilla\s+Public/i],
  ["ISC", /\bISC\b/],
  ["CC", /\bCC[-\s]?(?:BY|0|ZERO)\b|Creative\s+Commons|クリエイティブ・?コモンズ/i],
  ["PublicDomain", /\bUnlicense\b|public\s+domain|パブリック・?ドメイン/i],
  ["Proprietary", /all\s+rights\s+reserved|proprietary|無断(?:転載|複製|使用)|著作権者の許可/i],
  ["Other", /\b(?:WTFPL|EUPL|Zlib|Boost\s+Software|Artistic\s+License|SSPL|BUSL|Elastic\s+License|Commons\s+Clause)\b/i],
];
// SPDX の識別子は、どの系統の書き方にも当たらなければ「別のライセンス」として数える（知らない識別子で名乗っても素通りしない）
export function licenseFamiliesIn(text) {
  const named = LICENSE_FAMILIES.filter(([, re]) => re.test(text)).map(([name]) => name);
  const spdx = [...String(text).matchAll(/SPDX-License-Identifier:\s*([\w.+-]+)/gi)].map((m) => m[1]);
  const unknown = spdx.some((id) => !LICENSE_FAMILIES.some(([name, re]) => name !== "Other" && re.test(id)));
  return unknown && !named.includes("Other") ? [...named, "Other"] : named;
}

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
  assert.deepEqual(licenseFamiliesIn("SPDX-License-Identifier: 0BSD"), ["BSD"]);
  assert.deepEqual(licenseFamiliesIn("本リポジトリは GNU 一般公衆利用許諾書 第3版で配布します。"), ["GPL"]);
  assert.deepEqual(licenseFamiliesIn("SPDX-License-Identifier: Foo-1.0"), ["Other"], "知らない SPDX の識別子も、別のライセンスとして数える");
});

// README の利用条件の文（再配布・転載の禁止、著作権、〜で公開しています）は、ライセンスの節だけに書き、その節は LICENSE の本文から作った文と一致する。
// 系統の名前を拾うだけでは、名前を出さない独自の条件（「記事の再配布は禁止です」）を見逃す
const TERMS_RE =
  /再配布|転載|複製|改変|(?:利用|使用|転用|配布|引用|商用利用)(?:を|は)?(?:禁止|禁じ|不可|お断り|できません)|許諾|SPDX|licen[cs](?:ed|ing)|copyright|©|\(c\)|rights|著作権|帰属|利用規約|terms\s+of|(?:で|として|の下で|のもとで)(?:公開|配布|提供)して|無断|non-?commercial/i;
export function readmeLicenseLines(licenseText) {
  const lines = licenseText.split("\n").map((l) => l.trim());
  const name = lines.find(Boolean);
  const holder = lines.map((l) => l.match(/^Copyright\s+\(c\)\s+(\d{4})\s+(.+)$/i)).find(Boolean);
  return [
    `- 本プロジェクトのソースコードおよびサイト構成は ${name}（[LICENSE](LICENSE)）で公開しています。`,
    "- 分析対象となる各オープンソースソフトウェアの権利は各リポジトリの著作者に帰属します。",
    `- © ${holder?.[1]} ${holder?.[2]}. Built with Google Gemini & Astro.`,
  ];
}
export function readmeTermsProblems(readme, licenseText) {
  const lines = readme.split("\n").map((l) => l.trimEnd());
  const start = lines.findIndex((l) => /^##\s.*(?:ライセンス|License)/i.test(l));
  const end = start < 0 ? -1 : lines.findIndex((l, i) => i > start && /^(?:##\s|---\s*$)/.test(l));
  const inSection = (i) => start >= 0 && i > start && (end < 0 || i < end);
  const want = readmeLicenseLines(licenseText);
  const problems = [];
  if (start < 0) problems.push("README にライセンスの節が無い");
  const section = lines.filter((l, i) => inSection(i) && l.trim());
  if (start >= 0 && JSON.stringify(section) !== JSON.stringify(want)) problems.push(`ライセンスの節が LICENSE から作った文と違う: ${JSON.stringify(section)}`);
  lines.forEach((l, i) => {
    if (!inSection(i) && i !== start && TERMS_RE.test(l)) problems.push(`${i + 1}: ライセンスの節の外の利用条件の文: ${l.trim().slice(0, 80)}`);
  });
  return problems;
}

test("README の利用条件の文はライセンスの節だけにあり、その節は LICENSE の本文（名前・著作権者）から作った文と一致する", () => {
  assert.deepEqual(readmeTermsProblems(readRepo("README.md"), readRepo("LICENSE")), []);
});

test("README の利用条件の検査は、名前を出さない独自の条件・別の場所に書いた条件・節に足した条件を拾う", () => {
  const lic = "MIT License\n\nCopyright (c) 2026 Auto Tech Radar\n";
  const ok = ["# x", "", "## 📜 ライセンス ＆ クレジット", ...readmeLicenseLines(lic), ""].join("\n");
  assert.deepEqual(readmeTermsProblems(ok, lic), []);
  assert.ok(readmeTermsProblems(ok + "なお、本サイトの記事の再配布は禁止です。\n", lic).length > 0, "節の外の独自の条件");
  assert.ok(readmeTermsProblems(ok.replace("## 📜", "- 記事の無断転載はお断りします。\n## 📜"), lic).length > 0, "節の前の条件");
  assert.ok(readmeTermsProblems(ok.replace("Astro.", "Astro.\n- 商用利用は不可です。"), lic).length > 0, "節に足した条件");
  assert.ok(readmeTermsProblems(ok, "Apache License\nVersion 2.0\n").length > 0, "LICENSE と違う名前");
});

// GitHub のリポジトリを指す書き方（https・http・スキーム無し・SSH の git@github.com:・ssh://・raw.githubusercontent.com・API の /repos/・Pages の <owner>.github.io/<repo>・gist）
const OWNER_REPO = String.raw`([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)`;
const GITHUB_REPO_LINKS = [
  new RegExp(String.raw`(?<![\w.-])(?:(?:https?|ssh|git)(?:\+https?)?:\/\/)?(?:[\w-]+@)?(?:www\.)?github\.com[/:]` + OWNER_REPO, "gi"),
  new RegExp(String.raw`(?<![\w.-])(?:https?:\/\/)?(?:raw|media)\.githubusercontent\.com\/` + OWNER_REPO, "gi"),
  new RegExp(String.raw`(?<![\w.-])(?:https?:\/\/)?api\.github\.com\/repos\/` + OWNER_REPO, "gi"),
  new RegExp(String.raw`(?<![\w.-])(?:https?:\/\/)?(gist)\.github\.com\/([A-Za-z0-9_.-]+)`, "gi"),
];
const PAGES_LINK = /(?<![\w.-])(?:https?:\/\/)?([A-Za-z0-9-]+)\.github\.io(?:\/([A-Za-z0-9_.-]+))?/gi;
export function githubRepoLinks(text) {
  const found = GITHUB_REPO_LINKS.flatMap((re) => [...text.matchAll(re)].map((m) => ({ at: m.index, repo: `${m[1]}/${m[2].replace(/\.git$/i, "")}` })));
  // パスを式で足すリンク（`https://<owner>.github.io${pathname}`）はリポ名が読めないので「<owner> の Pages」として数える
  for (const m of text.matchAll(PAGES_LINK)) found.push({ at: m.index, repo: `${m[1]}/${m[2] || "(pages)"}` });
  return found.sort((a, b) => a.at - b.at).map((x) => x.repo.toLowerCase());
}

test("サイト・README・llms.txt の GitHub リポジトリへのリンクは、このリポか、掲載中の記事の repoUrl だけ（手で書いた URL は実在しないリポを指しうる）", () => {
  const radar = files.filter((f) => /^src\/pages\/radar\/[^/]+\.md$/.test(f));
  const self = readRepo("src/config/site.js").match(/githubUrl:\s*["']https:\/\/github\.com\/([^"'/]+\/[^"'/]+)["']/)?.[1];
  assert.ok(self, "このリポの URL（siteConfig.githubUrl）が読めない");
  const known = new Set([self.toLowerCase()]);
  // このサイト自身（siteConfig.url の Pages）
  const pages = readRepo("src/config/site.js").match(/\burl:\s*["']https:\/\/([\w-]+)\.github\.io/)?.[1];
  assert.ok(pages, "サイトの URL（siteConfig.url）が読めない");
  known.add(`${pages}/(pages)`.toLowerCase());
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
  assert.deepEqual(githubRepoLinks("https://api.github.com/rate_limit"), []);
  assert.deepEqual(githubRepoLinks("clone: git@github.com:zz-org/zz-repo.git"), ["zz-org/zz-repo"], "SSH");
  assert.deepEqual(githubRepoLinks("https://raw.githubusercontent.com/zz-org/zz-repo/main/data.json"), ["zz-org/zz-repo"], "raw");
  assert.deepEqual(githubRepoLinks("ssh://git@github.com/zz-org/zz-repo"), ["zz-org/zz-repo"]);
  assert.deepEqual(githubRepoLinks("https://api.github.com/repos/zz-org/zz-repo/releases"), ["zz-org/zz-repo"], "API");
  assert.deepEqual(githubRepoLinks("https://zz-org.github.io/zz-repo/"), ["zz-org/zz-repo"], "Pages");
  assert.deepEqual(githubRepoLinks("https://gist.github.com/zz-org/abc"), ["gist/zz-org"], "gist");
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
