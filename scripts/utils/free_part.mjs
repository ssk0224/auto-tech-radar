// note の無料部分の正本は、リポジトリの原稿（note_drafts/）。公開中の無料部分は「原稿の無料部分を note 用に描画したもの」と同じでなければならない。
// 規則で一部の語だけ直す方式（from → to）は、規則に無い書き方・規則を足し忘れた語が残り続ける（2026-10-22: 37 本中 27 本が原稿と違った）。
// ここでは「原稿を描画したもの」と「公開中のもの」を文字単位で比べる（書式・空白・記号の違いは無視）。
import path from "path";
import { parseDraftToNotePayload } from "./note_html.mjs";
import { noteHtmlText } from "./note_pending.mjs";
import { bad, ok, unknown } from "./verdict.mjs";

// 無料のリードマグネットだけはファイル名が違う（_note.md でない）
export const FREE_NOTE_SLUGS = new Set(["LEAD_MAGNET_CHEAT_SHEET"]);
export const draftFileFor = (slug, dir) => path.join(dir, FREE_NOTE_SLUGS.has(slug) ? `${slug}.md` : `${slug}_note.md`);
export const isPaidSlug = (slug) => !FREE_NOTE_SLUGS.has(slug);

// 比較用: HTML の書式・実体参照を外し、全角半角をそろえ、空白・句読点・記号を除く
// 公開中の無料部分が原稿よりこの字数以上長ければ、文言が違っても「有料部分が見えている恐れ」とする
export const PAST_MARGIN_CHARS = 200;
export const plainText =(html) => noteHtmlText(html).normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");

// 原稿の無料部分を note 用の HTML にする（出品と同じ変換 parseDraftToNotePayload）。有料原稿で有料ラインが無ければ null
export function renderDraftFree(draftContent, { isPaid = true } = {}) {
  const s = String(draftContent || "");
  if (!s.trim()) return null;
  if (isPaid && !/【有料ライン[^\n]*】/.test(s)) return null;
  return parseDraftToNotePayload(s, isPaid).freeBody;
}

// 公開中の無料部分 liveHtml（ログインなしで読める本文）が、原稿の無料部分と同じか。
// ok: 同じ / bad: 違う（kind: past = 原稿の無料部分より先まで見える＝有料部分が無料で読める恐れ、short = 手前で終わる、text = 文言が違う）
// unknown: 比べられない（原稿が無い・有料ラインが無い・本文が取れない）
export function freePartVerdict(liveHtml, draftContent, { isPaid = true } = {}) {
  const rendered = renderDraftFree(draftContent, { isPaid });
  if (rendered === null) return unknown(draftContent ? "原稿に有料ラインが無いため比べられない" : "原稿が無いため比べられない");
  if (typeof liveHtml !== "string" || !liveHtml.trim()) return unknown("公開中の本文を取得できない");
  const want = plainText(rendered);
  const got = plainText(liveHtml);
  const sizes = { liveChars: got.length, draftChars: want.length };
  if (!want) return unknown("原稿の無料部分が空のため比べられない", sizes);
  if (want === got) return ok(sizes);
  let i = 0;
  while (i < want.length && want[i] === got[i]) i++;
  if (got.startsWith(want)) return bad("原稿の無料部分より先まで無料で見える（有料部分が無料で読める恐れ）", { kind: "past", firstDiff: i, ...sizes });
  // 文言も違い、しかも原稿の無料部分より大きく長い: 有料部分まで見えている恐れとして扱う（末尾の一致だけで判定すると見逃す）
  if (got.length > want.length + PAST_MARGIN_CHARS) return bad("原稿の無料部分より大きく長く無料で見える（有料部分が無料で読める恐れ）", { kind: "past", firstDiff: i, ...sizes });
  if (want.startsWith(got)) return bad("原稿の無料部分より手前で終わっている（有料ラインが原稿より上）", { kind: "short", firstDiff: i, ...sizes });
  return bad("文言が原稿と違う", { kind: "text", firstDiff: i, ...sizes });
}
