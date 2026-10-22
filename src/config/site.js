// Auto Tech Radar - 集中管理サイト設定
// 購入導線（note）や公式SNSリンクを一元管理します。

export const siteConfig = {
  name: "Auto Tech Radar",
  tagline: "急上昇OSSの日本語解説",
  url: "https://ssk0224.github.io/auto-tech-radar",
  
  // 有料記事の販売は note のみ（購入者だけが読める note の有料エリアで提供する）。
  // サイト側には購入後に有料本文を届ける仕組みが無いため、サイト独自の決済サービスは使わない。
  noteProfileUrl: "https://note.com/vast_ixora7005",
  noteMembershipUrl: "https://note.com/vast_ixora7005/membership",

  // 📱 公式 𝕏 (Twitter) アカウント
  xAccountUrl: "https://x.com/AutoTechRadar",
  xHandle: "@AutoTechRadar",
  
  // 検索エンジンの所有確認（Search Console の「HTML タグ」の content の値）と、
  // アクセス解析（Cloudflare Web Analytics の token）。空ならタグを出さない（src/utils/site_tags.js）。
  // 解析を入れると src/pages/privacy.astro の外部送信一覧にも自動で載る。
  googleSiteVerification: "Voz6J6GTC47_IhzS51uDQFdMynW6EwHGvtxwdGavHF8",
  cloudflareAnalyticsToken: "6ed43d34957a49fcb90ec8e43f7db523",

  // 💻 公式 GitHub リポジトリ
  githubUrl: "https://github.com/ssk0224/auto-tech-radar",
  
  // 🏢 協賛・受託開発案内のフォームの送信先。メールアドレスは公開ページに出さない（HTML のソースからも読めないように）。
  // FormSubmit がメールアドレスの確認後に発行するランダムな文字列（https://formsubmit.co/<この文字列>）を入れる。
  // 空の間はフォームを出さず、X の DM と GitHub Issues を案内する（tests/contact.test.mjs）
  contactFormAlias: "",
  // スポンサー枠は価格を出さない（読者数などの実績データを公開していないため。2026-10-21）
  b2bStartingPrice: "スポンサー枠は読者数を公開した後に募集します",
  singleArticlePrice: "¥980",
  membershipMonthlyPrice: "¥1,980"
};
