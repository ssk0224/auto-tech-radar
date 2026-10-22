// 記事の日付（frontmatter の pubDate / updatedDate）を扱う関数。import.meta.glob を使わないので node:test からも読み込める。
// 記事の日付は日本時間の暦日（生成スクリプトは JST の日付を書く）。
// YAML で引用符を付けずに 2026-10-21 と書くと Date（UTC 0 時）になるため、どちらの書き方でも同じ表示・同じ時刻にそろえる。

// YYYY-MM-DD の文字列にする。欠落・不正なら null（現在時刻や固定の日付で代用しない）
export function dateLabel(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const m = String(v ?? "").trim().match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  if (!m) return null;
  return Number.isNaN(Date.parse(`${m[1]}T00:00:00Z`)) ? null : m[1];
}

// その暦日の 0 時（日本時間）の時刻（ms）。欠落・不正なら null
export function jstDayStart(v) {
  const d = dateLabel(v);
  return d ? Date.parse(`${d}T00:00:00+09:00`) : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 公開日（jstDayStart の値）が、now を含む日本時間の直近 days 日間（今日と前の days-1 日）に入るか。未来の日付は入れない
export function withinLastDays(dayStartMs, nowMs, days) {
  if (dayStartMs === null || dayStartMs === undefined || !Number.isFinite(dayStartMs)) return false;
  return dayStartMs <= nowMs && nowMs - dayStartMs < days * DAY_MS;
}

// 直近 7 日間（週間ダイジェスト）
export function withinLastWeek(dayStartMs, nowMs) {
  return withinLastDays(dayStartMs, nowMs, 7);
}

// ---- 日付の決まり（tests/dates_policy.test.mjs） ----
// 表示・「今日」「直近 N 日」の判定は日本時間（JST）の暦日。保存用のキー（台帳のファイル名・GitHub 検索の日付）は UTC で、utcDate と名前で区別する。
// scripts・src で暦日・時差を計算するときは、ここの関数だけを使う（その場で toISOString().slice(0, 10) や 9 時間の足し算をしない）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

// 時刻（ms・Date・ISO 文字列）の日本時間の暦日。不正なら null
export function jstDate(now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : typeof now === "string" ? Date.parse(now) : Number(now);
  return Number.isFinite(ms) ? isoDay(ms + JST_OFFSET_MS) : null;
}

// 保存用の UTC の暦日（台帳のファイル名・GitHub 検索の日付など、UTC が仕様のものだけに使う）
export function utcDate(now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : typeof now === "string" ? Date.parse(now) : Number(now);
  return Number.isFinite(ms) ? isoDay(ms) : null;
}

// 暦日（YYYY-MM-DD）の n 日後（負なら前）。時差に関係しない暦の計算
export function addDays(date, n) {
  return isoDay(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS);
}

// 日本時間の今日から n 日前の暦日（n=0 は今日。「今日を含む直近 7 日」の始まりは jstDaysAgo(6)）
export function jstDaysAgo(n, now = Date.now()) {
  return addDays(jstDate(now), -n);
}

// 日本時間の時刻の表示（MM-DD HH:mm）
export function jstClock(now = Date.now()) {
  const ms = now instanceof Date ? now.getTime() : typeof now === "string" ? Date.parse(now) : Number(now);
  return new Date(ms + JST_OFFSET_MS).toISOString().slice(5, 16).replace("T", " ");
}
