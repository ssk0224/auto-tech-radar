import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { isNoise } from "./scripts/utils/noise_filter.mjs";

// テストの中でリポ本体を astro build すると、並列のテストが .astro/ などの作業ファイルを壊し合う。テストは tests/helpers/site_build.mjs（ビルドごとの別コピー）で
// ビルドする。どの書き方（npx・bin・npm run build・プロセス内）でもここで止まる。ATR_TEST_RUN は tests/helpers/test_env.mjs が全テストプロセスに立てる
if (process.env.ATR_TEST_RUN === "1" && process.env.ATR_SITE_BUILD_COPY !== "1") {
  throw new Error("テストの中でリポ本体の astro を実行した。tests/helpers/site_build.mjs の prepareBuildRoot / astroBuild（ビルドごとの別コピー）を使う");
}

export default defineConfig({
  site: "https://ssk0224.github.io",
  base: "/auto-tech-radar",
  // 解説対象外（パッケージ辞書・求人リスト等）の記事はサイトマップに載せない
  integrations: [sitemap({ filter: (page) => !/\/radar\/([^/]+)\/$/.test(page) || !isNoise(page.match(/\/radar\/([^/]+)\/$/)[1]) })],
  output: "static",
});
