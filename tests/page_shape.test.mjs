// 公開物の形（leakhunt C3・C4、2026-10-22）: Web 記事・note の無料部分・note の末尾・X の投稿文は、データ
// （data/readme_facts/<slug>.json の README の事実・掲載時の記録・トピック、*.paid.json の有料版の内容一覧）と、
// 生成モデルが README から選んだ原文（README の文そのもの）だけから決まった形で作る。
// 検査は語の一覧ではなく「同じデータから作り直したものと 1 文字も違わないこと」と「原文が README の文であること」。
// どの節にどんな言い方で文を足しても（訳・比較・採用実績・評価・題名の書き換え・スター数の書き換え）赤になる
import test from "node:test";
import assert from "node:assert/strict";
import { readmeFacts } from "../scripts/utils/readme_facts.mjs";
import {
  renderWebPage, webPageProblems, renderNoteHead, noteHeadProblems, noteFooter, noteTailProblems, noteTitle, webTitle,
  paidFeatureProblems, CORRECTION_NOTES,
} from "../scripts/utils/page_shape.mjs";
import { xThreadText } from "../scripts/utils/x_thread.mjs";

const README = [
  "# GridCraft",
  "**GridCraft** is an open-source spreadsheet written in pure Rust.",
  "It runs on macOS, Windows and Linux, and in the browser via WebAssembly.",
  "",
  "- Implements 513 of 523 worksheet functions.",
  "- The engine crate evaluates formulas and the mcp crate exposes a server for agents.",
  "",
  "GridCraft is alpha software.",
  "",
  "## Install",
  "```bash",
  "cargo run --release -p gridcraft",
  "```",
].join("\n");
const facts = {
  ...readmeFacts(README, {
    repo: "storytold/gridcraft", created_at: "2026-10-07T05:18:16Z", language: "Rust", description: "Excel-compatible spreadsheet.",
    license: { spdx: "MIT", name: "MIT License", url: "https://github.com/storytold/gridcraft/blob/main/LICENSE", status: "resolved", sourceAvailable: false, extraNotices: [] },
  }),
  publication: { date: "2026-10-18", stars: 5729, gain7d: null },
  topics: ["spreadsheet", "rust", "wasm-runtime"],
};
const overview = ["GridCraft is an open-source spreadsheet written in pure Rust.", "It runs on macOS, Windows and Linux, and in the browser via WebAssembly."];
const architecture = ["The engine crate evaluates formulas and the mcp crate exposes a server for agents."];
const base = { facts, overview, architecture, updatedDate: "2026-10-22", corrections: [{ date: "2026-10-22", note: CORRECTION_NOTES.quotesOnly }] };
const page = renderWebPage(base);
const kinds = (md, f = facts) => webPageProblems(md, f).map((p) => p.kind);
const inject = (text, after, add) => {
  assert.ok(text.includes(after), after);
  return text.replace(after, `${after}\n${add}`);
};

test("データと README の原文から作った Web 記事は検査を満たし、題名・説明文・タグに生成モデルの文が入らない", () => {
  assert.deepEqual(webPageProblems(page, facts), []);
  assert.ok(page.split("\n").includes(`title: ${JSON.stringify(webTitle("gridcraft"))}`), page);
  assert.match(page, /^tags: \["Rust","OSS","GitHub"\]$/m);
  assert.match(page, /^stars: 5729$/m);
  assert.ok(page.includes(`- 原文（README）: ${overview[0]}`), page);
});

