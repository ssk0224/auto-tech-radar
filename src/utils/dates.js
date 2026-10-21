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

// 公開日（jstDayStart の値）が、now を含む日本時間の直近 7 日間（今日と前の 6 日）に入るか。未来の日付は入れない
export function withinLastWeek(dayStartMs, nowMs) {
  if (dayStartMs === null || dayStartMs === undefined || !Number.isFinite(dayStartMs)) return false;
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  return dayStartMs <= nowMs && nowMs - dayStartMs < WEEK_MS;
}
