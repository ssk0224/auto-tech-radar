// 生成する記事の形（leakhunt C3・C4、2026-10-22）。生成スクリプト（scripts/crawl_and_generate.mjs）のプロンプトと
// 保存前の組み立て、テスト（tests/readme_grounding.test.mjs・tests/paid_boundary.test.mjs）が同じ定義を使う。
// 既存の published_articles.mjs は掲載済み記事の判定（pubDate・origin/main の読み取り）だけを持ち、生成する記事の形は持たないため、別のファイルにした。
// - 生成モデルに書かせる節は、README から確かめられる内容だけ（概要・成熟度の目安・課題とアーキテクチャ・主な機能）。
//   競合比較・ROI や削減率・ライセンスの結論・誇張したリードは書かせない
// - リード・インストール・ライセンスは生成スクリプトがデータ（created_at・スター数・README のコードブロック・LICENSE の判定）から決まった形で作る
// - note の有料部分は見出しを使わず、各節の題を太字の行にする（note.com の目次に有料部分の見出しが表示されるため）
import { normalizeEol } from "./eol.mjs";
import { outsideFences, paidHeadingLines, paidHeadingsToBold } from "./headings.mjs";
import { STANDARD_FOOTER } from "./note_vault.mjs";
import { RECEIPT_LINE } from "./receipt.mjs";
import { INSTALL_HEADING } from "./readme_facts.mjs";
import { LICENSE_HEADING } from "./license_section.mjs";

export { paidHeadingLines, paidHeadingsToBold };

export const WEB_H2 = {
  maturity: "## 🎯 成熟度の目安（AI による見立て）",
  architecture: "## 解決する主要な課題とアーキテクチャ",
  install: INSTALL_HEADING,
  license: LICENSE_HEADING,
};
// 生成モデルが書く節（これ以外の H2 を含む生成結果は採用しない）
export const WEB_LLM_H2 = [WEB_H2.maturity, WEB_H2.architecture];
export const WEB_TEMPLATE_H2 = Object.values(WEB_H2);

export const NOTE_H2 = { intro: "## はじめに", features: "## 主な機能とアーキテクチャ概要" };
export const NOTE_FREE_TEMPLATE_H2 = Object.values(NOTE_H2);
export const NOTE_PAID_LIST_HEADING = "### 🔒 有料エリアの内容";
export const NOTE_PRICE = 980;
export const MEMBERSHIP_PRICE = 1980;
export const NOTE_PRICE_BOX = [
  "> 💡 **【価格と経費精算について】**",
  `> 本記事の価格は **${NOTE_PRICE}円** です。`,
  RECEIPT_LINE,
].join("\n");
export const NOTE_PAYWALL = [
  "--------------------------------------------------",
  `【有料ライン（推奨販売価格: ${NOTE_PRICE}円 / 月額${MEMBERSHIP_PRICE.toLocaleString("en-US")}円メンバーシップ特典）ここから先は有料会員限定】`,
  "--------------------------------------------------",
].join("\n");
// note の無料部分に出る定型文（価格など。README の事実でなくてよい値）
export const NOTE_FIXED_TEXT = [NOTE_PRICE_BOX, NOTE_PAYWALL, STANDARD_FOOTER].join("\n");

const stripFrontmatter = (md) => normalizeEol(md).replace(/^---\n[\s\S]*?\n---\n?/, "");
export const h2Headings = (md) => outsideFences(stripFrontmatter(md)).map(([l]) => l.trimEnd()).filter((l) => /^## /.test(l));
// 節の題（H2〜H6 の見出しと、太字だけの行）。H1（記事の題名）は含めない
export const sectionLabels = (md) =>
  outsideFences(stripFrontmatter(md)).map(([l]) => l.trim()).filter((l) => /^#{2,6} /.test(l) || /^\*\*[^*].*\*\*$/.test(l));
// Web 記事: 題名（H1）の直後にリードを入れ、末尾にインストールとライセンスの節を付ける
export function assembleWebArticle(md, { lede, install, license }) {
  const text = normalizeEol(md);
  const fm = text.match(/^---\n[\s\S]*?\n---\n?/)?.[0] || "";
  const lines = text.slice(fm.length).split("\n");
  const h1 = outsideFences(lines.join("\n")).find(([l]) => /^# \S/.test(l));
  if (h1) lines.splice(h1[1] + 1, 0, "", lede);
  else lines.unshift(lede, "");
  return `${fm}${lines.join("\n").trimEnd()}\n\n${install.trimEnd()}\n\n${license.trimEnd()}\n`;
}

// note の無料部分（head: 有料ラインまでの行）: 「はじめに」の節をリードに置き換え（無ければ題名の直後に入れ）、
// 有料版の内容一覧（有料部分の節の題から判定したもの）を価格の案内の直前に入れる。生成モデルが書いた一覧は捨てる
export function assembleNoteHead(head, { lede, features }) {
  let lines = normalizeEol(head).split("\n");
  const isEnd = (l) => /^#{1,3} /.test(l) || /^> 💡/.test(l) || /有料ライン|ここから先は有料/.test(l);
  const drop = (re) => {
    const i = lines.findIndex((l) => re.test(l));
    if (i === -1) return;
    const j = lines.findIndex((l, k) => k > i && isEnd(l));
    lines = [...lines.slice(0, i), ...lines.slice(j === -1 ? lines.length : j)];
  };
  drop(/^### 🔒/);
  drop(/^## はじめに/);
  const h1 = lines.findIndex((l) => /^# \S/.test(l));
  lines.splice(h1 + 1, 0, "", NOTE_H2.intro, "", lede, "");
  const list = features.length ? [NOTE_PAID_LIST_HEADING, ...features.map((f) => `- ${f}`), ""] : [];
  let at = lines.findIndex((l) => /^> 💡/.test(l) || l === RECEIPT_LINE);
  if (at === -1) at = lines.findIndex((l) => /有料ライン|ここから先は有料/.test(l));
  if (at === -1) at = lines.length;
  while (at > 0 && /^-{3,}$/.test(lines[at - 1].trim())) at--;
  lines.splice(at, 0, ...list);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