test("Web 記事: 訳・評価・比較・採用実績の文は、語の一覧に無い言い方でも、どの節に足しても赤", () => {
  const q0 = `- 原文（README）: ${overview[0]}`;
  const qa = `- 原文（README）: ${architecture[0]}`;
  for (const add of [
    "- 8,192 トークンまで読み、ジェミニより賢いです。",
    "- バッチ不変の推論: 十数社の本番環境で結果を同じに保ちます。",
    "金融機関で稼働中です。",
    "- 数倍軽く、クロードの代わりになります。精度は人間並みで、本番で実証済みです。",
    "\n### 他のスプレッドシートとの比較\n\n| 項目 | GridCraft | Excel |\n|---|---|---|\n| 価格 | 0 | 有料 |",
    "\n`pip install gridcraft-turbo` で入ります。",
  ]) {
    assert.ok(kinds(inject(page, q0, add)).includes("render"), add);
    assert.ok(kinds(inject(page, qa, add)).includes("render"), add);
  }
  // 原文の行の形をしていても、README の文でなければ赤
  assert.ok(kinds(inject(page, q0, "- 原文（README）: GridCraft is used in production by large banks.")).includes("quote"));
  assert.ok(kinds(page.replace("written in pure Rust.", "written in blazing fast Rust.")).includes("quote"));
});

test("Web 記事: 題名・説明文・タグ・リード・成熟度・インストール・ライセンス・図を書き換えると赤", () => {
  assert.ok(kinds(page.replace(/^title: .*$/m, 'title: "gridcraft - Excel を超える次世代スプレッドシート"')).includes("render"));
  assert.ok(kinds(page.replace(/^description: .*$/m, 'description: "大手企業も採用"')).includes("render"));
  assert.ok(kinds(page.replace(/^tags: .*$/m, 'tags: ["Rust","OSS","GitHub","Handsontable"]')).includes("render"));
  assert.ok(kinds(page.replace("時点のスター数は 5,729 です。", "時点のスター数は 912,071 です。")).includes("render"));
  assert.ok(kinds(page.replace("に GitHub で作成されたリポジトリです。", "に公開され、世界中で注目を集めています。")).includes("render"));
  assert.ok(kinds(page.replace("## ライセンス\n", "## ライセンス\n\n商用利用も問題なく行えます。\n")).includes("render"));
  assert.ok(kinds(page.replace("cargo run --release -p gridcraft", "cargo run --release -p gridcraft --features turbo")).includes("render"));
  const FENCE = "```";
  assert.ok(kinds(inject(page, `- 原文（README）: ${architecture[0]}`, `\n${FENCE}mermaid\ngraph TD\n  A["engine"] --> B["mcp（Port 9999）"]\n${FENCE}`)).includes("render"));
});

test("Web 記事: frontmatter のスター数・公開日は掲載時の記録（data/readme_facts の publication）と一致すること", () => {
  // リードとスター数の両方を書き換えても、記録と違えば赤
  const both = page.replace("時点のスター数は 5,729 です。", "時点のスター数は 912,071 です。").replace(/^stars: 5729$/m, "stars: 912071");
  assert.ok(kinds(both).includes("publication"));
  assert.ok(kinds(page.replaceAll("2026-10-18", "2026-10-01")).includes("publication"));
  assert.ok(kinds(page, { ...facts, publication: undefined }).includes("publication"));
});

test("Web 記事: 訂正の記録は決まった文（CORRECTION_NOTES）か、記録済みの過去の訂正（facts.corrections_keys）だけ", () => {
  const free = page.replace(CORRECTION_NOTES.quotesOnly, "比較の記述を、ジェミニより速いことが分かるように改めました");
  assert.ok(kinds(free).includes("corrections"));
  for (const note of Object.values(CORRECTION_NOTES)) assert.deepEqual(kinds(page.replace(CORRECTION_NOTES.quotesOnly, note)), [], note);
});

const features = ["導入提案書テンプレート（Markdown）", "工数・見積表"];
const head = renderNoteHead({ facts, quotes: [...overview, ...architecture], features });
const noteKinds = (h, fs = features) => noteHeadProblems(h, facts, fs).map((p) => p.kind);

