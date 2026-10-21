// note の新規出品の上限（note の機械的な大量投稿への対策）。1 日 1 本、直近 7 日間（今日を含む）で 3 本まで。
// 出品の記録 publish_history.json の noteAt（出品を記録した日。ランチャーの recordPublish と同じ UTC の YYYY-MM-DD）で数える
export const NOTE_LISTING_PER_DAY = 1;
export const NOTE_LISTING_PER_WEEK = 3;
const DAY = 24 * 60 * 60 * 1000;
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);

// 出品できるなら null、できないなら理由（オーナーにそのまま見せる文）を返す
export function noteListingBlock(history, now = new Date()) {
  const today = dayOf(now.getTime());
  const weekStart = dayOf(Date.parse(`${today}T00:00:00Z`) - 6 * DAY);
  const dates = Object.values(history || {})
    .map((h) => h?.noteAt)
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today);
  const why = `note の機械的な大量投稿対策で、新規出品は1日${NOTE_LISTING_PER_DAY}本・週${NOTE_LISTING_PER_WEEK}本までにしています`;
  const todayCount = dates.filter((d) => d === today).length;
  if (todayCount >= NOTE_LISTING_PER_DAY) return `今日はすでに ${todayCount} 本出品しています。${why}（次は明日から）。`;
  const week = dates.filter((d) => d >= weekStart).sort();
  if (week.length >= NOTE_LISTING_PER_WEEK) {
    // 直近 7 日間の本数が上限を下回る最初の日（古い方から数えて、上限に届く 1 本目が 7 日間の外に出る日）
    const next = dayOf(Date.parse(`${week[week.length - NOTE_LISTING_PER_WEEK]}T00:00:00Z`) + 7 * DAY);
    return `直近7日間で ${week.length} 本出品しています。${why}（次は ${next} から）。`;
  }
  return null;
}
