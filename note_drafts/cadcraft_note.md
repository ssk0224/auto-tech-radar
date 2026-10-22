# 海外急上昇OSS「cadcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/cadcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 5,766 です。

## 主な機能とアーキテクチャ概要

- CADCraft は、純粋な Rust で作られたオープンソースの 2D・3D CAD アプリケーションです。
  - 原文（README）: Computer-aided design and drafting; an open-source, modern 2D and 3D CAD application, built in pure Rust.
- macOS・Windows・Linux・FreeBSD でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
- CADCraft は初期の段階にあり、開発が速いペースで進んでいます。
  - 原文（README）: CADCraft is in early, fast development.
- DXF をネイティブに読み書きでき（ASCII とバイナリ、R12 から 2018 まで）、DWG ファイル（R13 から 2018 まで）はオープンソースの acadrust ライブラリで開いて保存できます。
  - 原文（README）: DXF is read and written natively (ASCII and binary, R12 through 2018), and DWG files (R13 through 2018) open and save through the open-source acadrust library.
- 純粋な Rust と egui で作られ、Electron や Web ビューは使いません。
  - 原文（README）: Pure Rust and egui, no Electron, no web view.
- メニューの項目・ツール・プロンプトはすべてコマンドです。エージェントは MCP・JSON の制御チャネル・CLI を通じて、人と同じようにコマンドラインに入力し、JSON で任意のコマンドを呼び、図面を調べて作業を確かめ、描画できます。
  - 原文（README）: Every menu item, tool and prompt is a command. Agents can type at the command line exactly like a person, call any command with JSON, inspect the drawing to verify their work, and render it — over MCP, a JSON control channel, or the CLI.
- 現在は SVG と PNG への書き出しに対応しています。
  - 原文（README）: Export to SVG and PNG today.
- CADCraft のリポジトリにはフォントが含まれず、システムにインストールされた TrueType/OpenType のフォントを使います。
  - 原文（README）: CADCraft has no fonts in its repository; it uses the TrueType/OpenType fonts installed on your system.

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
<!-- PAID_SEALED: cadcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub #Rust #CAD
