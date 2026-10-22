# 海外急上昇OSS「wordcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/wordcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 11,077 です。

## 主な機能とアーキテクチャ概要

- 純粋な Rust で作られた、オープンソースのワードプロセッサーです。
  - 原文（README）: Writing and document design; an open-source, modern word processor, built in pure Rust.
- .docx を読み書きでき、macOS・Windows・Linux・BSD でネイティブに、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It reads and writes .docx, runs natively on macOS, Windows, Linux and BSD, and in the browser via WebAssembly.
- スペルや文法のチェックを含め、すべてオフラインで動作します。
  - 原文（README）: Spelling, grammar and everything else work offline.
- .docx（OOXML）のほか .odt・.rtf・.html・.md・.tex（LaTeX）・.txt を開いて保存でき、97-2003 の .doc も開けます。PDF には選択できる文字・リンク・しおりつきで書き出せます。
  - 原文（README）: Opens and saves .docx (OOXML), and also .odt, .rtf, .html, .md, .tex (LaTeX), .txt; opens legacy 97-2003 .doc; exports PDF with real, selectable text, links and bookmarks.
- Electron も Tauri も使わず、GPU 上のネイティブな egui で動きます。
  - 原文（README）: No Electron, no Tauri: native egui on the GPU.
- すべての操作は id つきのコマンドで、同じ 422 個のコマンドがリボン・キーボードショートカット・コマンド検索・コマンドラインのツール・JSON の制御チャネル・MCP サーバーを動かします。
  - 原文（README）: Every action is a command with an id. The same 422 commands drive the ribbon, keyboard shortcuts, the command search, a command-line tool, a JSON control channel and an MCP server.
- クリーンルーム方式で、公開された仕様と観察から作られています。
  - 原文（README）: Clean-room: built from public specifications and observation, with every asset original or openly licensed.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: wordcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
