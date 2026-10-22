# 海外急上昇OSS「vectorcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/vectorcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 8,898 です。

## 主な機能とアーキテクチャ概要

- 純粋な Rust で作られた、オープンソースのベクターイラストのアプリケーションです。
  - 原文（README）: Vector illustration; an open-source, modern vector art application, built in pure Rust.
- macOS・Windows・Linux・FreeBSD でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
- デスクトップアプリとブラウザで、1 つのコードベースと同じ UI を使います。
  - 原文（README）: One codebase for the desktop apps and the same UI in the browser.
- 描画はマルチスレッドの SIMD で、UI のスレッドとは別に行います。
  - 原文（README）: Multithreaded SIMD rendering off the UI thread.
- ネイティブの形式（.vectorcraft、JSON）は文書化されており、SVG と PDF（PDF 互換の .ai を含む）の読み書き、PNG/JPEG/WebP の書き出しに対応します。
  - 原文（README）: A documented native format (.vectorcraft, JSON), first-class SVG, PDF (and PDF-compatible .ai) import and export, PNG/JPEG/WebP export, Export for Screens, and SVGZ, templates, GIF, TIFF and BMP on open.
- メニューの項目・ツールの操作・パネル・ダイアログはすべて JSON の制御チャネルと MCP サーバーから操作でき、Claude などのエージェントが人と同じように描画・編集・書き出しを行えます。
  - 原文（README）: Every menu item, tool gesture, panel and dialog can be driven over a JSON control channel and an MCP server, so Claude and other agents can draw, edit and export the way a person does.
- VectorCraft のコマンド API は、MCP サーバーがエージェントに公開しているものと同じです。
  - 原文（README）: Every piece below was built entirely through VectorCraft's command API, the same one the MCP server exposes to agents, and exported by VectorCraft's own renderer.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: vectorcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
