// 公開物の形（leakhunt C3、2026-10-22）: Web 記事と note の無料部分は、決まった節（リード・成熟度・インストール・ライセンス・価格の案内）と
// 原文つきの文（scripts/utils/anchored.mjs）と構成図だけでできている。原文を伴わない行（比較表・H3 の小節・自由な段落・
// インラインのコマンド・素のホスト名）は形の検査で赤にする。生成スクリプトと tests/readme_grounding.test.mjs が同じ検査を使う
import test from "node:test";
import assert from "node:assert/strict";
import { readmeFacts } from "../scripts/utils/readme_facts.mjs";
import { renderWebPage, webPageProblems, renderNoteHead, noteHeadProblems } from "../scripts/utils/page_shape.mjs";

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
const facts = readmeFacts(README, {
  repo: "storytold/gridcraft", created_at: "2026-10-07T05:18:16Z", language: "Rust", description: "Excel-compatible spreadsheet.",
  license: { spdx: "MIT", name: "MIT License", url: "https://github.com/storytold/gridcraft/blob/main/LICENSE", status: "resolved", sourceAvailable: false, extraNotices: [] },
});
const overview = [
  { ja: "GridCraft は、純粋な Rust で書かれたオープンソースのスプレッドシートです。", quote: "GridCraft is an open-source spreadsheet written in pure Rust." },
  { ja: "macOS・Windows・Linux と、WebAssembly によりブラウザで動作します。", quote: "It runs on macOS, Windows and Linux, and in the browser via WebAssembly." },
];
const architecture = [{ ja: "engine クレートが数式を評価し、mcp クレートがエージェント向けのサーバーを提供します。", quote: "The engine crate evaluates formulas and the mcp crate exposes a server for agents." }];
const base = {
  frontmatter: 'layout: "../../layouts/Layout.astro"\npubDate: "2026-10-18"\ntags: ["Rust", "OSS", "GitHub"]\nrepoUrl: "https://github.com/storytold/gridcraft"\nstars: 5729',
  name: "gridcraft", stars: 5729, date: "2026-10-18", overview, architecture, facts,
};
const page = renderWebPage(base);
const kinds = (md) => webPageProblems(md, facts).map((p) => p.kind);

