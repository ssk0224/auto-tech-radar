// [U] の一覧に、CI が公開中の note で見つけた問題を出すかどうか。
// 「差し替えた」と記録した時刻が、CI の最新の確認より後のときだけ隠す（次の確認で直っていなければ、また出す）。
// 日付だけで比べると、同じ日に「更新する」を押し忘れた記事がその日いっぱい隠れてしまう（2026-10-21 に実際に起きた）
export function hiddenAfterOwnerFix(noteUpdatedAt, checkedAt) {
  return Boolean(noteUpdatedAt && checkedAt && noteUpdatedAt > checkedAt);
}

// 公開中の note に残っている古い見出し（オーナーに「この見出しを探して直す」と伝えるためだけに使う。公開文面には出さない）
export const OLD_RING_HEADING = "🎯 ThoughtWorks成熟度リング判定";

// CI の検査結果が「古い見出しだけ」の問題なら true（見出し 1 行の修正で済む）
export function onlyOldRingHeading(status) {
  return Boolean(status.issues?.length) && status.issues.every((i) => /ThoughtWorks/.test(i)) && (status.excerpt || "").includes(OLD_RING_HEADING.replace(/^🎯\s*/, ""));
}
