// サイト・送客文の、有料版（note）の案内文の正本（leakhunt C4、2026-10-22）。
// 有料と無料の境界は「有料版にしか無い価値」（note_vault.mjs の PAID_FEATURE_RULES: 提案書・見積・活用の考え方・想定問答）で決める。
// 案内文で有料版の中身を言うときは、その一覧のラベルだけを使う。サイトのページ・レイアウト・llms.txt と、送客文・X の投稿文の
// 有料版に触れた文（有料・実務キット・メンバーシップ特典を含む文）は、ここに並べた文のどれかと一致しなければならない
// （tests/paid_boundary.test.mjs）。語の一覧で「導入手順を売りにする言い方」を探すのではなく、決まった文以外を書けないようにする
import { PAID_FEATURE_RULES } from "./note_vault.mjs";

export const PAID_CONTEXT_RE = /有料|実務キット|メンバーシップ特典/;
export const PAID_LABELS = PAID_FEATURE_RULES.map(([, l]) => l);
const label = (key) => PAID_FEATURE_RULES.find(([re]) => re.test(key))[1];
// 有料版の中身の言い方（ラベルから作る）
export const KIT = `${label("提案書")}と${label("見積")}`;
// 記事ごとの有料版の内容一覧（*.paid.json の features）を並べる文
export const featureListSentence = (features) => `この記事の有料版の内容: ${features.join("、")}。`;

// 有料版に触れてよい文（タグ・式で分かれた断片の単位。copyFragments が返す形）
export const OFFER_FRAGMENTS = [
  // about
  "有料版・スポンサーについて",
  `一部の記事には、運営者が note で販売している有料版（${KIT}など）の案内があります。`,
  // cheatsheet・expense・index・llms.txt
  `${KIT}は note で`,
  `各記事の${KIT}は、note の有料記事（単発980円）で提供しています。`,
  "メンバーシップ（月額1,980円）では、特典に追加された有料記事を読むことができます。",
  "⚡ note で有料記事・メンバーシップを見る",
  "法人クレジットカードまたは個人カードで、note の有料記事（単発980円）またはメンバーシップ（月額1,980円）を購入します。",
  "単発記事（980円）はその記事の有料部分を読めます。",
  "note メンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読めます（すべての記事が対象ではありません）。",
  `${KIT}は、note の有料記事でのみ提供しています。`,
  // privacy
  "6. 有料コンテンツの購入",
  "有料記事の購入・決済は note（note株式会社）で行われ、当サイトは決済情報を取得しません。",
  // Layout（記事ごとの案内。中身は *.paid.json の内容一覧を表示する）
  "有料部分の分量:",
  "note で有料版を見る",
  // 送客文（funnel_copy.mjs の zennCta）
  "📖 続きと実務キットについて",
  `🔒 有料（note）: ${KIT} → note の有料記事・メンバーシップ`,
  // X の投稿文（x_thread.mjs）
  "【note の有料版】",
];
export const isApprovedFragment = (f) => {
  if (OFFER_FRAGMENTS.includes(f)) return true;
  const m = f.match(/^この記事の有料版の内容: (.+)。$/);
  return Boolean(m) && m[1].split("、").every((x) => PAID_LABELS.includes(x));
};

const JA = /[぀-ヿ㐀-鿿]/;
// 文面の断片: HTML のタグ・{式}・${式}・コメントで区切った、日本語を含む部分。Markdown の記号は除き、「。」で文に分ける
export function copyFragments(source) {
  const out = [];
  const text = String(source).replace(/\r/g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "\n").replace(/<!--[\s\S]*?-->/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "\n");
  for (const line of text.split("\n")) {
    if (/^\s*\/\//.test(line)) continue;
    for (const seg of line.split(/<[^>]*>|[{}]|\$\{|`/)) {
      const clean = seg.replace(/\*\*|\]\([^)]*\)?|[[\]]|\$|^\s*(?:-|#{1,6})\s+/g, "").replace(/\s+/g, " ").trim();
      if (!JA.test(clean)) continue;
      for (const sentence of clean.split(/(?<=。)/)) if (sentence.trim()) out.push(sentence.trim());
    }
  }
  return out;
}
export const unapprovedPaidFragments = (source) => copyFragments(source).filter((f) => PAID_CONTEXT_RE.test(f) && !isApprovedFragment(f));
