// 生成スクリプト（毎日 CI で無人実行）が、不正な生成物を保存せずに止めることを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { linkDir } from "./helpers/links.mjs";
import { pathToFileURL } from "url";
import { parseFrontmatter } from "astro/markdown";
import { mermaidProblems } from "../scripts/utils/mermaid.mjs";
import { mermaidParseErrors } from "../scripts/utils/mermaid_parse.mjs";
import { isolateGitConfig } from "./helpers/git_env.mjs";
import { MOCK_README } from "./fixtures/mock_readme.mjs";

const root = path.resolve(import.meta.dirname, "..");

// このテストが作る git リポジトリを、マシンの git 設定（owner PC の core.autocrlf=true など）から切り離す
isolateGitConfig();
const SKIP = new Set(["node_modules", "dist", ".git", ".astro", ".claude"]);

const PAID = "## 有料の中身 SECRET_PAID_TEXT\n" + "提案書と見積の本文。".repeat(200);
// 生成モデルの出力（leakhunt C3、2026-10-22 から）: Web 記事は見出し 2 つと README の原文の行（tests/fixtures/mock_readme.mjs の README の文そのもの）だけ、
// note は有料部分の本文だけ。訳は書かせない（README と照合できない）。リード・成熟度・インストール・ライセンス・図・note の無料部分と末尾・X は
// 生成スクリプトがデータから作る
// overview: Web 記事の出力（既定は README の文を選んだもの）。web: その後ろに足す行（原文でない行の検査用）
// diagram: 生成モデルが描いた Mermaid 図（描かせない。描いていれば採用しない）
// free / hype: 生成モデルが書いた note の無料部分（書かせない。書いていれば採用しない）
const FREE = "この記事では、公式 README に沿って導入の流れと注意点を説明します。".repeat(15);
const Q = "- 原文（README）: ";
const STATEMENTS = [
  "## 概要",
  `${Q}testtool is a command-line tool for checking deployment pipelines.`,
  `${Q}It runs on Linux, macOS and Windows.`,
  "## 主な機能と構成（README の原文）",
  `${Q}testtool reads a YAML file and reports each failed step.`,
].join("\n");
// note の有料部分の作り方（公開リポジトリに置かない。CI の秘密 NOTE_PAID_RECIPE）のテスト用の値
const RECIPE = "TEST_RECIPE_SENTINEL の節を書くこと";
const PAYWALL = "--------------------------------------------------\n【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】\n--------------------------------------------------";
const output = ({ overview = STATEMENTS, diagram = null, footer = true, image = "", hype = "", paidExtra = "", web = "", free = "" } = {}) => `=== WEB ARTICLE ===
${overview}
${diagram ? `\`\`\`mermaid\n${diagram}\n\`\`\`` : ""}
${web}
=== NOTE ARTICLE ===
${free || hype ? `# testtool note\n${free}\n無料部分の導入。${hype}\n${PAYWALL}` : ""}
${PAID}
${paidExtra}
${image ? `\`\`\`yaml\nservices:\n  app:\n    image: ${image}\n\`\`\`` : ""}
${footer ? "---\n**【note出品時用 推奨ハッシュタグ】**\n#AI #OSS #副業 #受託開発" : ""}
=== X THREAD ===
[TWEET 1]
hello
`;

// keepDates: 既存記事の公開日を書き換えず、生成スクリプトの現在時刻（MOCK_NOW）を 3 日後にずらして「本日分は生成済み」を避ける
// （複製をそのまま CI の品質ゲートにかけるため。公開日を 2000-01-01 にすると、公開日の検査に既存記事が落ちる）
function run(mockOut, extraEnv = {}, { keepDates = false, timeout, prepare } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gen-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  linkDir(path.join(root, "node_modules"), path.join(dir, "node_modules")); // Windows ではディレクトリの symlink に権限が要るため、linkDir は junction を使う
  // 「本日分は生成済み」で即終了しないよう、複製側の記事の公開日を過去にずらす
  const radar = path.join(dir, "src/pages/radar");
  if (!keepDates) {
    for (const f of fs.readdirSync(radar)) {
      const p = path.join(radar, f);
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^pubDate:.*$/m, 'pubDate: "2000-01-01"'));
    }
  }
  if (prepare) prepare(dir); // 生成スクリプトを動かす前に複製を整える（git の履歴を作るなど）
  // オーナー端末だけの置き場所（ownerDir）は複製の中に向ける（テストが本物のウォッチリストなどを書き換えない）
  const env = { ...process.env, ATR_OWNER_DIR: path.join(dir, ".owner"), GEMINI_API_KEY: "dummy", NOTE_PAID_RECIPE: RECIPE, MOCK_OUT: mockOut, ...(keepDates ? { MOCK_NOW: String(Date.now() + 3 * 24 * 3600 * 1000) } : {}), ...extraEnv };
  const r = spawnSync(process.execPath, ["--import", pathToFileURL(path.join(root, "tests/fixtures/mock_setup.mjs")).href, "scripts/crawl_and_generate.mjs"], {
    cwd: dir, encoding: "utf8", env, timeout,
  });
  return { dir, log: r.stdout + r.stderr, status: r.status, signal: r.signal };
}
const grepRepo = (dir, needle) => {
  const hits = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    if (SKIP.has(e.name) || e.name === "tests") return; // tests/ は検査用の文字列そのものを含む
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (fs.readFileSync(p).includes(needle)) hits.push(p);
  });
  walk(dir);
  return hits;
};

test("正常な生成物は保存され、有料本文は平文でどこにも残らない", () => {
  const { dir, log } = run(output());
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    assert.ok(fs.existsSync(path.join(dir, "note_drafts/testtool_note.paid.enc")), log);
    assert.deepEqual(grepRepo(dir, "SECRET_PAID_TEXT"), []);
    // 公開日・スター数は生成モデルの出力（2000-01-01 / 99999）ではなく実データ
    const web = fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8");
    const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    assert.match(web, new RegExp(`^pubDate: "${jstToday}"$`, "m"));
    assert.match(web, /^stars: 1234$/m);
    // リポジトリの作成日（JST）を残し、選定のウォッチリスト（次の記事の候補）は公開リポの外（ownerDir）に書く
    assert.match(web, /^repoCreatedAt: "2026-01-15"$/m);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, ".owner", "watchlist.json"), "utf8")).date, jstToday);
    assert.ok(!fs.existsSync(path.join(dir, "data/watchlist.json")), "ウォッチリストを公開リポの data/ に書いた");
    // 推奨ハッシュタグは生成モデルの固定タグ（#副業 #受託開発 を含む）ではなく、言語・トピックから作ったもの
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /^#OSS #Go #cli #devops$/m);
    assert.doesNotMatch(pub, /#副業|#受託開発/);
    // 領収書の案内は定型文にそろえて保存する（tests/receipt_wording.test.mjs が全原稿で確かめる文）
    assert.ok(pub.split("\n").includes("> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。"), pub);
    // 止めた出力（X の投稿文・Zenn の原稿）は作らない
    // （オーナー端末の作業ツリーには追跡外の古いファイルが残っていることがあるので、この記事の分が無いことを見る）
    for (const d of ["x_posts", "zenn_drafts", "articles"]) {
      const made = fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)).filter((f) => f.startsWith("testtool")) : [];
      assert.deepEqual(made, [], `${d}/ に書いた`);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("保存した記事の見出しはテンプレートの見出しだけで、リード・インストール・ライセンスの節と README の事実の集合はデータから作る", async () => {
  const { WEB_TEMPLATE_H2, NOTE_FREE_TEMPLATE_H2, h2Headings, paidHeadingLines } = await import("../scripts/utils/article_template.mjs");
  const { dir, log } = run(output({ paidExtra: "## 📋 提案書テンプレート\n本文\n## 🗣️ 想定問答\n回答" }));
  try {
    const web = fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8");
    assert.ok(h2Headings(web).every((h) => WEB_TEMPLATE_H2.includes(h)), web);
    assert.ok(h2Headings(web).includes("## インストール（README からの転記）"), web);
    assert.ok(h2Headings(web).includes("## ライセンス"), web);
    // リードは作成日（JST）とスター数の記録から
    assert.ok(web.includes("acme/testtool は 2026-01-15 に GitHub で作成されたリポジトリです。"), web);
    assert.match(web, /時点のスター数は 1,234 です。/);
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    const head = pub.split("【有料ライン")[0];
    assert.ok(h2Headings(head).every((h) => NOTE_FREE_TEMPLATE_H2.includes(h)), head);
    assert.ok(head.includes("## はじめに\n\nacme/testtool は 2026-01-15 に GitHub で作成されたリポジトリです。"), head);
    // 有料版の内容一覧は有料部分の節の題から（生成モデルの宣伝文ではない）
    assert.ok(head.includes("### 🔒 有料エリアの内容\n- 導入提案書テンプレート（Markdown）\n- 導入時の想定問答"), head);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "note_drafts/testtool_note.paid.json"), "utf8")).features, ["導入提案書テンプレート（Markdown）", "導入時の想定問答"]);
    assert.deepEqual(paidHeadingLines(head.replace(/^# .*$/m, "")).filter((h) => !/^#{2,3} /.test(h)), []);
    const facts = JSON.parse(fs.readFileSync(path.join(dir, "data/readme_facts/testtool.json"), "utf8"));
    assert.equal(facts.repo, "acme/testtool");
    assert.equal(facts.created_at, "2026-01-15T00:00:00Z");
    assert.deepEqual(Object.keys(facts).sort(), ["commands", "created_at", "diagrams", "expansions", "hosts", "install_blocks", "language", "license", "publication", "quantities", "repo", "sentences", "status_lines", "topics", "usage_lines", "words"]);
    // 掲載時の記録（リード・スター数の元）と GitHub のトピック（note のタグの元）
    assert.deepEqual(facts.publication, { date: fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8").match(/^pubDate: "(.*)"$/m)[1], stars: 1234, gain7d: null });
    assert.deepEqual(facts.topics, ["cli", "devops", "hacktoberfest"]);
    // 公開物（Web 記事・note の無料部分と末尾・X）は、テストと同じ検査（データから作り直したものとの一致）を満たす
    const { webPageProblems, noteHeadProblems, noteTailProblems, webTitle } = await import("../scripts/utils/page_shape.mjs");
    const { splitPaid } = await import("../scripts/utils/note_vault.mjs");
    assert.deepEqual(webPageProblems(web, facts), []);
    const parts = splitPaid(pub);
    assert.deepEqual(noteHeadProblems(parts.head.join("\n"), facts, ["導入提案書テンプレート（Markdown）", "導入時の想定問答"]), []);
    assert.deepEqual(noteTailProblems(parts.tail, facts), []);
    // 公開物に生成モデルが書いた訳は無く、README の文そのものだけ
    assert.ok(web.split("\n").includes("- 原文（README）: testtool is a command-line tool for checking deployment pipelines."), web);
    assert.ok(web.split("\n").includes(`title: ${JSON.stringify(webTitle("testtool"))}`), web);
    assert.ok(head.split("\n").includes("- 原文（README）: testtool reads a YAML file and reports each failed step."), head);
    // X の投稿文はファイルに書かない（公開リポに置かない出力）。文面は tests/page_shape.test.mjs が xThreadText で確かめる
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("1 回の実行で生成する新規記事は 1 本まで（候補が複数あっても 2 本目は生成しない）", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-count-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output(), { MOCK_SECOND_REPO: "1", MOCK_CALLS: calls });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/othertool.md")), log);
    assert.equal(fs.readFileSync(calls, "utf8").length, 1, log);
    assert.match(log, /Reached target count \(1\)/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

test("末尾の案内・ハッシュタグが欠けた生成物は標準の末尾で補って採用する", () => {
  const { dir, log } = run(output({ footer: false }));
  try {
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /^#OSS #Go #cli #devops$/m, log);
    assert.doesNotMatch(pub, /#副業|#受託開発/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const [name, opts, why] of [
  // 図は生成モデルに描かせない（README にある図だけを転記する。leakhunt C3、2026-10-22）
  ["Web記事に生成モデルが描いた構成図を含む", { diagram: 'graph TD\n  A["CLI"] --> B["Core"]' }, /Web記事に README の原文でない行があります/],
  ["実在しないイメージを含む", { image: "ghcr.io/acme/does-not-exist:latest" }, /実在を確認できない参照/],
  ["無料部分に誇張表現（一発起動）を含む", { hype: "コピペで本番一発起動できます。" }, /誇張・結果保証の表現/],
  ["有料部分に収入の金額を含む", { paidExtra: "このSaaSでMRR 50万円を見込めます。" }, /誇張・結果保証の表現/],
  // note の無料部分は生成モデルに書かせない（データから作る）。書いていれば採用しない
  ["生成モデルが note の無料部分を書いている", { free: FREE }, /生成モデルが note の無料部分を書いています/],
  ["Web記事の概要に README の原文が無い", { overview: "## 概要\n## 主な機能と構成（README の原文）" }, /Web記事の概要に README の原文がありません/],
  // 暗号化した後は CI で有料本文を検査できないため、owner PC の出品前検査（utils/owner_checks.mjs）と同じ検査を暗号化の前にかける
  ["有料部分に出品前検査の禁止表現を書き方を変えて含む", { paidExtra: "顧客満足度に直結 します。" }, /出品前の検査に通りません/],
  ["有料部分に積算根拠表の無い金額を含む", { paidExtra: "導入費用は概算 95万〜140万円です。" }, /積算根拠表/],
  ["Web記事に有料キットの見出しを含む（品質ゲートの有料本文の検査に落ちる）", { web: "## 💰 【クライアント提示用】詳細工数・見積シミュレーション表\n| 項目 | 人日 |\n|---|---|\n| 要件定義 | 2 |" }, /有料キットの内容が含まれています/],
  ["無料部分でインボイス対応をうたう", { hype: "インボイス制度にも対応しています。" }, /生成モデルが note の無料部分を書いています/],
  // README の原文の検査（scripts/utils/anchored.mjs）: 原文が README の文でない。訳（日本語の文）は README と照合できないので、どんな内容でも載せない
  ["原文が README の文ではない", { web: "- 原文（README）: testtool is the fastest tool ever built." }, /公開物の形を満たしません（quote）/],
  ["訳を書く（原文に無い社数）", { web: "- testtool は YAML ファイルを読み、300 の組織で使われています。" }, /Web記事に README の原文でない行があります/],
  ["訳を書く（利用条件の結論）", { web: "- testtool は Linux・macOS・Windows で動き、商用利用も問題なく行えます。" }, /Web記事に README の原文でない行があります/],
  ["訳を書く（語の一覧に無い比較・採用実績）", { web: "- 数倍軽く、ジェミニより賢く、十数社の本番環境で稼働中です。" }, /Web記事に README の原文でない行があります/],
  ["H3 の小節に比較表を置く", { web: "### 他のツールとの比較\n| 項目 | testtool | other |\n|---|---|---|\n| 価格 | 0 | 有料 |" }, /Web記事にテンプレート外の見出しがあります/],
  ["Web記事で導入を勧める", { web: "本番環境への導入を推奨します。" }, /Web記事に根拠のない推奨・比較・ライセンス表記があります/],
  ["Web記事に引用の無い比較（優位）を含む", { web: "競合よりも優位です。" }, /Web記事に根拠のない推奨・比較・ライセンス表記があります/],
  ["Web記事で禁止の記載が無いことを根拠にライセンスを推測する", { web: "## 商用利用可否 & ライセンス考察\n明示的な禁止がないため、OSSの慣例として許容されることが多いです。" }, /禁止の記載が無いことを根拠にしたライセンスの推測/],
  ["LICENSE ファイルが無いのに、Web記事が MIT と書く", { web: "## 商用利用可否 & ライセンス考察\nMIT License なので商用利用は可能です。" }, /ライセンス未指定である旨が書かれていない/],
  // README で確かめられない内容を書かせない（leakhunt C3、2026-10-22）
  ["Web記事にテンプレート外の節（競合比較）を含む", { web: "## 競合ツール/商用SaaSとの徹底比較\n| 項目 | testtool |\n|---|---|\n| 起動 | 速い |" }, /Web記事にテンプレート外の見出しがあります/],
  ["Web記事に README に無い削減率を含む", { web: "クラウドAPIコストを9割どころか90％削減できます。" }, /README で確かめられない数値・ホスト・コマンドがあります（quantity）/],
  ["note の無料部分に README に無いホストとコマンドを含む", { free: `${FREE}\n\`\`\`bash\ncurl -fsSL https://cdn.example.net/install.sh | sh\n\`\`\`` }, /README で確かめられない数値・ホスト・コマンドがあります（host, command）/],
  ["Web記事に確かめられない評価の語を含む", { web: "推論を極限まで最適化した革新的なアーキテクチャです。" }, /公開する文面に確かめられない評価の語があります（確かめられない最上級・絶対の評価）/],
  ["note の無料部分に根拠の無い評判を含む", { free: `${FREE}\nシリコンバレーのエンジニアを熱狂させています。` }, /公開する文面に確かめられない評価の語があります（根拠の無い評判・注目度）/],
  ["note の無料部分にテンプレート外の節を含む", { free: `${FREE}\n## 競合ツール/商用SaaSとの徹底比較\n比較の本文` }, /生成モデルが note の無料部分を書いています/],
]) {
  test(`不採用になる: ${name}`, () => {
    const { dir, log } = run(output(opts));
    try {
      assert.match(log, why);
      assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), "不採用の生成物が保存された");
      assert.ok(!fs.existsSync(path.join(dir, "note_drafts/testtool_note.md")), "不採用の生成物が保存された");
      assert.match(log, /::warning title=No new article::/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test("ライセンスは GitHub の表示ではなく LICENSE ファイルの本文から判定してプロンプトに渡し、Web 記事のライセンスの節は生成スクリプトがその判定から書く（生成モデルには書かせない）", () => {
  const promptFile = path.join(os.tmpdir(), `atr-prompt-${process.pid}`);
  const mit = "MIT License\n\nCopyright (c) 2026 acme\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction.\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n";
  const { dir, log } = run(output(), { MOCK_LICENSE_TEXT: mit, MOCK_PROMPT: promptFile });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    const web = fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8");
    assert.ok(web.includes("## ライセンス\n\n- ライセンス: MIT License（SPDX: MIT）\n- 確認先: [LICENSE ファイル](https://github.com/acme/testtool/blob/main/LICENSE)"), web);
    assert.match(web, /法的な助言ではありません/);
    // Web 記事に生成モデルが書くのは README の文だけ（ライセンスの節は生成スクリプトが書く）
    assert.match(fs.readFileSync(promptFile, "utf8"), /生成スクリプトが README・LICENSE ファイル・リポジトリの記録から作る/);
    const prompt = fs.readFileSync(promptFile, "utf8");
    assert.match(prompt, /^ライセンス: MIT License（SPDX: MIT）$/m);
    assert.match(prompt, /^ライセンスの確認先: https:\/\/github\.com\/acme\/testtool\/blob\/main\/LICENSE$/m);
    assert.match(prompt, /禁止の記載が無いことを利用できる根拠にしない/);
    assert.match(prompt, /「要確認」と書き/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(promptFile, { force: true });
  }
});

test("LICENSE ファイルが無いリポジトリは、GitHub の検索結果のライセンス欄があっても「ライセンス未指定」としてプロンプトに渡す", () => {
  const promptFile = path.join(os.tmpdir(), `atr-prompt-none-${process.pid}`);
  const { dir, log } = run(output(), { MOCK_PROMPT: promptFile });
  try {
    const prompt = fs.readFileSync(promptFile, "utf8");
    assert.match(prompt, /^ライセンス: ライセンス未指定（利用許諾なし）$/m, log);
    assert.doesNotMatch(prompt, /^ライセンス: MIT/m);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(promptFile, { force: true });
  }
});

test("Web 記事の検査で不採用になった候補は保存せず、次の候補を試す（CI の npm test で止めない）", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-web-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output({ web: "即座に導入すべきツールです。" }), { MOCK_SECOND_REPO: "1", MOCK_CALLS: calls });
  try {
    assert.equal(fs.readFileSync(calls, "utf8").length, 2, log);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")));
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/othertool.md")));
    assert.match(log, /::warning title=No new article::/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

test("全モデルが利用枠切れ（429 quota）なら、各モデル 1 回ずつで再試行も次の候補も試さず、警告を出して止める", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output(), {
    MOCK_ERROR: '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.","status":"RESOURCE_EXHAUSTED"}}',
    MOCK_CALLS: calls,
  });
  try {
    // 利用枠はモデルごと: 優先リストの 4 モデルを 1 回ずつ試し、すべて枠切れなら止める
    assert.equal(fs.readFileSync(calls, "utf8").length, 4, log);
    assert.match(log, /Gemini quota exhausted/);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

// ---- 生成を無言で止めないための継続性ガード（モデルのフォールバック・実行結果の記録） ----
const jstTodayStr = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const runStatusOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, "data/run_status", `${jstTodayStr()}.json`), "utf8"));
const NOT_FOUND = '{"error":{"code":404,"message":"models/gemini-2.5-flash is not found for API version v1beta, or is not supported for generateContent.","status":"NOT_FOUND"}}';

test("先頭のモデルが 404（not found）なら次のモデルで生成し、使ったモデルを記事と run_status に残す", () => {
  const log = path.join(os.tmpdir(), `atr-models-404-${process.pid}`);
  fs.rmSync(log, { force: true });
  const { dir, log: out } = run(output(), { MOCK_MODEL_ERRORS: JSON.stringify({ "gemini-2.5-flash": NOT_FOUND }), MOCK_MODELS_LOG: log });
  try {
    // 一覧が取れない（モックの既定）ときは静的な優先リストの順に試す
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["gemini-2.5-flash", "gemini-3.5-flash"], out);
    const web = fs.readFileSync(path.join(dir, "src/pages/radar/testtool.md"), "utf8");
    assert.match(web, /^generator_model: "gemini-3\.5-flash"$/m);
    const st = runStatusOf(dir);
    assert.equal(st.date, jstTodayStr());
    assert.deepEqual(Object.keys(st.runs[0]).sort(), ["at", "event", "generated", "model", "reason"]);
    assert.equal(st.runs.at(-1).reason, "ok");
    assert.equal(st.runs.at(-1).generated, 1);
    assert.equal(st.runs.at(-1).model, "gemini-3.5-flash");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(log, { force: true });
  }
});

test("モデル一覧が取れるときは、一覧に載っている優先モデルだけを順に試す", () => {
  const log = path.join(os.tmpdir(), `atr-models-list-${process.pid}`);
  fs.rmSync(log, { force: true });
  const { dir, log: out } = run(output(), {
    MOCK_MODELS: "gemini-2.5-flash-lite,gemini-2.5-flash,gemini-embedding-001",
    MOCK_MODEL_ERRORS: JSON.stringify({ "gemini-2.5-flash": NOT_FOUND }),
    MOCK_MODELS_LOG: log,
  });
  try {
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["gemini-2.5-flash", "gemini-2.5-flash-lite"], out);
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(log, { force: true });
  }
});

test("先頭のモデルだけ 429（利用枠切れ）なら、そのモデルを外して次のモデルで生成する（枠はモデルごと）", () => {
  const log = path.join(os.tmpdir(), `atr-models-429-${process.pid}`);
  fs.rmSync(log, { force: true });
  const { dir, log: out } = run(output(), {
    MOCK_MODEL_ERRORS: JSON.stringify({ "gemini-2.5-flash": "got status: 429 Too Many Requests. RESOURCE_EXHAUSTED" }),
    MOCK_MODELS_LOG: log,
  });
  try {
    assert.deepEqual(fs.readFileSync(log, "utf8").trim().split("\n"), ["gemini-2.5-flash", "gemini-3.5-flash"], out);
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), out);
    const last = runStatusOf(dir).runs.at(-1);
    assert.equal(last.reason, "ok");
    assert.equal(last.model, "gemini-3.5-flash");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(log, { force: true });
  }
});

