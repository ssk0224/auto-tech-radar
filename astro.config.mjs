import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://auto-tech-radar.pages.dev",
  integrations: [sitemap()],
  output: "static",
});
