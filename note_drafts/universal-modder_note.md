# 海外急上昇OSS「universal-modder」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

rehan-remade/universal-modder は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 7,929 です。

## 主な機能とアーキテクチャ概要

- AI のコーディングエージェントが、手持ちの PC ゲームの mod を作れるようにするスキル・ツール・共有のナレッジベースです。
  - 原文（README）: Skills, tools and a shared knowledge base that let any AI coding agent mod almost any PC game you own.
- どのエージェントにも同じスキル（Agent Skills 形式）、fal の MCP サーバー、um の CLI が入ります。
  - 原文（README）: Each gets the same skills (Agent Skills format), the fal MCP server, and the um CLI.
- Git・Python 3.10 以降・ffmpeg も必要です。
  - 原文（README）: You also need Git, Python 3.10+ and ffmpeg. uv is recommended.
- クローンの中では、各エージェントが自分の探す場所でスキルを見つけます。.agents/skills（Codex・Gemini CLI・Copilot・Cursor・OpenCode）と .claude/skills（Claude Code）は skills/ の複製です。
  - 原文（README）: Inside a clone, each agent finds the skills where it looks for them: .agents/skills (Codex, Gemini CLI, Copilot, Cursor, OpenCode) and .claude/skills (Claude Code) are copies of skills/.
- 素材の生成には fal の API キーを使い、fal の MCP サーバーと um fal の両方で使われます。
  - 原文（README）: For assets, get a fal API key. It powers both the fal MCP server and um fal.
- 3D からスプライトを描画するには Blender が必要です。
  - 原文（README）: Blender is needed for 3D → sprite renders.
- Windows のゲームはネイティブに、または WSL から操作します。
  - 原文（README）: Windows games are driven natively or from WSL.
- エージェントは mod-any-game スキルから始め、毎回同じ手順を繰り返します。
  - 原文（README）: The agent starts with the mod-any-game skill and runs the same loop every time:

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
<!-- PAID_SEALED: universal-modder_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub #ClaudeCode
