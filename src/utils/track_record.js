// 掲載時と現在の GitHub スター数（Radar Ledger: data/derived/velocity.json）を記事ページ・API に出すための関数。
// import.meta.glob を使わないので、テスト（node:test）からもそのまま読み込める（データの読み込みは src/utils/velocity_data.js）。
// スター数の推移を示すだけで、掲載との因果関係（掲載で伸びた等）は表現しない
import { repoFullNameFromUrl, velocityFor } from "../../scripts/utils/ledger.mjs";
import { dateLabel } from "./dates.js";


// 掲載時から現在までのスター増加率（%、小数 1 桁）。比べられなければ null
export function growthPct(starsAtPublish, starsNow) {
  const a = Number(starsAtPublish);
  const b = Number(starsNow);
  if (!Number.isFinite(a) || a <= 0 || starsNow === null || starsNow === undefined || !Number.isFinite(b)) return null;
  return Math.round(((b - a) / a) * 1000) / 10;
}

// 記事の frontmatter と velocity から API 用の値を作る。velocity に記録が無ければ現在値は null
export function trackRecordFor(frontmatter, velocity) {
  const rawStars = frontmatter?.stars;
  const starsAtPublish = rawStars === undefined || rawStars === null || rawStars === "" || !Number.isFinite(Number(rawStars)) ? null : Number(rawStars);
  const v = velocityFor(velocity, repoFullNameFromUrl(frontmatter?.repoUrl));
  const starsNow = v ? v.stars_now : null;
  return {
    stars_at_publish: starsAtPublish,
    stars_now: starsNow,
    stars_now_date: v ? v.last_seen : null,
    growth_pct: v ? growthPct(starsAtPublish, starsNow) : null,
  };
}

// 記事ページに出す 1 行。velocity に記録がある記事だけ（無ければ null で何も出さない）
export function trackRecordLine(frontmatter, velocity) {
  const t = trackRecordFor(frontmatter, velocity);
  const pub = dateLabel(frontmatter?.pubDate);
  if (t.stars_now === null || t.stars_at_publish === null || !pub || !t.stars_now_date) return null;
  const fmt = (n) => Number(n).toLocaleString("ja-JP");
  return `掲載時 ★${fmt(t.stars_at_publish)}（${pub}）→ 現在 ★${fmt(t.stars_now)}（${t.stars_now_date} 時点）`;
}
