// Search Console / Cloudflare Web Analytics の登録の自動化（scripts/webmaster_setup.mjs）のうち、
// 画面の文字から値を取り出す部分と、サイト設定（src/config/site.js）を書き換える部分を確かめる。
import test from "node:test";
import assert from "node:assert/strict";
import { extractGoogleVerification, extractCloudflareToken, setSiteConfigValue, GSC_PROPERTY } from "../scripts/utils/webmaster.mjs";

const G = "AbCdEf0123456789_-xyzXYZabcdefghijk";
const CF = "0123456789abcdef0123456789abcdef";

test("Search Console の画面の文字（エスケープの有無・引用符の種類によらず）から確認コードを取り出す", () => {
  assert.equal(extractGoogleVerification(`<meta name="google-site-verification" content="${G}" />`), G);
  assert.equal(extractGoogleVerification(`&lt;meta name=&quot;google-site-verification&quot; content=&quot;${G}&quot; /&gt;`), G);
  assert.equal(extractGoogleVerification(`<meta name='google-site-verification' content='${G}'>`), G);
  assert.equal(extractGoogleVerification("所有権の確認 おすすめの確認方法 HTML ファイル"), null);
});

test("Cloudflare の画面の文字から beacon の token を取り出す（JSON の書き方・エスケープによらず）", () => {
  assert.equal(extractCloudflareToken(`<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "${CF}"}'></script>`), CF);
  assert.equal(extractCloudflareToken(`data-cf-beacon='{&quot;token&quot;: &quot;${CF}&quot;}'`), CF);
  assert.equal(extractCloudflareToken("Web Analytics サイトを追加"), null);
  // 32 桁でない・16進数でないものは取らない
  assert.equal(extractCloudflareToken(`{"token": "${CF}00"}`), null);
});

const SITE = `export const siteConfig = {
  name: "Auto Tech Radar",
  googleSiteVerification: "",
  cloudflareAnalyticsToken: "",
  githubUrl: "https://github.com/ssk0224/auto-tech-radar",
};
`;

test("設定ファイルの該当の 1 行だけを書き換え、ほかは変えない", () => {
  const out = setSiteConfigValue(SITE, "googleSiteVerification", G);
  assert.equal(out, SITE.replace('googleSiteVerification: ""', `googleSiteVerification: "${G}"`));
  const out2 = setSiteConfigValue(out, "cloudflareAnalyticsToken", CF);
  assert.match(out2, new RegExp(`cloudflareAnalyticsToken: "${CF}"`));
  assert.match(out2, new RegExp(`googleSiteVerification: "${G}"`));
});

test("設定ファイルの書き換えは CRLF の改行を保つ（Windows のチェックアウト）", () => {
  const crlf = SITE.replace(/\n/g, "\r\n");
  const out = setSiteConfigValue(crlf, "googleSiteVerification", G);
  assert.equal(out, crlf.replace('googleSiteVerification: ""', `googleSiteVerification: "${G}"`));
});

test("形式の違う値・見つからないキーは書き換えずに止める", () => {
  assert.throws(() => setSiteConfigValue(SITE, "googleSiteVerification", "<meta"));
  assert.throws(() => setSiteConfigValue(SITE, "cloudflareAnalyticsToken", "xyz"));
  assert.throws(() => setSiteConfigValue(SITE, "noSuchKey", G));
  assert.throws(() => setSiteConfigValue(SITE.replace("  googleSiteVerification", "  // googleSiteVerification"), "googleSiteVerification", G));
});

test("登録するプロパティはサイトの公開 URL（末尾スラッシュ付きの URL プレフィックス）", () => {
  assert.equal(GSC_PROPERTY, "https://ssk0224.github.io/auto-tech-radar/");
});
