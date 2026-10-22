# 海外急上昇OSS「cleanyourtv」商用化マニュアル｜社内DX提案書・工数見積 ＆ 自社SaaS構築手順付き

## はじめに

Gathin23/cleanyourtv は 2026-10-17 に GitHub で作成されたリポジトリです。2026-10-21 時点のスター数は 11,608 です。

## 主な機能とアーキテクチャ概要

- Android TV には、Android のスマートフォンと同じデバッグブリッジがあります。
  - 原文（README）: Android TVs have the same debug bridge as Android phones.
- root もケーブルも不要で、何もアンインストールせず、気が変わったら 1 行で元に戻せます。
  - 原文（README）: No root, no cable, nothing uninstalled, and a one-line restore if you change your mind.
- TV と同じ Wi-Fi につながったコンピューターと、シェルを使えるコーディングアシスタントが必要です。
  - 原文（README）: You need a computer on the same Wi-Fi as the TV and a coding assistant with shell access.
- 無効化: メーカーのテレメトリ、広告サービス、コンテンツの列、プリインストールの不要なアプリを pm disable-user で無効にします。
  - 原文（README）: Disable / The manufacturer's telemetry, ad services, content rows and preloaded junk, with pm disable-user.
- 何もアンインストールしないので、復元スクリプトですべての手順を元に戻せます。
  - 原文（README）: Nothing is uninstalled, so a restore script can undo every step.
- インストール: 小さなネイティブのランチャーを入れ、既定のホーム画面にします。
  - 原文（README）: Install / A small native launcher, made the default home screen.
- 不要なアプリはブランドごとに違うため、プロンプトはコーディングアシスタントに TV 上で探させ、使うかもしれないものに触れる前に確認させます。
  - 原文（README）: The bloat differs by brand, so the prompt has your coding assistant discover it on your TV and ask before touching anything you might use.
- Android TV または Google TV で動く機器が対象です。
  - 原文（README）: Anything running Android TV or Google TV.
- Fire TV: Fire OS はホームを他社製のランチャーに渡さないため、不要アプリの無効化だけが使えます。
  - 原文（README）: Fire TV / The debloat half only, since Fire OS will not hand Home to a third-party launcher.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方
- 導入時の想定問答

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: cleanyourtv_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub