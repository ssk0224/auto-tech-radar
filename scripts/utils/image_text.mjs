// 画像（OGP）に焼き込む文字の規則。画像は記事やページと一緒に書き換わらないので、価格・提供内容（受託・協賛・収益化）と更新頻度を焼き込まない。
// 生成側（scripts/generate_og_cards.mjs）と検査（tests/og_text.test.mjs）が同じ規則を使う（生成側が緩いと、保存した画像がゲートで落ちる）
import { findForbiddenClaims } from "./claims_check.mjs";
import { findHype } from "./hype_check.mjs";
import { CADENCE_CLAIM_RE } from "../../src/utils/cadence.js";

// 価格は通貨の記号・単位・通貨コード（JPY・USD など）のどの書き方でも拾う
const OFFER_IN_IMAGE = /[¥￥$€£]|\d\s*(?:円|万円|ドル)|\b(?:JPY|USD|EUR|GBP|yen|dollars?)\b|価格|料金|税込|税別|受託|協賛|スポンサー|\bsponsor|収益化|マネタイズ|単価|\bpric(?:e|es|ing)\b|\bplan\b/i;

export function imageTextProblems(texts) {
  const text = texts.join("\n");
  const hits = [...findForbiddenClaims(text), ...findHype(text)];
  const offer = text.match(OFFER_IN_IMAGE);
  if (offer) hits.push(`画像に価格・提供内容 ("${offer[0]}")`);
  const cadence = text.match(CADENCE_CLAIM_RE);
  if (cadence) hits.push(`画像に更新頻度 ("${cadence[0]}")`);
  return hits;
}