test("決まった形で作った Web 記事は形の検査を満たす", () => {
  assert.deepEqual(webPageProblems(page, facts), []);
  assert.match(page, /^title: "gridcraft - GridCraft は、純粋な Rust/m);
  assert.match(page, /^description: "GridCraft は、純粋な Rust/m);
});

const inject = (after, add) => {
  assert.ok(page.includes(after), after);
  return page.replace(after, `${after}\n${add}`);
};

test("Web 記事: 原文を伴わない行は、どの節に入れても赤（H3 の小節と比較表・自由な段落・素のホスト名・インラインのコマンド）", () => {
  const archLast = `  - 原文（README）: ${architecture[0].quote}`;
  assert.ok(kinds(inject(archLast, "\n### 他のスプレッドシートとの比較\n\n| 項目 | GridCraft | Excel |\n|---|---|---|\n| 価格 | 0 | 有料 |")).includes("stray"));
  assert.ok(kinds(inject(`  - 原文（README）: ${overview[1].quote}`, "\n人件費を大きく減らせます。")).includes("stray"));
  assert.ok(kinds(inject(`  - 原文（README）: ${overview[0].quote}`, "\nベンチマークは bench.gridcraft-labs.example にあります。")).includes("stray"));
  assert.ok(kinds(inject(archLast, "\n`pip install gridcraft-turbo` で入ります。")).includes("stray"));
});

test("Web 記事: 決まった節（リード・成熟度・インストール・ライセンス）を書き換えると赤", () => {
  assert.ok(kinds(page.replace("に GitHub で作成されたリポジトリです。", "に公開され、世界中で注目を集めています。")).includes("lede"));
  assert.ok(kinds(page.replace("## ライセンス\n", "## ライセンス\n\n商用利用も問題なく行えます。\n")).includes("section"));
  assert.ok(kinds(page.replace("cargo run --release -p gridcraft", "cargo run --release -p gridcraft --features turbo")).includes("section"));
  assert.ok(kinds(page.replace("## 🎯 成熟度の目安（README の記載）\n", "## 🎯 成熟度の目安（README の記載）\n\n本番投入に十分な成熟度です。\n")).includes("section"));
});

const FENCE = "```";
test("Web 記事: 題名・説明文・タグも原文に縛られ、構成図は README の図の転記だけ（生成モデルが描いた図は赤）", () => {
  assert.ok(kinds(page.replace(/^title: .*$/m, 'title: "gridcraft - Excel を超える次世代スプレッドシート"')).includes("frontmatter"));
  assert.ok(kinds(page.replace(/^tags: .*$/m, 'tags: ["Rust", "OSS", "GitHub", "Handsontable"]')).includes("frontmatter"));
  const archLast = `  - 原文（README）: ${architecture[0].quote}`;
  assert.ok(kinds(inject(archLast, `\n${FENCE}mermaid\ngraph TD\n  A["engine"] --> B["mcp サーバー（Port 9999）"]\n${FENCE}`)).includes("diagram"));
  // README に図があれば、それだけをそのまま転記する
  const withDiagram = readmeFacts(`${README}\n\n${FENCE}mermaid\ngraph TD\n  A --> B\n${FENCE}\n`, { repo: "storytold/gridcraft", created_at: facts.created_at, language: "Rust", license: facts.license });
  const p2 = renderWebPage({ ...base, facts: withDiagram });
  assert.deepEqual(webPageProblems(p2, withDiagram), []);
  assert.match(p2, /README にある図を、そのまま転記/);
  assert.ok(webPageProblems(p2.replace("  A --> B", '  A --> C["Excel より速い"]'), withDiagram).some((p) => p.kind === "diagram"));
});

test("Web 記事: 原文つきの文の訳が原文を超えると赤（語の類・トークン・原文の指紋）", () => {
  // 題名・説明文も同じ文から作るので、すべての箇所を書き換える
  assert.ok(kinds(page.replaceAll("オープンソースのスプレッドシートです。", "オープンソースのスプレッドシートで、商用利用も可能です。")).includes("topic"));
  assert.ok(kinds(page.replaceAll("オープンソースのスプレッドシートです。", "オープンソースのスプレッドシートで、300 の組織で使われています。")).includes("token"));
  assert.ok(kinds(page.replace("written in pure Rust.", "written in blazing fast Rust.")).includes("quote"));
});

const noteBase = { title: "# 海外急上昇OSS「gridcraft」商用化マニュアル｜社内DX提案書", stars: 5729, date: "2026-10-18", statements: [...overview, ...architecture], features: ["導入提案書テンプレート（Markdown）", "工数・見積表"], facts };
const head = renderNoteHead(noteBase);
const noteKinds = (h, features = noteBase.features) => noteHeadProblems(h, facts, features).map((p) => p.kind);

test("決まった形で作った note の無料部分は形の検査を満たし、有料ラインの行で終わる", () => {
  assert.deepEqual(noteHeadProblems(head, facts, noteBase.features), []);
  assert.match(head.split("\n").at(-1), /有料ライン/);
});

test("note の無料部分: 原文を伴わない行・内容一覧の改変・価格の案内の改変は赤", () => {
  assert.ok(noteKinds(head.replace("### 🔒 有料エリアの内容", "**💰 工数見積の考え方（抜粋）**\n人日の目安を示します。\n\n### 🔒 有料エリアの内容")).includes("stray"));
  assert.ok(noteKinds(head.replace(`  - 原文（README）: ${overview[0].quote}`, `  - 原文（README）: ${overview[0].quote}\n\n\`kev-turbo serve --gpu all\` で起動します。`)).includes("stray"));
  assert.ok(noteKinds(head.replace("- 工数・見積表", "- 工数・見積表\n- インストール手順の完全版")).includes("section"));
  assert.ok(noteKinds(head.replace("本記事の価格は", "今だけ本記事の価格は")).includes("section"));
});
