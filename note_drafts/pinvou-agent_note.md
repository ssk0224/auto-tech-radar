# 海外急上昇OSS「pinvou-agent」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

Pinvou/pinvou-agent は 2026-07-24 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 2,399 です。

## 主な機能とアーキテクチャ概要

- 仕事・デザイン・コーディングのための、オープンソースのデスクトップ AI エージェントのワークスペースです。
  - 原文（README）: An open-source desktop AI agent workspace for work, design, and coding.
- ローカルのモデルを使えば外部に出さずに完結でき、OpenAI 互換のエンドポイントにも接続でき、MCP サーバー・CLI コネクター・Skills・ワークフローでエージェントを拡張できます。
  - 原文（README）: Use a local model for a fully private loop, connect any OpenAI-compatible endpoint, and extend the agent with MCP servers, CLI connectors, Skills, and workflows.
- データが手元の機器から出るかどうかは、有効にしたモデルとツールによります。ローカルのモデルとローカルのツールだけなら、すべてローカルで完結します。
  - 原文（README）: Whether data leaves your machine depends on the model and tools you enable. A local model with local tools stays fully local.
- 同じデスクトップのワークスペースで、ACP を通じて Codex・Claude Code・Kimi を使えます。コーディングエージェントは実際のプロジェクトや隔離された一時的なワークスペースを読み書きし、コマンドを実行できます。
  - 原文（README）: Use Codex, Claude Code, or Kimi through ACP in the same desktop workspace. The coding agent can read and edit a real project or an isolated temporary workspace, run commands, and surface plans, tool steps, permission requests, and file changes.
- Artifact パネルは、エージェントが作成・編集したファイルを自動で集め、1 か所で確認・検索・オープンできます。
  - 原文（README）: Artifact panel automatically collects every file the agent creates or edits; preview, locate, and open them in one place
- ローカルのナレッジベースはファイル管理・全文検索・ベクトル検索に対応し、1 つのチャットに複数のコレクションを付けられます。
  - 原文（README）: Local knowledge base with file management, full-text and vector retrieval; attach multiple collections to one chat, enable or disable each independently, and retain collection and file provenance in answers
- リモート操作: スマートフォンで QR コードを読み取り、動いているワークスペースを確認・操作できます。
  - 原文（README）: Remote control — scan a QR code from your phone to view and steer the running workspace
- セッション・設定・ナレッジ・ランタイムの拡張は、すべて ~/.pinvou3/ に保存されます。
  - 原文（README）: Sessions, settings, knowledge, and runtime extensions all live under ~/.pinvou3/

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: pinvou-agent_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
