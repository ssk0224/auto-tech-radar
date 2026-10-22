# 海外急上昇OSS「photocraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/photocraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 35,313 です。

## 主な機能とアーキテクチャ概要

- Adobe Photoshop をクリーンルーム方式で純粋な Rust により作り直した、オープンソースの画像編集ソフトです。
  - 原文（README）: Image editing; an open-source, clean-room reimplementation of Adobe Photoshop, rebuilt in pure Rust.
- レイヤー・マスク・調整レイヤー・レイヤースタイル・文字・ベクター・ブラシ・PSD ファイルを、すべて Rust で書かれたネイティブアプリで扱います。
  - 原文（README）: Layers, masks, adjustment layers, layer styles, type, vectors, brushes and real PSD files, in a native app written entirely in Rust.
- wgpu（Metal・Vulkan・DX12・WebGPU）上の GPU コンポジター、コピーオンライトのタイル、マルチスレッドのフィルターを使います。
  - 原文（README）: ⚡ Native and fast A GPU compositor on wgpu (Metal, Vulkan, DX12, WebGPU), copy-on-write tiles and multithreaded filters.
- レイヤーつきの Photoshop 文書（PSD）を開いて編集・保存できます。psd-tools のテストファイル 309 個のうち 307 個は、保存し直しても描画結果が変わりません。
  - 原文（README）: 🗂️ Real PSD files Open, edit and save layered Photoshop documents. Re-saving keeps the render of 307 of the 309 psd-tools test files.
- すべての操作はコマンドなので、同じエンジンを UI・CLI・JSON の制御チャネル・MCP サーバーから動かせます。
  - 原文（README）: 🤖 Agent-ready Every action is a command, so you can drive the same engine from the UI, the CLI, a JSON control channel or an MCP server.
- 自動の選択機能は手元の機器で動き、クラウドもアカウントも使いません。
  - 原文（README）: Smart selection runs on your machine, with no cloud and no account.
- 文字レイヤーは編集可能なまま残り、レイヤースタイルを付けられ、PSD を往復しても保たれます。
  - 原文（README）: Type layers stay editable, take layer styles, and round-trip through PSD.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: photocraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
