# 海外急上昇OSS「Strata」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

Niko1221/Strata は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 19,544 です。

## 主な機能とアーキテクチャ概要

- Strata は、通常はサーバーが必要なモデル Qwen3.8-Flash-Next（125-billion-parameter）を、一般的な PC で動かします。
  - 原文（README）: Strata runs Qwen3.8-Flash-Next, a 125-billion-parameter model that normally needs a server, on a normal PC.
- チャットとファイルは手元の PC に残ります。
  - 原文（README）: Your chats and files stay on your PC.
- OpenAI と Anthropic の API を話すため、Claude Code・Codex CLI・OpenCode などのエージェントから接続できます。
  - 原文（README）: It speaks the OpenAI and Anthropic APIs, so Claude Code, Codex CLI, OpenCode and other agents connect to it.
- RAM とグラフィックスメモリ（VRAM）を合わせて 32 GB 以上が必要です。Mac や Ryzen AI Max では統合メモリがこれにあたります。
  - 原文（README）: You need at least 32 GB of RAM and graphics memory (VRAM) together. On a Mac or a Ryzen AI Max, that is the unified memory.
- 同じメーカーのカード 2〜3 枚でモデルを分担できます（multi-GPU）。NVIDIA と AMD のカードにまたがってモデルを分けることはしません。
  - 原文（README）: Two or three cards of the same make can share a model (multi-GPU). Strata never splits a model across NVIDIA and AMD cards.
- アプリにはエンジンが内蔵されており、インストールしてモデルを選べばチャットできます。
  - 原文（README）: The app has the engine inside: install it, pick a model, chat.
- Strata が何をダウンロードし、いつインターネットを使い、ダウンロードをどう検証するかは docs/SAFETY.md にあります。
  - 原文（README）: What Strata downloads, when it uses the internet and how it checks downloads is in docs/SAFETY.md.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: strata_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
