// 検索エンジンの所有確認タグと、アクセス解析（Cloudflare Web Analytics）のタグの値を検査する。
// 値は src/config/site.js に置く。空なら null（タグを出さない）。形式が違えばビルドを止める
// （タグ全体を貼ってしまうと HTML が壊れる・解析が無言で動かないため）。

// Search Console の「HTML タグ」の content 属性の値
const GOOGLE_VERIFICATION = /^[A-Za-z0-9_-]{20,100}$/;
// Cloudflare Web Analytics の data-cf-beacon の token
const CLOUDFLARE_TOKEN = /^[0-9a-f]{32}$/;

export function googleVerificationContent(value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (!GOOGLE_VERIFICATION.test(v)) {
    throw new Error("siteConfig.googleSiteVerification には meta タグの content の値だけを入れてください");
  }
  return v;
}

export function cloudflareBeaconConfig(value) {
  const v = (value || "").trim();
  if (!v) return null;
  if (!CLOUDFLARE_TOKEN.test(v)) {
    throw new Error("siteConfig.cloudflareAnalyticsToken には data-cf-beacon の token（32 桁の16進数）だけを入れてください");
  }
  return JSON.stringify({ token: v });
}
