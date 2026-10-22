# 海外急上昇OSS「magpie」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

yetone/magpie は 2026-09-24 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 11,503 です。

## 主な機能とアーキテクチャ概要

- 1 つのローカルゲートウェイがすべてのエージェントの要求を受け、利用枠を使い切ると次のアカウントに切り替えます。
  - 原文（README）: One local gateway serves them all, and when a quota runs out, it quietly moves on to the next account.
- エージェントはそれぞれ、モデルの設定を独自のファイル・形式・キー・base URL で持っています。
  - 原文（README）: Each agent keeps its model in its own file, in its own format, with its own keys and base URLs.
- macOS・Windows・Linux（メニューバーのアプリ、ウィンドウ、TUI、web UI、CLI）、Docker、Termux で動作します。
  - 原文（README）: Runs on macOS, Windows and Linux (menu bar app, window, TUI, web UI and CLI), in Docker, and on Termux.
- 1 つの一覧から、どのエージェントにもどのモデルでも選べます。magpie はエージェント自身の設定のうち、関係する 1 つのキーだけを書き換えます。
  - 原文（README）: Pick any model for any agent from one list. magpie edits the one key that matters in the agent's own config.
- 利用枠を使い切っても続けられます。ルーティンググループが次のアカウントかモデルに移り、エージェントにはエラーが見えません。
  - 原文（README）: Keep going when a quota runs out: a routing group moves to the next account or model, and the agent never sees the error.
- 127.0.0.1:3425 のゲートウェイは OpenAI Chat・OpenAI Responses・Anthropic Messages・Gemini の形式を話し、ストリーミング・ツール呼び出し・推論を含めて相互に変換します。
  - 原文（README）: The gateway at 127.0.0.1:3425 speaks OpenAI Chat, OpenAI Responses, Anthropic Messages and Gemini, and translates between them, streaming, tool calls and reasoning included.
- エージェントの設定はアトミックに書き換えられ、コメント・順序・書式はそのまま残ります。
  - 原文（README）: The agent's config is rewritten atomically, and its comments, order and formatting stay as they were.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: magpie_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
