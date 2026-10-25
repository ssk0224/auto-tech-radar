// 新しく生成する原稿に誇張・結果保証の表現（一発起動・爆発的・収入の金額など）が入らないことを確かめる。
// 既存の公開中 note は CI の検査（claims_check.mjs）とは別に扱い、ここでは生成時の検査とプロンプトだけを見る
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { findHype, HYPE_PROMPT_RULE, findUnverifiablePraise } from "../scripts/utils/hype_check.mjs";
import { splitPaid } from "../scripts/utils/note_vault.mjs";
import { normalizeEol } from "../scripts/utils/eol.mjs";

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
  "エンタープライズ版は月額298,000円で稼働する構成",
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
    // 有料部分に無い内容（SaaS の構築手順）や成約・効果を約束する見出しも、雛形に書かない（生成物の見出しにそのまま写る）
    for (const ng of ["自社SaaS構築手順", "成約率を最大化", "圧倒的", "コピペで即提案", "先行者利益", "キラーフレーズ"]) assert.ok(!t.includes(ng), ng);
  }
});

test("公開している原稿（note の無料部分・Web 記事）にも、生成時に禁止した誇張・結果保証の表現が無い", () => {
  // 公開中の note に残っていた決まった言い回しは [E] の規則（note_pending.mjs の NOTE_TEXT_RULES）で直し、原稿も同じ文にそろえてある
  const files = ["note_drafts", "src/pages/radar"].flatMap((d) =>
    fs.readdirSync(d).filter((f) => /\.(md|txt)$/.test(f)).map((f) => path.join(d, f)),
  );
  // 検査が空振りしない: 掲載中の Web 記事すべてと、note の原稿の両方を読んでいる（件数は実データから導く）
  const radar = fs.readdirSync("src/pages/radar").filter((f) => f.endsWith(".md"));
  assert.ok(radar.length > 0 && radar.every((f) => files.includes(path.join("src/pages/radar", f))));
  assert.ok(files.some((f) => f.startsWith("note_drafts")));
  for (const f of files) assert.deepEqual(findHype(fs.readFileSync(f, "utf8")), [], f);
  // 無料部分の有料版の案内は、有料部分の節の題から判定した一覧（*.paid.json の features）だけ。
  // 生成モデルが書いた宣伝の箇条書き（「Docker Compose & .env 設定キット」「実稼働」など）は残さない（leakhunt C4、2026-10-22）
  for (const f of fs.readdirSync("note_drafts").filter((x) => x.endsWith("_note.paid.json"))) {
    const { features } = JSON.parse(fs.readFileSync(path.join("note_drafts", f), "utf8"));
    const head = splitPaid(normalizeEol(fs.readFileSync(path.join("note_drafts", f.replace(".paid.json", ".md")), "utf8"))).head.join("\n");
    const listed = head.split("### 🔒 有料エリアの内容\n")[1]?.split("\n\n")[0].split("\n").map((l) => l.replace(/^- /, "")) ?? [];
    assert.deepEqual(listed, features, f);
    assert.doesNotMatch(head, /実稼働|設定キット|導入手順/, f);
  }
});

// ---- 確かめられない評価の語（leakhunt C3、2026-10-22）: 生成時に加えて、掲載中のすべての Web 記事と note の無料部分に使う ----
test("確かめられない最上級・絶対の評価と根拠の無い評判を見つけ、手順の説明や否定・コードの中は見つけない", () => {
  for (const s of ["革新的なアーキテクチャ", "推論を極限まで最適化", "DeepSeekモデルに特化した最高峰のパフォーマンス", "不要なアプリを完全に除去", "ゼロクラッシュの堅牢性", "ハルシネーション0%", "シリコンバレーのエンジニアを熱狂させている", "世界中のエンジニアから注目を集めています", "超高速な配信性能", "劇的に効率化"]) {
    assert.ok(findUnverifiablePraise(s).length > 0, s);
  }
  for (const s of ["完全には対応していません", "高速に動作します（README によると p50 32.8ms）", "最適化されたカーネル", "```bash\n# 革新的\n```", "最新の手順は README を確認してください"]) {
    assert.deepEqual(findUnverifiablePraise(s), [], s);
  }
});

test("掲載中のすべての Web 記事と note の無料部分に、確かめられない評価の語が無い", () => {
  const bad = [];
  for (const f of fs.readdirSync("src/pages/radar").filter((x) => x.endsWith(".md"))) {
    const hits = findUnverifiablePraise(fs.readFileSync(path.join("src/pages/radar", f), "utf8"));
    if (hits.length) bad.push(`${f}: ${hits.join(", ")}`);
  }
  for (const f of fs.readdirSync("note_drafts").filter((x) => x.endsWith("_note.md"))) {
    const head = splitPaid(normalizeEol(fs.readFileSync(path.join("note_drafts", f), "utf8"))).head.join("\n");
    const hits = findUnverifiablePraise(head);
    if (hits.length) bad.push(`${f}: ${hits.join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

test("生成スクリプトは確かめられない評価の語をプロンプトで禁止し、公開する部分を同じ規則で検査する", () => {
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  assert.match(src, /\$\{UNVERIFIABLE_PRAISE_PROMPT_RULE\}/);
  assert.match(src, /findUnverifiablePraise\(/);
});
