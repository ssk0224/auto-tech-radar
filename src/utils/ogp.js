// 記事の OGP 画像（public/ogp/<slug>.png）のパス。画像がまだ無い記事（生成に失敗した日など）は、
// 存在しない URL を og:image・一覧のサムネイルに出さず、サイト共通のカード（public/og-card.png）を使う。
// ビルド時（Node）に public/ を見る。astro build はプロジェクトの直下で実行する
import fs from "node:fs";
import path from "node:path";

export const SITE_ORIGIN = "https://ssk0224.github.io";
export const DEFAULT_OGP_PATH = "/og-card.png";

export function hasArticleOgp(slug, publicDir = path.join(process.cwd(), "public")) {
  return !!slug && /^[A-Za-z0-9_.-]+$/.test(slug) && fs.existsSync(path.join(publicDir, "ogp", `${slug}.png`));
}

// base（/auto-tech-radar）からのパス
export function ogpPathFor(slug, publicDir) {
  return hasArticleOgp(slug, publicDir) ? `/ogp/${slug}.png` : DEFAULT_OGP_PATH;
}
