import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://ssk0224.github.io",
  base: "/auto-tech-radar",
  integrations: [sitemap()],
  output: "static",
});
