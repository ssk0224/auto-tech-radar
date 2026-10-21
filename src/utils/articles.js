import { isNoise } from "../../scripts/utils/noise_filter.mjs";
import { dateLabel, jstDayStart } from "./dates.js";

// 記事の一覧を読み込む共通ヘルパー。
// ノイズ記事（解説対象外のリポジトリ）を除外し、pubDate の新しい順に並べる。
// 一覧・RSS・API・各ツールページはここだけを使うこと（個別に import.meta.glob しない）。
const modules = import.meta.glob("../pages/radar/*.md", { eager: true });

export function slugOf(post) {
  return String(post.url || "").replace(/\/$/, "").split("/").pop() || "";
}

// 記事ページへのリンク（base 込み・末尾スラッシュ付き）。post.url は末尾スラッシュが無く、
// GitHub Pages ではリダイレクトを 1 回はさみ canonical（…/radar/<slug>/）とも食い違うため、リンクには必ずこれを使う
export function hrefOf(post) {
  return String(post.url || "").replace(/\/?$/, "/");
}

// pubDate を数値化（日本時間のその日の 0 時）。欠落・不正なら null（現在時刻で代用しない）
export function pubTime(post) {
  return jstDayStart(post.frontmatter?.pubDate);
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
// 画面での呼び名（「リング」「判定」とは呼ばない。レーダー図の同心円もこの区分を表す）
export const STAR_TIER_NAME = "スター数区分";
export const STAR_TIER_NOTE = "スター数区分は推奨ではありません。記事作成時点の GitHub スター数だけで機械的に分けたもので、採用の推奨や品質の評価ではありません。";
export function starTier(stars) {
  const n = Number(stars) || 0;
  const ring = STAR_TIERS.findIndex((t) => n >= t.min);
  return { ring, ...STAR_TIERS[ring] };
}

// 訂正履歴（記事の frontmatter の corrections: [{ date, note }]）。ノイズ記事も公開しているので含める。新しい訂正から順に並べる
export function getCorrections() {
  const rows = [];
  for (const post of Object.values(modules)) {
    const list = post.frontmatter?.corrections;
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c?.date || !c?.note) continue;
      rows.push({ date: dateLabel(c.date) || String(c.date), note: String(c.note), url: hrefOf(post), slug: slugOf(post), title: post.frontmatter?.title || slugOf(post) });
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}
