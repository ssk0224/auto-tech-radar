// 生成する記事の形（leakhunt C3・C4、2026-10-22）。生成スクリプト（scripts/crawl_and_generate.mjs）と、
// テスト（tests/readme_grounding.test.mjs・tests/paid_boundary.test.mjs）・既存記事の作り直し（scripts/reground_pages.mjs）が同じ定義を使う。
// - 公開物（Web 記事・note の無料部分と末尾・X）の形と検査は scripts/utils/page_shape.mjs と x_thread.mjs。生成モデルが選ぶのは
//   README の文（原文そのもの。訳は載せない。scripts/utils/anchored.mjs）だけで、それ以外はすべてデータから決まった形で作る
// - note の有料部分は見出しを使わず、各節の題を太字の行にする（note.com の目次に有料部分の見出しが表示されるため）
import { normalizeEol } from "./eol.mjs";
import { outsideFences, paidHeadingLines, paidHeadingsToBold } from "./headings.mjs";
import { STANDARD_FOOTER } from "./note_vault.mjs";
import { NOTE_PRICE_BOX, NOTE_PAYWALL } from "./page_shape.mjs";

export { paidHeadingLines, paidHeadingsToBold };
export {
  WEB_H2, WEB_TEMPLATE_H2, NOTE_H2, NOTE_FREE_TEMPLATE_H2, NOTE_PAID_LIST_HEADING, NOTE_PRICE, MEMBERSHIP_PRICE, NOTE_PRICE_BOX, NOTE_PAYWALL,
  renderWebPage, webPageProblems, renderNoteHead, noteHeadProblems, noteTailProblems, noteFooter, renderNoteDraft, parseWebPage, CORRECTION_NOTES, QUOTE_INTRO,
} from "./page_shape.mjs";

// 生成モデルの出力の「Web 記事」の節: 概要と、主な機能と構成（どちらも README の原文の行だけ）
export const LLM_OVERVIEW_H2 = "## 概要";

// note の無料部分に出る定型文（価格など。README の事実でなくてよい値）
export const NOTE_FIXED_TEXT = [NOTE_PRICE_BOX, NOTE_PAYWALL, STANDARD_FOOTER].join("\n");

const stripFrontmatter = (md) => normalizeEol(md).replace(/^---\n[\s\S]*?\n---\n?/, "");
export const h2Headings = (md) => outsideFences(stripFrontmatter(md)).map(([l]) => l.trimEnd()).filter((l) => /^## /.test(l));
// 節の題（H2〜H6 の見出しと、太字だけの行）。H1（記事の題名）は含めない
export const sectionLabels = (md) =>
  outsideFences(stripFrontmatter(md)).map(([l]) => l.trim()).filter((l) => /^#{2,6} /.test(l) || /^\*\*[^*].*\*\*$/.test(l));
