# 海外急上昇OSS「EffectCraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

storytold/effectcraft は 2026-10-01 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 7,161 です。

## 主な機能とアーキテクチャ概要

- 純粋な Rust で作られた、オープンソースのモーショングラフィックスと視覚効果のスタジオです。
  - 原文（README）: Motion graphics and visual effects; an open-source, professional motion graphics and visual effects studio, built in pure Rust.
- EffectCraft は、アニメーションのタイトル、モーショングラフィックス、合成の作業のためのものです。
  - 原文（README）: EffectCraft is for animated titles, motion graphics and compositing work: the kind of thing motion designers and VFX artists need.
- EffectCraft の最初のコミットは 2026 年 10 月 1 日です。
  - 原文（README）: EffectCraft is young: its first commit was on 1 October 2026.
- レイヤー（平面・シェイプ・テキスト・フッテージ・ほかのコンポジション）からコンポジションを組み、キーフレームでプロパティを動かし、エフェクトを重ねて結果をレンダリングします。
  - 原文（README）: You build a composition out of layers (solids, shapes, text, footage, other compositions), animate their properties with keyframes, stack effects on them and render the result.
- プロジェクトはバージョンつきの JSON（.ecproj）なので、バージョン管理で差分をきれいに取れます。
  - 原文（README）: Projects are versioned JSON (.ecproj), so they diff cleanly in version control.
- メニューの項目・タイムラインのドラッグ・プロパティの編集はすべて 1 つのコマンドの登録簿を通るため、同じ操作をコマンドライン・JSON の制御チャネル・エージェント向けの MCP サーバーから実行できます。
  - 原文（README）: Every menu item, timeline drag and property edit goes through one command registry, so the same actions are reachable from a command line, a JSON control channel and an MCP server for agents.
- FFmpeg は使いません。動画と音声のデコードとエンコードは純粋な Rust で、FilmCraft のコーデックと EffectCraft 独自の VP9・AV1・HEVC・Opus のエンコーダーを使います。
  - 原文（README）: No FFmpeg. Video and audio decoding and encoding are pure Rust: FilmCraft's codecs and EffectCraft's own VP9, AV1, HEVC and Opus encoders.
- MCP サーバー: effectcraft-cli mcp は stdio で Model Context Protocol を話し、単独でも、起動中のアプリにつないでも（--bridge 9877）動きます。
  - 原文（README）: MCP server: effectcraft-cli mcp speaks the Model Context Protocol over stdio, headless or bridged to the running app (--bridge 9877).

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: effectcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub #Rust
