import { isNoise } from "../../scripts/utils/noise_filter.mjs";

// 記事の一覧を読み込む共通ヘルパー。
// ノイズ記事（解説対象外のリポジトリ）を除外し、pubDate の新しい順に並べる。
// 一覧・RSS・API・各ツールページはここだけを使うこと（個別に import.meta.glob しない）。
const modules = import.meta.glob("../pages/radar/*.md", { eager: true });

export function slugOf(post) {
  return String(post.url || "").replace(/\/$/, "").split("/").pop() || "";
}

// pubDate を数値化。欠落・不正なら null（現在時刻で代用しない）
export function pubTime(post) {
  const raw = post.frontmatter?.pubDate;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? null : t;
}

export function getArticles() {
  return Object.values(modules)
    .filter((p) => !isNoise(slugOf(p)))
    .sort((a, b) => {
      const ta = pubTime(a);
      const tb = pubTime(b);
      if (ta === null && tb === null) return slugOf(a).localeCompare(slugOf(b));
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta || slugOf(a).localeCompare(slugOf(b));
    });
}

// GitHub スター数による区分（記事の評価や推奨ではない）。レーダー・記事・チートシートで共通
export const STAR_TIERS = [
  { min: 15000, label: "★15,000+", color: "#34d399", bg: "rgba(16, 185, 129, 0.18)", border: "rgba(16, 185, 129, 0.4)" },
  { min: 5000, label: "★5,000+", color: "#60a5fa", bg: "rgba(59, 130, 246, 0.18)", border: "rgba(59, 130, 246, 0.4)" },
  { min: 1000, label: "★1,000+", color: "#fbbf24", bg: "rgba(245, 158, 11, 0.18)", border: "rgba(245, 158, 11, 0.4)" },
  { min: 0, label: "★1,000未満", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.18)", border: "rgba(148, 163, 184, 0.4)" },
];
export const STAR_TIER_NOTE = "区分は記事作成時点の GitHub スター数のみで機械的に決めたもので、採用の推奨や品質の評価ではありません。";
export function starTier(stars) {
  const n = Number(stars) || 0;
  const ring = STAR_TIERS.findIndex((t) => n >= t.min);
  return { ring, ...STAR_TIERS[ring] };
}
