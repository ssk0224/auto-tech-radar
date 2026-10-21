// 新しく生成する原稿に誇張・結果保証の表現（一発起動・爆発的・収入の金額など）が入らないことを確かめる。
// 既存の公開中 note は CI の検査（claims_check.mjs）とは別に扱い、ここでは生成時の検査とプロンプトだけを見る
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { findHype, HYPE_PROMPT_RULE } from "../scripts/utils/hype_check.mjs";

const NG = [
  "コピペで本番一発起動できる設定キット",
  "Docker で一発で起動できます",
  "コピペで本番投入できる環境構築",
  "怪物級のOSS",
  "驚異的なスピードで成長",
  "発注即決を勝ち取る営業トーク",
  "世界中で爆発的に注目されている",
  "このOSSで稼げる仕組み",
  "必ず受注につながる提案書",
  "この提案で必ずコストを削減できます",
  "月収100万円も可能",
  "年収1,000万円を目指せる",
  "MRR 50万円を見込めます",
  "月商50万円を目指す",
  "月30万円を稼ぐ",
  "初年度で300万円の利益",
];
const OK = [
  "APIキーは必ず .env に保存してください",
  "必ず成功するとは限りません",
  "必ず成果が出るわけではありません",
  "合計 120万円（税別、40人日 × 3万円）",
  "価格設定: 月額980円",
  "## 💡 活用・収益化の考え方（月額980円のプランを想定）",
  "売上10%向上の事例はREADMEに記載がない",
  "提案先: 年商10億円以上の中堅企業",
  "売上高100億円規模の製造業",
  "月100万リクエストを処理",
  "急速に利用が広がっている",
];

test("誇張・結果保証の表現と収入の金額を検出する", () => {
  for (const s of NG) assert.ok(findHype(s).length > 0, s);
});

test("手順の注意書き・否定形・見積や価格設定は検出しない", () => {
  for (const s of OK) assert.deepEqual(findHype(s), [], s);
});

test("生成スクリプトのプロンプトに禁止指示があり、生成物の検査にも同じ定義を使う", () => {
  for (const term of ["一発起動", "コピペで本番", "怪物級", "驚異的", "即決", "爆発的", "稼げる", "必ず", "収入"]) {
    assert.ok(HYPE_PROMPT_RULE.includes(term), term);
  }
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  assert.match(src, /\$\{HYPE_PROMPT_RULE\}/);
  assert.match(src, /findHype\(noteText\)/);
});

test("生成スクリプトのプロンプトの雛形そのものに禁止表現が無い（雛形の文言は生成物にそのまま写る）", () => {
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  const templates = [...src.matchAll(/const (?:systemInstruction|prompt) = `([\s\S]*?)\n`;/g)].map((m) => m[1]);
  assert.equal(templates.length, 2);
  for (const t of templates) {
    // 禁止指示そのもの（${HYPE_PROMPT_RULE}）は差し込み前の文字列なので、ここには禁止語が現れない
    assert.deepEqual(findHype(t), []);
  }
});

test("既存の note 原稿の無料部分に「一発起動」が無い（有料部分は動作未検証の例を含むため）", () => {
  for (const f of fs.readdirSync("note_drafts").filter((x) => x.endsWith("_note.md"))) {
    const s = fs.readFileSync(path.join("note_drafts", f), "utf8");
    assert.doesNotMatch(s, /一発起動/, f);
  }
  for (const slug of ["aihot", "opendots"]) {
    assert.match(fs.readFileSync(`note_drafts/${slug}_note.md`, "utf8"), /公式READMEに基づく導入手順と「Docker Compose & \.env 設定例」（動作未検証の例を含む）/, slug);
  }
});
