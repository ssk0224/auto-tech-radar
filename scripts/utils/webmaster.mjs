// Search Console / Cloudflare Web Analytics の登録（scripts/webmaster_setup.mjs）で使う、画面に依存しない部分。
// 画面の文字から値を取り出し、サイト設定（src/config/site.js）の 1 行だけを書き換える。
import { googleVerificationContent, cloudflareBeaconConfig } from "../../src/utils/site_tags.js";

// Search Console に登録するプロパティ（URL プレフィックス。github.io のドメインは所有していないためドメイン プロパティは使えない）
export const GSC_PROPERTY = "https://ssk0224.github.io/auto-tech-radar/";
export const SITEMAP_URL = `${GSC_PROPERTY}sitemap-index.xml`;
// Cloudflare Web Analytics に登録するホスト名（JS スニペット方式。DNS は変更しない）
export const CF_HOST = "ssk0224.github.io";

// 画面の文字は HTML のエスケープ（&quot;）付きのことがある
const unescape = (s) => String(s || "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

export function extractGoogleVerification(text) {
  const m = unescape(text).match(/google-site-verification["']?\s+content=["']([A-Za-z0-9_-]{20,100})["']/);
  return m ? m[1] : null;
}

export function extractCloudflareToken(text) {
  const m = unescape(text).match(/["']?token["']?\s*:\s*["']([0-9a-f]{32})["']/);
  return m ? m[1] : null;
}

// 検査（site_tags.js）は、サイトのビルドが使うものと同じ
const VALIDATORS = { googleSiteVerification: googleVerificationContent, cloudflareAnalyticsToken: cloudflareBeaconConfig };

export function setSiteConfigValue(src, key, value) {
  const validate = VALIDATORS[key];
  if (!validate) throw new Error(`書き換えられない設定です: ${key}`);
  if (!value || !validate(value)) throw new Error(`${key} の値が空です`);
  const re = new RegExp(`^([ \\t]*${key}:[ \\t]*)"[^"\\r\\n]*"`, "m");
  const all = src.match(new RegExp(re.source, "gm")) || [];
  if (all.length !== 1) throw new Error(`src/config/site.js に ${key} の行が 1 つだけありません（${all.length} 件）`);
  return src.replace(re, `$1"${value}"`);
}
