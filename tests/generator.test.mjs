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

const root = path.resolve(import.meta.dirname, "..");

// このテストが作る git リポジトリを、マシンの git 設定（owner PC の core.autocrlf=true など）から切り離す
isolateGitConfig();
const SKIP = new Set(["node_modules", "dist", ".git", ".astro", ".claude"]);

const PAID = "## 有料の中身 SECRET_PAID_TEXT\n" + "提案書と見積の本文。".repeat(200);
// receipt: 無料部分の領収書の案内（生成モデルが雛形の定型文を少し言い換えた形。保存時に定型文にそろえる）
// web: Web 記事の末尾に足す本文（導入の勧め・ライセンスの節などの検査用）
// free: note の無料部分の本文（公開側の原稿は品質ゲートの最小の長さ以上になる）
const FREE = "この記事では、公式 README に沿って導入の流れと注意点を説明します。".repeat(15);
// diagram: Mermaid 図の中身（既定は補正の要らない図）。frontmatter: Web 記事の frontmatter（null なら書かない＝生成モデルが frontmatter を省いた出力）
const DEFAULT_FRONTMATTER = 'layout: "../../layouts/Layout.astro"\ntitle: "testtool - test"\ndescription: "test"\npubDate: "2000-01-01"\ntags: ["Go"]\nrepoUrl: "https://github.com/acme/testtool"\nstars: 99999';
const output = ({ mermaid = true, diagram = 'graph TD\n  A["CLI"] --> B["Core"]', frontmatter = DEFAULT_FRONTMATTER, footer = true, image = "", hype = "", paidExtra = "", web = "", free = FREE, receipt = "> ※noteは購入後、マイページから領収書を発行できます。" } = {}) => `=== WEB ARTICLE ===
${frontmatter === null ? "" : `---\n${frontmatter}\n---`}
# testtool: 概要と革新性
## 解決する主要な課題とアーキテクチャ
${mermaid ? `\`\`\`mermaid\n${diagram}\n\`\`\`` : "図なし"}
${web}
=== NOTE ARTICLE ===
# testtool note
${free}
無料部分の導入。${hype}経費精算にも使えます。
${receipt}
--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------
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
  const env = { ...process.env, GEMINI_API_KEY: "dummy", MOCK_OUT: mockOut, ...(keepDates ? { MOCK_NOW: String(Date.now() + 3 * 24 * 3600 * 1000) } : {}), ...extraEnv };
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
    // リポジトリの作成日（JST）を残し、選定のウォッチリストを書く
    assert.match(web, /^repoCreatedAt: "2026-01-15"$/m);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "data/watchlist.json"), "utf8")).date, jstToday);
    // 推奨ハッシュタグは生成モデルの固定タグ（#副業 #受託開発 を含む）ではなく、言語・トピックから作ったもの
    const pub = fs.readFileSync(path.join(dir, "note_drafts/testtool_note.md"), "utf8");
    assert.match(pub, /^#OSS #Go #cli #devops$/m);
    assert.doesNotMatch(pub, /#副業|#受託開発/);
    // 領収書の案内は定型文にそろえて保存する（tests/receipt_wording.test.mjs が全原稿で確かめる文）
    assert.ok(pub.split("\n").includes("> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。"), pub);
    // Zenn への自動公開は停止中: articles/ には下書き（published: false）として書く
    const zenn = fs.readFileSync(path.join(dir, "articles/testtool-tech-radar.md"), "utf8");
    assert.match(zenn, /^published: false$/m);
    assert.doesNotMatch(zenn, /^published: true$/m);
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
  ["構成図が無い", { mermaid: false }, /Mermaid/],
  ["実在しないイメージを含む", { image: "ghcr.io/acme/does-not-exist:latest" }, /実在を確認できない参照/],
  ["無料部分に誇張表現（一発起動）を含む", { hype: "コピペで本番一発起動できます。" }, /誇張・結果保証の表現/],
  ["有料部分に収入の金額を含む", { paidExtra: "このSaaSでMRR 50万円を見込めます。" }, /誇張・結果保証の表現/],
  ["無料部分に領収書の案内が無い", { receipt: "" }, /領収書の案内（定型文）が無料部分にありません/],
  // 暗号化した後は CI で有料本文を検査できないため、owner PC の出品前検査（utils/owner_checks.mjs）と同じ検査を暗号化の前にかける
  ["有料部分に出品前検査の禁止表現を書き方を変えて含む", { paidExtra: "顧客満足度に直結 します。" }, /出品前の検査に通りません/],
  ["有料部分に積算根拠表の無い金額を含む", { paidExtra: "導入費用は概算 95万〜140万円です。" }, /積算根拠表/],
  ["note の公開部分が品質ゲートの最小の長さより短い", { free: "" }, /公開部分が短すぎます/],
  ["Web記事に有料キットの見出しを含む（品質ゲートの有料本文の検査に落ちる）", { web: "## 💰 【クライアント提示用】詳細工数・見積シミュレーション表\n| 項目 | 人日 |\n|---|---|\n| 要件定義 | 2 |" }, /有料キットの内容が含まれています/],
  ["無料部分でインボイス対応をうたう", { hype: "インボイス制度にも対応しています。" }, /インボイス対応・即時発行・経費精算できるという断定/],
  ["Web記事で導入を勧める", { web: "本番環境への導入を推奨します。" }, /Web記事に根拠のない推奨・比較・ライセンス表記があります/],
  ["Web記事に引用の無い比較（優位）を含む", { web: "競合よりも優位です。" }, /Web記事に根拠のない推奨・比較・ライセンス表記があります/],
  ["Web記事で禁止の記載が無いことを根拠にライセンスを推測する", { web: "## 商用利用可否 & ライセンス考察\n明示的な禁止がないため、OSSの慣例として許容されることが多いです。" }, /禁止の記載が無いことを根拠にしたライセンスの推測/],
  ["LICENSE ファイルが無いのに、Web記事が MIT と書く", { web: "## 商用利用可否 & ライセンス考察\nMIT License なので商用利用は可能です。" }, /ライセンス未指定である旨が書かれていない/],
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

test("ライセンスは GitHub の表示ではなく LICENSE ファイルの本文から判定してプロンプトに渡し、Web 記事の表記が一致すれば採用する", () => {
  const promptFile = path.join(os.tmpdir(), `atr-prompt-${process.pid}`);
  const mit = "MIT License\n\nCopyright (c) 2026 acme\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the \"Software\"), to deal\nin the Software without restriction.\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n";
  const { dir, log } = run(output({ web: "## 商用利用可否 & ライセンス考察\nMIT License です（[LICENSE](https://github.com/acme/testtool/blob/main/LICENSE)）。" }), { MOCK_LICENSE_TEXT: mit, MOCK_PROMPT: promptFile });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
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
// Mermaid の補正が要る図（ラベルに括弧・コロン）。補正しないとサイトで描画できず、品質ゲートで落ちる
const NEEDS_FIX = "graph TD\n  A[CLI (main)] --> B[Core: engine]";

test("記事の最後が Mermaid 図でも、図を補正・検査してから保存する（閉じの ``` を落として補正・検査を素通りさせない）", async () => {
  const { dir, log } = run(output({ diagram: NEEDS_FIX }));
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    const web = readWeb(dir);
    assert.deepEqual(mermaidProblems(web), []);
    assert.deepEqual(await mermaidParseErrors(web), []);
    assert.match(web, /A\["CLI \(main\)"\]/);
    assert.equal((web.match(/```/g) || []).length % 2, 0);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// 説明文に \ や " や $$ を含むリポジトリ（Windows のパス・LaTeX・料金など）。frontmatter は生成モデルが書く場合と、省いて生成スクリプトが補う場合がある
const TRICKY_DESC = String.raw`Sync configs under C:\Users\you with "profiles" and save $$ on hosting`;
for (const [name, frontmatter] of [
  ["生成モデルが説明文をそのまま \"...\" に入れた", DEFAULT_FRONTMATTER.replace('title: "testtool - test"', () => `title: "testtool - ${TRICKY_DESC}"`).replace('description: "test"', () => `description: "${TRICKY_DESC}"`)],
  ["生成モデルが frontmatter を省いた（生成スクリプトが補う）", null],
]) {
  test(`説明文に \\ " $$ を含むリポジトリでも、frontmatter はサイトのビルドと同じ方法で読め、文字が化けない: ${name}`, () => {
    const { dir, log } = run(output({ frontmatter }), { MOCK_REPO: JSON.stringify({ description: TRICKY_DESC }) });
    try {
      assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
      const { frontmatter: fm } = parseFrontmatter(readWeb(dir));
      for (const k of ["title", "description"]) {
        assert.ok(fm[k].includes(String.raw`C:\Users\you`), `${k}: ${fm[k]}`);
        assert.ok(fm[k].includes("$$ on hosting"), `${k}: ${fm[k]}`);
        assert.match(fm[k], /["']profiles["']/);
      }
      assert.equal(fm.stars, 1234);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
}

test("リポジトリ名が . で始まる（.claude など）場合も、X 投稿文の記事リンクは保存した記事ページを指す", () => {
  const { dir, log } = run(output(), { MOCK_REPO: JSON.stringify({ name: ".claude", full_name: "acme/.claude", html_url: "https://github.com/acme/.claude" }) });
  try {
    const pages = fs.readdirSync(path.join(dir, "src/pages/radar")).filter((f) => readWeb(dir, f.replace(/\.md$/, "")).includes("https://github.com/acme/.claude"));
    assert.equal(pages.length, 1, log);
    const slug = pages[0].replace(/\.md$/, "");
    const x = fs.readFileSync(path.join(dir, "x_posts", `${slug}_x.txt`), "utf8");
    const linked = [...x.matchAll(/\/auto-tech-radar\/radar\/([^/\s%]+)\//g)].map((m) => m[1]);
    assert.ok(linked.length > 0, x);
    assert.deepEqual([...new Set(linked)], [slug], "X 投稿文のリンク先と記事ページのスラッグが違う（404 になる）");
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
// 除くのは、このファイル自身・ゲート自体の検証（複製に不具合を入れる gates）・オーナー端末のブラウザ操作（note_browser）だけ
const NOT_GATE = new Set(["generator.test.mjs", "gates.test.mjs", "note_browser.test.mjs"]);
test("生成して保存した記事・原稿は、CI の品質ゲート（監査と npm test のテスト群）にそのまま通る", () => {
  const { dir, log } = run(output({ diagram: NEEDS_FIX }), { MOCK_REPO: JSON.stringify({ description: TRICKY_DESC }) }, { keepDates: true });
  try {
    assert.ok(fs.existsSync(path.join(dir, "src/pages/radar/testtool.md")), log);
    const audit = spawnSync(process.execPath, ["scripts/audit_quality.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(audit.status, 0, (audit.stdout + audit.stderr).split("\n").filter((l) => l.includes("❌")).join("\n") || (audit.stdout + audit.stderr).slice(-1500));
    const files = fs.readdirSync(path.join(dir, "tests")).filter((f) => f.endsWith(".test.mjs") && !NOT_GATE.has(f)).map((f) => `tests/${f}`);
    const t = spawnSync(process.execPath, ["--test", ...files], { cwd: dir, encoding: "utf8" });
    assert.equal(t.status, 0, t.stdout.split("\n").filter((l) => /^not ok|^\s+not ok|^\s+error:|^\s+(?:expected|actual):/.test(l)).slice(0, 40).join("\n"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
