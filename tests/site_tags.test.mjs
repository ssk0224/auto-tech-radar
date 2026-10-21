// 検索エンジンの所有確認タグと、アクセス解析（Cloudflare Web Analytics）のタグを確かめる。
// - 値が空なら何も出さない（登録前のビルドを壊さない）
// - 形式の違う値（タグ全体を貼ってしまった等）はビルドで止める
// - 解析タグを出すなら、プライバシーポリシーの外部送信一覧にも必ず載る（同じ設定値で切り替える）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { googleVerificationContent, cloudflareBeaconConfig } from "../src/utils/site_tags.js";
import { siteConfig } from "../src/config/site.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("空の値ならタグを出さない", () => {
  assert.equal(googleVerificationContent(""), null);
  assert.equal(googleVerificationContent(undefined), null);
  assert.equal(cloudflareBeaconConfig(""), null);
  assert.equal(cloudflareBeaconConfig(undefined), null);
});

test("Search Console の確認コードは content の値だけを受け付ける", () => {
  assert.equal(googleVerificationContent(" abcDEF_123-xyzABCdef456ghiJKL789mno "), "abcDEF_123-xyzABCdef456ghiJKL789mno");
  assert.throws(() => googleVerificationContent('<meta name="google-site-verification" content="abc" />'));
  assert.throws(() => googleVerificationContent("short"));
});

test("Cloudflare のトークンは 32 桁の16進数だけを受け付け、beacon の設定 JSON を返す", () => {
  const token = "0123456789abcdef0123456789abcdef";
  assert.equal(cloudflareBeaconConfig(token), JSON.stringify({ token }));
  assert.throws(() => cloudflareBeaconConfig(`<script data-cf-beacon='{"token": "${token}"}'></script>`));
  assert.throws(() => cloudflareBeaconConfig("not-a-token"));
});

test("設定ファイルの現在の値が形式どおり（ビルド前に止める）", () => {
  assert.doesNotThrow(() => googleVerificationContent(siteConfig.googleSiteVerification));
  assert.doesNotThrow(() => cloudflareBeaconConfig(siteConfig.cloudflareAnalyticsToken));
});

test("レイアウトとプライバシーポリシーが同じ設定値でタグと記載を切り替える", () => {
  const layout = read("src/layouts/Layout.astro");
  assert.match(layout, /googleVerificationContent\(siteConfig\.googleSiteVerification\)/);
  assert.match(layout, /cloudflareBeaconConfig\(siteConfig\.cloudflareAnalyticsToken\)/);
  assert.match(layout, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
  const privacy = read("src/pages/privacy.astro");
  assert.match(privacy, /cloudflareBeaconConfig\(siteConfig\.cloudflareAnalyticsToken\)/);
  assert.match(privacy, /Cloudflare/);
});
