# 海外急上昇OSS「DiPlay」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

shihabal3amri/DiPlay は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 10,296 です。

## 主な機能とアーキテクチャ概要

- 対応する BYD の Android ヘッドユニットで CarPlay を使うためのアプリです。有線と無線に対応し、DiAuto のインターフェースを使います。
  - 原文（README）: CarPlay for compatible BYD Android head units. Wired and wireless, with the familiar DiAuto interface.
- 対象は BYD の車です。他のブランドでも動く可能性はありますが、対応しておらず、ブランド固有の非互換を直す予定もありません。
  - 原文（README）: BYD support scope: These projects focus on BYD cars. They may work on other brands, but other brands are unsupported and there are no plans to add support or fix brand-specific incompatibilities.
- iPhone ではなく車にインストールします。脱獄・ドングル・Mac・アカウント・認証サーバーは不要です。
  - 原文（README）: Install on the car, not the iPhone. No jailbreak, dongle, Mac, account or authentication server is required for use.
- CarPlay の中核機能に ADB は不要ですが、ダッシュボード・バッテリー・車輪速・駐車中の動画の機能には必要です。
  - 原文（README）: Core CarPlay does not require ADB; optional dashboard, battery, wheel-speed and parked-video features do.
- APK は Android 7.0 以降（API 24）に対応しますが、Android 7.0〜8.1 での対応は実車でまだ確認されていません。
  - 原文（README）: The APK supports Android 7.0+ (API 24); Android 7.0–8.1 support is not yet confirmed on a vehicle.
- 無線接続は Wi-Fi Direct、車の既存のホットスポット、既存の Wi-Fi（同じ LAN）に対応します。
  - 原文（README）: Wireless supports Wi-Fi Direct, the car’s existing hotspot or Existing Wi-Fi / Same LAN.
- Apple の認証を受けた製品ではありません。
  - 原文（README）: This is not an Apple-certified product.
- APK には、公開されている Carlinkit のファームウェアから取り出した実験的なアクセサリーの識別情報が同梱されており、DiPlay 用に新しく発行された MFi の識別情報ではありません。同梱の秘密鍵は取り出せます。
  - 原文（README）: The APK bundles an experimental accessory identity recovered from public Carlinkit firmware, not a newly provisioned MFi identity for DiPlay. A bundled private key is extractable.
- ほかのヘッドユニットや iOS での互換性は保証されていません。
  - 原文（README）: Broader head-unit and iOS compatibility is not guaranteed.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: diplay_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub #Android #CarPlay
