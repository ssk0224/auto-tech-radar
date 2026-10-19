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
