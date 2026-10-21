// [U] の一覧に、CI が公開中の note で見つけた問題を出すかどうか。
// 「差し替えた」と記録した時刻が、CI の最新の確認より後のときだけ隠す（次の確認で直っていなければ、また出す）。
// 日付だけで比べると、同じ日に「更新する」を押し忘れた記事がその日いっぱい隠れてしまう（2026-10-21 に実際に起きた）
export function hiddenAfterOwnerFix(noteUpdatedAt, checkedAt) {
  return Boolean(noteUpdatedAt && checkedAt && noteUpdatedAt > checkedAt);
}

// 公開中の note に残っている古い表現（オーナーに「この語を探して直す」と伝えるためだけに使う。公開文面には出さない）
export const OLD_RING_WORDS = "ThoughtWorks成熟度リング";
// 置き換え後の語。🎯 などの前後の文字は含めない（見出しの 🎯 ごと貼ると 🎯 が二重になった、2026-10-21）
export const NEW_RING_WORDS = "成熟度の目安（AI による見立て）";

// CI の検査結果が「古い表現だけ」の問題なら、その箇所（前後の文）を返す。語の置き換えだけで済む。それ以外は null
export function oldRingWordingSpot(status) {
  if (!status.issues?.length || !status.issues.every((i) => /ThoughtWorks/.test(i))) return null;
  const excerpt = (status.excerpt || "").replace(/^[^>]*">/, "").trim();
  return excerpt.includes(OLD_RING_WORDS) ? excerpt : null;
}
