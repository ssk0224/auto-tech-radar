// note 原稿の無料部分に置く領収書の案内（定型文）と、その検査（生成スクリプト crawl_and_generate.mjs と tests/receipt_wording.test.mjs で使う）。
// 雛形の文言を検査するテストの対象（crawl_and_generate.mjs・note_vault.mjs）とは別のファイルにしている（古い断定の正規表現そのものを含むため）
import { splitPaid } from "./note_vault.mjs";

// 無料部分に置く領収書の案内（定型文。tests/receipt_wording.test.mjs が全原稿で確かめる）。
// 出品者はインボイス発行事業者に登録していないので、インボイス対応の領収書・経費精算できるとは書かない
// （note の領収書は 設定 → 購入・チップ履歴 から発行。経費精算の可否は購入者の所属先の規程による）
export const RECEIPT_LINE = "> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。";
// 無料部分に書かない古い断定（インボイス対応・即時発行・経費精算できる）
export const OLD_RECEIPT_CLAIM = /インボイス|即時発行可能|経費精算いただけます/;
const RECEIPT_LIKE_RE = /^\s*(?:>\s*)?※[^\n]*領収書/;
const isReceiptLine = (l) => l.replace(/\r$/, "") === RECEIPT_LINE;

// 生成物の無料部分にある領収書の案内の行（「※」で始まり「領収書」を含む行）を定型文にそろえる。
// 生成モデルが雛形の案内を少し言い換えても（「> 」が無い・語尾が違うなど）、正しい案内で保存する。該当する行が無ければそのまま返す
export function normalizeReceiptLine(content) {
  const parts = splitPaid(content);
  if (!parts || parts.head.some(isReceiptLine)) return content;
  const lines = content.split("\n");
  const i = lines.slice(0, parts.head.length - 1).findIndex((l) => RECEIPT_LIKE_RE.test(l));
  if (i === -1) return content;
  lines[i] = RECEIPT_LINE + (lines[i].endsWith("\r") ? "\r" : "");
  return lines.join("\n");
}

// 公開側（無料部分 + 末尾）の領収書の案内の問題。定型文が無い・インボイス対応などの古い断定がある
export function receiptProblems(content) {
  const parts = splitPaid(content);
  if (!parts) return [];
  const problems = [];
  if (!parts.head.some(isReceiptLine)) problems.push("領収書の案内（定型文）が無料部分にありません");
  if (OLD_RECEIPT_CLAIM.test([...parts.head, ...parts.tail].join("\n"))) problems.push("無料部分にインボイス対応・即時発行・経費精算できるという断定があります");
  return problems;
}