test("全モデルが 429 なら次の候補を呼ばずに止め、run_status の reason を quota にする", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-429-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const q = "got status: 429 Too Many Requests. RESOURCE_EXHAUSTED";
  const { dir, log } = run(output(), {
    MOCK_SECOND_REPO: "1",
    MOCK_MODEL_ERRORS: JSON.stringify({ "gemini-2.5-flash": q, "gemini-3.5-flash": q, "gemini-3.1-flash-lite": q, "gemini-2.5-flash-lite": q }),
    MOCK_CALLS: calls,
  });
  try {
    assert.equal(fs.readFileSync(calls, "utf8").length, 4, log);
    assert.match(log, /Gemini quota exhausted/);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")));
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/othertool.md")));
    const last = runStatusOf(dir).runs.at(-1);
    assert.equal(last.reason, "quota");
    assert.equal(last.generated, 0);
    assert.equal(last.model, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

test("すべてのモデルが 404 なら次の候補を試さずに止め、reason を model_unavailable にする", () => {
  const calls = path.join(os.tmpdir(), `atr-calls-allnf-${process.pid}`);
  fs.rmSync(calls, { force: true });
  const { dir, log } = run(output(), { MOCK_SECOND_REPO: "1", MOCK_ERROR: NOT_FOUND, MOCK_CALLS: calls });
  try {
    assert.equal(fs.readFileSync(calls, "utf8").length, 4, log); // 優先リストの 4 モデルを 1 回ずつ
    assert.match(log, /Gemini model unavailable/);
    assert.equal(runStatusOf(dir).runs.at(-1).reason, "model_unavailable");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

// ---- 生成時の検査と CI の品質ゲートのずれ・実データの揺れ（2026-10-21 の全体点検で見つかった不具合の再発防止） ----
const readWeb = (dir, slug = "testtool") => fs.readFileSync(path.join(dir, "src/pages/radar", `${slug}.md`), "utf8");
// Mermaid の補正が要る図（ラベルに括弧・コロン）。README にこの形の図があっても、書き換えて直すことはせず、転記しない
const NEEDS_FIX = "graph TD\n  A[CLI (main)] --> B[Core: engine]";
const RENDERABLE = 'graph TD\n  A["CLI"] --> B["Core"]';
const FENCE = "```";
const readmeWith = (diagram) => `${MOCK_README}\n${FENCE}mermaid\n${diagram}\n${FENCE}\n`;

test("図は生成モデルに描かせず、README にある図のうち描画できるものだけをそのまま転記する（描画できない図は転記しない）", async () => {
  for (const [diagram, kept] of [[RENDERABLE, true], [NEEDS_FIX, false]]) {
    const { dir, log } = run(output(), { MOCK_README: readmeWith(diagram) });
    try {
      assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
      const web = readWeb(dir);
      assert.equal(web.includes(diagram), kept, web);
      assert.equal(/README にある図を、そのまま転記/.test(web), kept, web);
      assert.deepEqual(mermaidProblems(web), []);
      assert.deepEqual(await mermaidParseErrors(web), []);
      assert.equal((web.match(/```/g) || []).length % 2, 0);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
});

// 説明文に \ や " や $ を含むリポジトリ（Windows のパス・LaTeX・料金など）。説明文を README の原文として載せても、frontmatter と本文が化けない
const TRICKY_DESC = String.raw`Sync configs under C:\Users\you with "profiles" and save $$ on hosting`;
const TRICKY_OVERVIEW = `## 概要\n${Q}${TRICKY_DESC}\n## 主な機能と構成（README の原文）`;
test("説明文に \\ \" $ を含むリポジトリでも、原文として載せた説明文と題名・説明文は、サイトのビルドと同じ方法で読め、文字が化けない", () => {
  const { dir, log } = run(output({ overview: TRICKY_OVERVIEW }), { MOCK_REPO: JSON.stringify({ description: TRICKY_DESC }) });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    const { frontmatter: fm } = parseFrontmatter(readWeb(dir));
    assert.equal(fm.title, "testtool - README の要点（原文）");
    assert.equal(fm.description, "acme/testtool の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。");
    assert.ok(readWeb(dir).split("\n").includes(`${Q}${TRICKY_DESC}`), readWeb(dir));
    assert.equal(fm.stars, 1234);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("選定ですべての候補が除外された日も、実行結果（reason: no_candidates）を記録する", () => {
  const { dir, log } = run(output(), { MOCK_REPO: JSON.stringify({ archived: true }) });
  try {
    assert.match(log, /選定から除外: acme\/testtool/);
    const last = runStatusOf(dir).runs.at(-1);
    assert.equal(last.reason, "no_candidates", log);
    assert.equal(last.generated, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("手元の作業ツリーが古くても、push 済み（origin/main）に今日の記事があれば 2 本目を生成しない（1 日 1 本）", () => {
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const calls = path.join(os.tmpdir(), `atr-calls-remote-${process.pid}`);
  fs.rmSync(calls, { force: true });
  let remote;
  const { dir, log } = run(output(), { MOCK_CALLS: calls }, {
    prepare: (d) => {
      // 手元（d）: 今日の記事が無い古い状態。リモート: CI が今日の記事を push 済み
      remote = `${d}-remote.git`;
      g(d, "init", "-q", "-b", "main");
      g(d, "add", "-A");
      g(d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "old");
      g(d, "init", "-q", "--bare", "-b", "main", remote);
      g(d, "remote", "add", "origin", remote);
      g(d, "push", "-q", "origin", "main");
      const ci = `${d}-ci`;
      g(d, "clone", "-q", remote, ci);
      fs.writeFileSync(path.join(ci, "src/pages/radar/ci-article.md"), `---\ntitle: "ci"\ndescription: "d"\npubDate: "${jstTodayStr()}"\nrepoUrl: "https://github.com/ci/ci-article"\nstars: 1\n---\n# ci\n`);
      g(ci, "add", "-A");
      g(ci, "-c", "user.name=c", "-c", "user.email=c@c", "commit", "-qm", "ci article");
      g(ci, "push", "-q", "origin", "main");
      fs.rmSync(ci, { recursive: true, force: true });
    },
  });
  try {
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    assert.ok(!fs.existsSync(calls), "Gemini を呼んだ");
    assert.equal(runStatusOf(dir).runs.at(-1).reason, "cap_reached", log);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    if (remote) fs.rmSync(remote, { recursive: true, force: true });
    fs.rmSync(calls, { force: true });
  }
});

test("Gemini が応答を返さないままでも、時間切れにして次のモデルへ進み、実行結果を記録して終了する", () => {
  const { dir, log, signal } = run(output(), { MOCK_HANG: "1", GEMINI_TIMEOUT_MS: "200" }, { timeout: 90000 });
  try {
    assert.equal(signal, null, `生成スクリプトが終わらない: ${log.slice(-500)}`);
    assert.match(log, /timed out|時間切れ/);
    assert.ok(!fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")));
    assert.equal(runStatusOf(dir).runs.at(-1).reason, "error");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// クラス単位の再発防止: 生成スクリプトが採用して保存したものは、CI の品質ゲート（commit 前の audit_quality と npm test）にそのまま通る。
// 生成時の検査がゲートより緩いと、その回の生成物はゲートで丸ごと取り除かれ（実行も失敗扱い）、次の便も同じ候補で同じことを繰り返す。
// ゲートのテストはここで列挙せず tests/ から集める（新しく足した内容検査も自動で対象になる）。
// 除くのは、このファイル自身・ゲート自体の検証（複製に不具合を入れる gates）・オーナー端末のブラウザ操作（note_browser）・
// テストの実行環境の検査（env_portability: git の作業ツリーと npm test の仕組みを確かめる。生成物の内容の検査ではなく、.git の無い複製では成り立たない）だけ
const NOT_GATE = new Set(["generator.test.mjs", "gates.test.mjs", "note_browser.test.mjs", "env_portability.test.mjs"]);
test("生成して保存した記事・原稿は、CI の品質ゲート（監査と npm test のテスト群）にそのまま通る", () => {
  // CI の品質ゲートは、checkout した git の作業ツリーで、生成物が未追跡のまま走る（git の追跡・無視を見る門がある）。
  // 複製（.git を除いて写す）を git にして元の木をコミットし、生成物は未追跡のまま残す
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const prepare = (d) => {
    g(d, "init", "-q", "-b", "main");
    g(d, "add", "-A");
    g(d, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "tree before generation");
  };
  // 生成するリポジトリは、ゲートのテストが使う架空の候補（tests/fixtures/mock_setup.mjs の acme/testtool）と別にする。
  // 同じだと、ゲートの中で生成スクリプトを動かすテスト（paid_boundary など）が「掲載済み」として候補を飛ばし、別の結果を見る（CI の実記事は架空の候補と重ならない）
  const repo = { name: "gatetool", full_name: "gate/gatetool", html_url: "https://github.com/gate/gatetool", owner: { login: "gate" }, description: TRICKY_DESC };
  const { dir, log } = run(output({ overview: TRICKY_OVERVIEW }), { MOCK_REPO: JSON.stringify(repo), MOCK_README: readmeWith(RENDERABLE) }, { keepDates: true, prepare });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/gatetool.md")), log);
    const audit = spawnSync(process.execPath, ["scripts/audit_quality.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(audit.status, 0, (audit.stdout + audit.stderr).split("\n").filter((l) => l.includes("❌")).join("\n") || (audit.stdout + audit.stderr).slice(-1500));
    const files = fs.readdirSync(path.join(dir, "tests")).filter((f) => f.endsWith(".test.mjs") && !NOT_GATE.has(f)).map((f) => `tests/${f}`);
    const t = spawnSync(process.execPath, ["--test", ...files], { cwd: dir, encoding: "utf8" });
    assert.equal(t.status, 0, t.stdout.split("\n").filter((l) => /^\s*(?:not ok|✖)|^\s+error:|^\s+(?:expected|actual):|^\s+(?:AssertionError|Error)\b/.test(l)).slice(0, 80).join("\n")); // 中は spec の形（✖ の行がテスト名）
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("GitHub の検索がすべて失敗した日は「候補なし」にせず、upstream_unavailable として ::error で知らせる", () => {
  const { dir, log } = run(output(), { MOCK_SEARCH_STATUS: "503" });
  try {
    assert.match(log, /::error title=GitHub search::/);
    const last = runStatusOf(dir).runs.at(-1);
    assert.equal(last.reason, "upstream_unavailable", log);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("README を取得できない（429 など）候補は「README が不十分」にせず、試行回数も使わない。記事が出なければ upstream_unavailable", () => {
  const { dir, log } = run(output(), { MOCK_README_STATUS: "429" });
  try {
    assert.doesNotMatch(log, /READMEが不十分/);
    assert.match(log, /README を取得できない/);
    assert.match(log, /::warning title=GitHub README::/);
    const last = runStatusOf(dir).runs.at(-1);
    assert.equal(last.reason, "upstream_unavailable", log);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
