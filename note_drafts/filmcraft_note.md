# 海外急上昇OSS「filmcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/filmcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-12 時点のスター数は 10,085 です。

## 主な機能とアーキテクチャ概要

- 純粋な Rust で作られた、オープンソースのノンリニア動画編集ソフトです。
  - 原文（README）: Video editing, color and sound; an open-source, professional non-linear video editor, built in pure Rust.
- macOS・Windows・Linux でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: An open-source, modern non-linear video editing workflow: native on macOS, Windows and Linux, and in the browser via WebAssembly.
- H.264・HEVC・ProRes・AAC のコーデックは、公開された仕様をもとに Rust で独自に書かれています。
  - 原文（README）: The H.264, HEVC, ProRes and AAC codecs are our own, written in Rust from the public specifications.
- GPU のコンポジターはリニアな光で処理します。
  - 原文（README）: A GPU compositor works in linear light.
- フレームの計算は正確な整数の時間で行うため、編集がずれません。
  - 原文（README）: Frame math runs on exact integer time, so edits never drift.
- アプリのすべての操作はコマンドで、AI エージェントが人と同じ精度で実行できます。
  - 原文（README）: And every action in the app is a command that an AI agent can drive as precisely as you can.
- 保存はアトミックで、自動保存は直近の複数の版を残し、各編集のすぐ後に書かれるクラッシュ復旧用の記録が、クラッシュや停電のあとに未保存の変更を戻します。
  - 原文（README）: Saves are atomic, auto-save keeps a rolling set of versions, and a crash-recovery journal written about a second after each edit brings back unsaved changes after a crash or power cut.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: filmcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
