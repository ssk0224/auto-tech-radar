// 公開物に生成モデルが書く文は、1 文ずつ README の原文（README の文そのもの）を伴う（leakhunt C3、2026-10-22）。
// 原文が README の文であることは README の文の指紋（data/readme_facts の sentences）で、訳文が原文に無い固有名・数値・ホストを
// 足していないことはトークンの包含で、訳文に評価・比較・利用条件・費用・評判の語が無いことは語の類で確かめる。
// 原文を伴わない行（比較表・H3 の小節・自由な段落・インラインのコマンド）は、記事の形の検査で赤にする
import test from "node:test";
import assert from "node:assert/strict";
import {
  readmeSentences, sentenceKey, readmeSentenceKeys, parseStatements, renderStatements,
  statementProblems, statusLines, maturitySection, QUOTE_PREFIX,
} from "../scripts/utils/anchored.mjs";

const README = [
  "# GridCraft",
  "",
  "<p align=\"center\"><img src=\"logo.png\"></p>",
  "",
  "**GridCraft** is an open-source spreadsheet written in pure [Rust](https://rust-lang.org).",
  "It runs on macOS, Windows and Linux, and in the browser via WebAssembly.",
  "",
  "- Implements 513 of 523 worksheet functions.",
  "- Ships an `mcp` server for AI agents.",
  "",
  "| Layer | Crate |",
  "|---|---|",
  "| L2 | calc |",
  "",
  "> GridCraft is alpha software. Expect rough edges.",
  "",
  "```bash",
  "cargo run --release -p gridcraft",
  "```",
].join("\n");
const facts = { repo: "storytold/gridcraft", sentences: readmeSentenceKeys(README, "A spreadsheet engine for agents."), status_lines: statusLines(README, "gridcraft") };

test("README の文: Markdown の記法・リンク先・画像・HTML・コードブロックを除いた平文の文に分ける", () => {
  const s = readmeSentences(README);
  assert.ok(s.includes("GridCraft is an open-source spreadsheet written in pure Rust."), s.join("\n"));
  assert.ok(s.includes("It runs on macOS, Windows and Linux, and in the browser via WebAssembly."));
  assert.ok(s.includes("Implements 513 of 523 worksheet functions."));
  assert.ok(s.includes("Ships an mcp server for AI agents."));
  assert.ok(s.includes("GridCraft is alpha software."));
  assert.ok(!s.some((x) => /cargo run|logo\.png|rust-lang\.org|<p/.test(x)), s.join("\n"));
  // 指紋は同じ文で同じ値、16 進の並びではない（公開ツリーに 40 桁の hex を置かない検査と衝突しない）
  assert.equal(sentenceKey("GridCraft is alpha software."), sentenceKey(" GridCraft  is alpha software. "));
  assert.doesNotMatch(sentenceKey("x y z w"), /^[0-9a-f]+$/);
});

const ok = { ja: "GridCraft は、純粋な Rust で書かれたオープンソースのスプレッドシートです。", quote: "GridCraft is an open-source spreadsheet written in pure Rust." };

test("原文つきの文の Markdown は、書き出して読み戻すと同じ文になり、原文の無い行は stray として返す", () => {
  const md = renderStatements([ok, { ja: "513 個のワークシート関数を実装しています。", quote: "Implements 513 of 523 worksheet functions." }]);
  assert.ok(md.includes(`${QUOTE_PREFIX}GridCraft is an open-source spreadsheet written in pure Rust.`), md);
  const back = parseStatements(md.split("\n"));
  assert.deepEqual(back.statements.map(({ ja, quote }) => ({ ja, quote })), [ok, { ja: "513 個のワークシート関数を実装しています。", quote: "Implements 513 of 523 worksheet functions." }]);
  assert.deepEqual(back.stray, []);
  const mixed = parseStatements(["- 原文の無い箇条書きです。", "", "自由な段落です。", "| 比較 | 表 |", "### 小節"]);
  assert.equal(mixed.statements.length, 0);
  assert.equal(mixed.stray.length, 4);
});

