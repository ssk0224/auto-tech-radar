# 海外急上昇OSS「anatomy」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

wheresryan22/anatomy は 2026-10-08 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 9,975 です。

## 主な機能とアーキテクチャ概要

- anatomy は、アイデアを実際に動く物として組み立てて説明する Claude のスキルです。
  - 原文（README）: A Claude skill that explains an idea by building it as a real, working object.
- Antigravity、OpenCode、Codex、MiniMax Code でも動作します。
  - 原文（README）: Also runs in Antigravity, OpenCode, Codex and MiniMax Code.
- 小さな部品を多く組み合わせた、操作できるアイソメトリックの図を、SVG・WebGL・3D で作ります。
  - 原文（README）: Crafted, interactive isometric figures with many small precise parts, in SVG, WebGL and 3D.
- 技術的なアイデアを説明する図を Claude に頼むと、Anatomy はその概念どおりに動く物理的な物を考え出させます。
  - 原文（README）: Ask Claude for a figure that explains a technical idea, and Anatomy has it invent a physical thing whose working is the concept.
- その後 Claude は、小さな部品を多く組み合わせてその物を作り、題名・ヒント・表示つきのカードに入れ、ポインターとキーボードで動かせるようにし、すべての継ぎ目を拡大して自分の作業を確かめます。
  - 原文（README）: Then Claude builds that thing out of dozens of small, solid, shaded parts, puts it in a framed card with a title, a hint and a live readout, makes it move calmly under the pointer and the keyboard, and checks its own work by zooming in on every joint.
- 図に表示される数値は、部品を動かすのと同じ小さなモデルから来ています。
  - 原文（README）: Every number the figure shows comes from the same small model that moves its parts.
- API キーも npm install も不要で、キットは Node の組み込みモジュールだけを使います。
  - 原文（README）: No API keys and nothing to npm install: the kit uses only Node's built-in modules.
- Anatomy は Agent Skill の形式で、ルートに SKILL.md を置いたフォルダーです。このリポジトリがそのフォルダーです。
  - 原文（README）: Anatomy is a standard Agent Skill: a folder with a SKILL.md at its root. This repository is that folder.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: anatomy_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
