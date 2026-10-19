import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { isNoise } from "./scripts/utils/noise_filter.mjs";

export default defineConfig({
  site: "https://ssk0224.github.io",
  base: "/auto-tech-radar",
  // 解説対象外（パッケージ辞書・求人リスト等）の記事はサイトマップに載せない
  integrations: [sitemap({ filter: (page) => !/\/radar\/([^/]+)\/$/.test(page) || !isNoise(page.match(/\/radar\/([^/]+)\/$/)[1]) })],
  output: "static",
});
