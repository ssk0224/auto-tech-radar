import { jstDate, addDays } from "../../src/utils/dates.js";
// note の新規出品の上限（note の機械的な大量投稿への対策）。1 日 1 本、直近 7 日間（今日を含む）で 3 本まで。
// 出品の記録 publish_history.json の noteAt（出品を記録した日。ランチャーの recordPublish が日本時間の YYYY-MM-DD で記録する）で数える。
// 日の区切りはオーナーのいる日本時間（UTC だと朝 9 時に日付が変わり、8 時台と 9 時台に 1 本ずつ出せてしまう）
export const NOTE_LISTING_PER_DAY = 1;
export const NOTE_LISTING_PER_WEEK = 3;
// 時刻 ms（既定は今）の日本時間の日付（YYYY-MM-DD）
export const jstDay = (ms = Date.now()) => jstDate(ms);

// 出品できるなら null、できないなら理由（オーナーにそのまま見せる文）を返す
export function noteListingBlock(history, now = new Date()) {
  const today = jstDay(now.getTime());
  const weekStart = addDays(today, -6);
  const dates = Object.values(history || {})
    .map((h) => h?.noteAt)
    .filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= today);
  const why = `note の機械的な大量投稿対策で、新規出品は1日${NOTE_LISTING_PER_DAY}本・週${NOTE_LISTING_PER_WEEK}本までにしています`;
  const todayCount = dates.filter((d) => d === today).length;
  if (todayCount >= NOTE_LISTING_PER_DAY) return `今日はすでに ${todayCount} 本出品しています。${why}（次は明日から）。`;
  const week = dates.filter((d) => d >= weekStart).sort();
  if (week.length >= NOTE_LISTING_PER_WEEK) {
    // 直近 7 日間の本数が上限を下回る最初の日（古い方から数えて、上限に届く 1 本目が 7 日間の外に出る日。日本時間の日付）
    const next = addDays(week[week.length - NOTE_LISTING_PER_WEEK], 7);
    return `直近7日間で ${week.length} 本出品しています。${why}（次は ${next} から）。`;
  }
  return null;
}