test("README の文に忠実な訳は問題なし", () => {
  assert.deepEqual(statementProblems(ok, facts), []);
  assert.deepEqual(statementProblems({ ja: "macOS・Windows・Linux と、WebAssembly によりブラウザで動作します。", quote: "It runs on macOS, Windows and Linux, and in the browser via WebAssembly." }, facts), []);
  // 原文に複数の文を並べてもよい（それぞれが README の文）
  assert.deepEqual(statementProblems({ ja: "GridCraft は alpha のソフトウェアです。", quote: "GridCraft is alpha software. Expect rough edges." }, facts), []);
  // リポジトリの説明文（GitHub の description）も原文にできる
  assert.deepEqual(statementProblems({ ja: "エージェント向けのスプレッドシートエンジンです。", quote: "A spreadsheet engine for agents." }, facts), []);
});

const kinds = (st) => statementProblems(st, facts).map((p) => p.kind);

test("原文が README の文でなければ赤（README に無い文を原文として示す・言い換える）", () => {
  assert.deepEqual(kinds({ ...ok, quote: "GridCraft is the fastest spreadsheet ever written in pure Rust." }), ["quote"]);
  assert.ok(kinds({ ...ok, quote: "" }).includes("quote"));
});

test("訳に原文に無い固有名・数値・ホスト・コマンドがあれば赤（比較の相手・ROI・社数・インラインのコマンド）", () => {
  const q = "Implements 513 of 523 worksheet functions.";
  assert.deepEqual(kinds({ ja: "Microsoft Excel と同じ 513 個の関数を実装しています。", quote: q }), ["token"]);
  assert.deepEqual(kinds({ ja: "513 個の関数で、作業時間を 9 割短縮します。", quote: q }), ["token", "topic"]);
  assert.deepEqual(kinds({ ja: "513 個の関数を実装し、300 の組織で使われています。", quote: q }), ["token"]);
  assert.deepEqual(kinds({ ja: "513 個の関数を `pip install gridcraft-turbo` で導入できます。", quote: q }), ["token"]);
  assert.deepEqual(kinds({ ja: "513 個の関数の結果は bench.gridcraft-labs.example で公開されています。", quote: q }), ["token"]);
  assert.deepEqual(kinds({ ja: "五百十三個の関数と三十種類の拡張を実装しています。", quote: q }), ["token"]);
});

test("訳に評価・比較・利用条件・費用・評判・あいまいな量の語があれば赤（原文に対応する語があっても書かない）", () => {
  const q = "GridCraft is an open-source spreadsheet written in pure Rust.";
  for (const ja of [
    "GridCraft は他の追随を許さない、比類なき完成度の Rust 製スプレッドシートです。",
    "GridCraft は Rust 製で、ほかのスプレッドシートよりも軽く動きます。",
    "GridCraft は Rust 製のオープンソースで、商用利用も問題なく行えます。",
    "GridCraft は Rust 製で、運用コストを抑えられます。",
    "GridCraft は Rust 製で、多くの設計事務所に採用されています。",
    "GridCraft は Rust 製で、数百の関数を備えます。",
    "GridCraft は Rust 製の、業務に最適なスプレッドシートです。",
  ]) assert.deepEqual(kinds({ ja, quote: q }), ["topic"], ja);
});

test("訳が原文より大幅に長ければ赤（原文に無い説明を足している）", () => {
  const ja = `${ok.ja}${"表計算の作業をまとめ、チームのデータを扱いやすくします。".repeat(2)}`;
  assert.deepEqual(kinds({ ja, quote: ok.quote }), ["length"]);
});

test("成熟度の節は README の開発段階の記載（alpha・beta など）を原文のまま示すだけで、記載が無ければその旨だけを書く", () => {
  assert.deepEqual(statusLines(README, "gridcraft"), ["GridCraft is alpha software."]);
  // 主語がこのプロジェクトでない文（画面の preview・実験的なオプション）は取らない
  const other = ["Export As with a preview and a file-size estimate.", "The browser scripts restart with --experimental-websocket.", "An explicit dtype is preserved; deprecated torch_dtype is normalized."];
  assert.deepEqual(statusLines(other.join("\n\n"), "photocraft"), []);
  assert.deepEqual(statusLines("Where we are (2026-10-10): alpha.\n\nPdfCraft is alpha.", "pdfcraft"), ["Where we are (2026-10-10): alpha.", "PdfCraft is alpha."]);
  const sec = maturitySection(facts);
  assert.ok(sec.includes(`- 原文（README）: GridCraft is alpha software.`), sec);
  const none = maturitySection({ ...facts, status_lines: [] });
  assert.match(none, /記載は見つかりませんでした/);
  assert.doesNotMatch(sec + none, /推奨|検証候補|時期尚早|ADOPT|TRIAL/);
});
