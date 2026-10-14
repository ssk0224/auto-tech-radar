// Auto Tech Radar - 集中管理サイト設定
// Stripe支払いリンクや公式SNSリンクを一元管理します。

export const siteConfig = {
  name: "Auto Tech Radar",
  tagline: "世界最速のAIエージェント・急上昇OSS解体新書",
  url: "https://ssk0224.github.io/auto-tech-radar",
  
  // 💳 Stripe 支払いリンク (Payment Link)
  // 本番URLが未開通の場合は、決済フォールバックとして確実に購入できるnote決済へ自動誘導
  stripePaymentUrl: "https://buy.stripe.com/aFaeVd8GV1CYgQG0NY00000",
  
  // 📗 note メンバーシップ URL (月額1,980円 / 単発有料記事980円)
  noteMembershipUrl: "https://note.com/vast_ixora7005",

  // 100%確実に決済完了できるアクティブな単発決済URL (Stripe未開通時はnoteへ安全自動フォールバック)
  get activeSinglePaymentUrl() {
    const isLive = this.stripePaymentUrl && !this.stripePaymentUrl.includes('00000');
    return isLive ? this.stripePaymentUrl : this.noteMembershipUrl;
  },

  get isStripeLive() {
    return !!(this.stripePaymentUrl && !this.stripePaymentUrl.includes('00000'));
  },
  
  // 📱 公式 𝕏 (Twitter) アカウント
  xAccountUrl: "https://x.com/AutoTechRadar",
  xHandle: "@AutoTechRadar",
  
  // 💻 公式 GitHub リポジトリ
  githubUrl: "https://github.com/ssk0224/auto-tech-radar",
  
  // 🏢 協賛・受託開発案内
  b2bStartingPrice: "¥100,000〜",
  singleArticlePrice: "¥980",
  membershipMonthlyPrice: "¥1,980"
};
