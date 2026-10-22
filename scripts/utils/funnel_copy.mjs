// 送客文の単一の出典。Zenn / Qiita / X / note の文面はここから作る
// （以前は同じ文面が複数のスクリプトに複製され、仕様変更のたびに一部だけ古いまま残っていた）
import { siteConfig } from "../../src/config/site.js";

export const NOTE_URL = siteConfig.noteMembershipUrl;

export function articleUrl(slug) {
  return `${siteConfig.url}/radar/${slug}/`;
}

// Zenn / Qiita 記事の末尾に付ける案内（無料の続きはサイト、有料キットは note）
export function zennCta(slug) {
  return `## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・README から転記したインストール手順・ライセンスの確認先 → [Auto Tech Radar で読む](${articleUrl(slug)})
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表 → [note の有料記事・メンバーシップ](${NOTE_URL})
`;
}

export const X_LINK_LABEL = "▼ 無料の解説はこちら👇";
