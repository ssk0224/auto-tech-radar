# 海外急上昇OSS「OpenDots」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

CopilotKit/OpenDots は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-19 時点のスター数は 5,570 です。

## 主な機能とアーキテクチャ概要

- それぞれが自分のコンピューターを持つ、常駐型 AI エージェントのためのオープンソースのテンプレートです。
  - 原文（README）: An open-source template for persistent AI agents, each with its own computer.
- CopilotKit と AG-UI で作られています。
  - 原文（README）: Built with CopilotKit and AG-UI.
- ホスティングされた製品ではなくテンプレートで、アプリケーションの実行とインフラの設定は利用者が行います。
  - 原文（README）: A template, not a hosted product. You run the application and configure its infrastructure.
- 各 Dot は、OpenBot のコンテナ管理とコンピューターサービスを使って、自分のコンピューターを持てます。
  - 原文（README）: Each Dot can have its own computer, using OpenBot's container supervisor and computer service.
- アプリケーションはサービスの認証情報をサーバーに置き、Dot ごとに別のコンピューター用の認証情報を作ります。
  - 原文（README）: The application keeps service credentials on the server and derives a different computer credential for each Dot.
- Dot には、メール・カレンダー・GitHub・自前のサービスなど任意の MCP サーバーのツールを持たせられ、読み取り専用のツールはそのまま動きます。
  - 原文（README）: Give a Dot tools from any MCP server, such as email, calendar, GitHub, or your own services. Read-only tools run on their own.
- それ以外のツールはチャットの Approve & run カードで止まり、承認したときだけ実行されます。
  - 原文（README）: Any other tool pauses for an Approve & run card in chat, and only your approval runs it.
- ページはローカルのワークスペースのデータベースに保存されます。
  - 原文（README）: Pages stay in the local workspace database.

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
<!-- PAID_SEALED: opendots_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
