// 公開物に生成モデルが選んで載せてよいのは、README の文そのもの（原文）だけ（leakhunt C3、2026-10-22）。
// 訳は README と機械的に照合できない（語の一覧で評価・比較・採用実績を止めても、一覧に無い言い方が通る）ので、公開物に置かない。
// 原文が README の文であることは README の文の指紋（data/readme_facts の sentences）で確かめ、原文の行でないもの（訳・比較表・
// H3 の小節・自由な段落・インラインのコマンド）は記事の形の検査（ページ全体をデータから作り直したものとの一致）で赤にする
import test from "node:test";
import assert from "node:assert/strict";
import {
  readmeSentences, sentenceKey, readmeSentenceKeys, parseQuotes, renderQuotes,
  quoteProblems, usageLines, statusLines, maturitySection, QUOTE_LINE, QUOTE_LABEL,
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

const ok = "GridCraft is an open-source spreadsheet written in pure Rust.";

test("原文の Markdown は、書き出して読み戻すと同じ文になり、原文の行でないもの（訳・箇条書き・段落・表・小節）は stray として返す", () => {
  const md = renderQuotes([ok, "Implements 513 of 523 worksheet functions."]);
  assert.ok(md.split("\n").includes(`${QUOTE_LINE}${ok}`), md);
  const back = parseQuotes(md.split("\n"));
  assert.deepEqual(back.quotes, [ok, "Implements 513 of 523 worksheet functions."]);
  assert.deepEqual(back.stray, []);
  // 生成モデルが書く訳（日本語の文）は公開物に置かない: 原文の上に訳を書くと、その行は stray
  const translated = parseQuotes(["- GridCraft は純粋な Rust で書かれた、ジェミニより賢いスプレッドシートです。", `${QUOTE_LINE}${ok}`]);
  assert.deepEqual(translated.quotes, [ok]);
  assert.deepEqual(translated.stray, [0]);
  const mixed = parseQuotes(["- 原文の無い箇条書きです。", "", "自由な段落です。", "| 比較 | 表 |", "### 小節", `  - ${QUOTE_LABEL}${ok}`]);
  assert.equal(mixed.quotes.length, 0);
  assert.equal(mixed.stray.length, 5);
});

test("原文は README（と GitHub の説明文）の文そのものであること。複数の文を並べてもよい", () => {
  assert.deepEqual(quoteProblems(ok, facts), []);
  assert.deepEqual(quoteProblems("GridCraft is alpha software. Expect rough edges.", facts), []);
  assert.deepEqual(quoteProblems("A spreadsheet engine for agents.", facts), []);
});

test("README に無い文・言い換えた文・README の文に語を足した文は赤", () => {
  const kinds = (q) => quoteProblems(q, facts).map((p) => p.kind);
  assert.deepEqual(kinds("GridCraft is the fastest spreadsheet ever written in pure Rust."), ["quote"]);
  assert.deepEqual(kinds(`${ok} Used by hundreds of banks.`), ["quote"]);
  assert.deepEqual(kinds("ジェミニより賢いスプレッドシートです。"), ["quote"]);
  assert.deepEqual(kinds(""), ["quote"]);
});

test("README の利用条件の記載（学習用途のみ・非商用など）を原文のまま取り出す。商用サポートの案内などは取らない", () => {
  const md = ["# md3", "本项目仅供学习，请勿用于商业用途，详情见免责声明。", "", "This project is for non-commercial use only.", "", "Commercial support is available from the authors.", "", "For educational purposes only."].join("\n");
  assert.deepEqual(usageLines(md), ["本项目仅供学习,请勿用于商业用途,详情见免责声明。", "This project is for non-commercial use only.", "For educational purposes only."]);
  assert.deepEqual(usageLines("MIT licensed. Free for commercial use."), []);
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