test("note の無料部分はデータと原文から作った形と一致し、題名は名前と有料版の内容一覧だけから作る", () => {
  assert.deepEqual(noteHeadProblems(head, facts, features), []);
  assert.equal(head.split("\n")[0], noteTitle("gridcraft", features));
  assert.match(head.split("\n").at(-1), /有料ライン/);
  assert.doesNotMatch(noteTitle("gridcraft", features), /商用化|SaaS|急上昇|マニュアル/);
});

test("note の無料部分: 題名・訳・内容一覧・価格の案内を書き換えると赤", () => {
  assert.ok(noteKinds(head.replace(/^# .*$/m, "# 「gridcraft」｜GPT-4 より賢い判断エンジン。大手企業も採用")).includes("render"));
  assert.ok(noteKinds(head.replace(/^# .*$/m, "# OpenAI の API 代を払わずに済む決定版")).includes("render"));
  assert.ok(noteKinds(inject(head, `- 原文（README）: ${overview[0]}`, "- 判断エンジンで、金融機関で稼働中です。")).includes("render"));
  assert.ok(noteKinds(head.replace("- 工数・見積表", "- 工数・見積表\n- インストール手順の完全版")).includes("render"));
  assert.ok(noteKinds(head.replace("本記事の価格は", "今だけ本記事の価格は")).includes("render"));
  assert.ok(noteKinds(head.replace("時点のスター数は 5,729 です。", "時点のスター数は 912,071 です。")).includes("render"));
});

test("note の末尾（公開されたまま暗号化しない部分）はデータから作った決まった形だけ。タグの形をした有料本文は赤", () => {
  const tail = noteFooter(facts);
  const tags = "#OSS #Rust #spreadsheet #wasm_runtime";
  assert.deepEqual(noteTailProblems(tail, facts), []);
  assert.ok(tail.split("\n").includes(tags), tail);
  for (const extra of ["#受託単価は人日8万円", "#本番はポート8080", "#AI #OSS #エンジニア"]) {
    assert.ok(noteTailProblems(tail.replace(tags, `${tags}\n${extra}`), facts).length, extra);
    assert.ok(noteTailProblems(tail.replace(tags, extra), facts).length, extra);
  }
  assert.ok(noteTailProblems(`---\n### 🎁 【メンバーシップのご案内】\n#受託単価は人日8万円\n${tail}`, facts).length);
});

test("README が利用を学習用途・非商用に限っていれば、ライセンスの節にその原文を示し、活用・収益化を有料版の売りにしない", () => {
  const md = `${README}\n\nThis project is for non-commercial use only.\n`;
  const nc = { ...readmeFacts(md, { repo: facts.repo, created_at: facts.created_at, language: "Rust", license: facts.license }), publication: facts.publication, topics: [] };
  const p = renderWebPage({ ...base, facts: nc });
  assert.deepEqual(webPageProblems(p, nc), []);
  assert.ok(p.includes("- 原文（README）: This project is for non-commercial use only."), p);
  assert.ok(paidFeatureProblems(["活用・収益化の考え方"], nc).length);
  assert.deepEqual(paidFeatureProblems(["工数・見積表"], nc), []);
  assert.deepEqual(paidFeatureProblems(["活用・収益化の考え方"], facts), []);
});

test("X の投稿文はデータ（名前・スター数・README の最初の原文・有料版の内容一覧）だけから作る", () => {
  const x = xThreadText({ facts, slug: "gridcraft", quote: overview[0], features });
  assert.ok(x.includes(overview[0]), x);
  assert.ok(x.includes("5,729"), x);
  assert.ok(x.includes("導入提案書テンプレート（Markdown）"), x);
  assert.equal(x, xThreadText({ facts, slug: "gridcraft", quote: overview[0], features }));
  assert.doesNotMatch(x, /凄い|注目|最先端|ハルシネーション|削減|商用化|SaaS/);
  // 有料版の無い記事では、有料版の案内を出さない
  assert.doesNotMatch(xThreadText({ facts, slug: "gridcraft", quote: overview[0], features: [] }), /有料/);
});
