# 海外急上昇OSS「OpenSandbox」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

opensandbox-group/OpenSandbox は 2025-12-17 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 15,739 です。

## 主な機能とアーキテクチャ概要

- 自分のインフラ上のサンドボックスで AI エージェントを動かします。
  - 原文（README）: Run AI agents in sandboxes on your own infrastructure.
- OpenSandbox は、AI アプリケーションに、コードの実行・コマンドの実行・ファイルの管理・ブラウザやデスクトップの操作のための隔離された環境を与えます。
  - 原文（README）: OpenSandbox gives AI applications isolated environments to execute code, run commands, manage files, and operate browsers or desktops.
- Docker を使ってローカルで始め、統一されたサンドボックスの API で Kubernetes にデプロイします。
  - 原文（README）: Start locally with Docker and deploy on Kubernetes through a unified sandbox API.
- Firecracker のサンドボックスは、メモリとディスクの状態を保ったまま一時停止と再開ができます。
  - 原文（README）: Firecracker sandboxes support pause/resume with memory and disk state preserved.
- ネットワークのアクセス制御: 受信の通信は共通の ingress ゲートウェイを通し、送信はサンドボックスごとの egress ポリシーで制御します。
  - 原文（README）: Network access control / Route inbound traffic through a unified ingress gateway and control outbound access with per-sandbox egress policies.
- Credential Vault: 本物の認証情報をサンドボックス内の処理に見せずに、エージェントから外部のサービスを呼べます。
  - 原文（README）: Credential Vault / Let agents call external services without exposing real credentials to sandbox workloads.
- Python・Java/Kotlin・TypeScript/JavaScript・C#/.NET・Go の SDK があり、ターミナルからは osb を使い、エージェントは MCP でつなげます。
  - 原文（README）: SDKs, CLI, and MCP / Integrate with Python, Java/Kotlin, TypeScript/JavaScript, C#/.NET, or Go SDKs. Use osb from the terminal or connect agents through MCP.

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
<!-- PAID_SEALED: opensandbox_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
