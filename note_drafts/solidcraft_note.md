# 海外急上昇OSS「solidcraft」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

tangency-labs/solidcraft は 2026-10-08 に GitHub で作成されたリポジトリです。2026-10-19 時点のスター数は 5,717 です。

## 主な機能とアーキテクチャ概要

- 純粋な Rust で作られた、オープンソースのパラメトリック 3D CAD アプリケーションです。
  - 原文（README）: An open-source parametric 3D CAD application built in pure Rust.
- スケッチと拘束からパラメトリックなフィーチャーのタイムラインでソリッドを作り、寸法を変えるとモデルが作り直されます。
  - 原文（README）: Sketch, constrain, and build solids with a parametric feature timeline. Change a dimension and watch your model rebuild.
- デスクトップ・ブラウザで動かせるほか、内蔵の MCP サーバーを通じて AI エージェントにモデリングさせることもできます。
  - 原文（README）: Run it on your desktop, in your browser, or let AI agents model through the built-in MCP server.
- 初期段階ですが単純な部品には使えます。公開された参照部品 76 個のうち 75 個で、体積・面積・重心・外接箱が解析値または FreeCAD の計算値と一致します。
  - 原文（README）: Early but usable for simple parts: 75 of 76 public reference parts match their analytic or FreeCAD-computed volume, area, centre of mass and bounding box (oracle); the other is a tracked bug.
- フィーチャー: 押し出し・回転・スイープ・ロフト・フィレット・面取り・シェル・抜き勾配・穴・ねじ・パターン・ミラー・分割・結合を、編集できるパラメトリックなタイムライン上で扱います。
  - 原文（README）: Features: extrude, revolve, sweep, loft, fillet, chamfer, shell, draft, holes, threads, patterns, mirror, split and combine on an editable parametric timeline.
- ファイル: STEP・IGES・3MF・STL・OBJ・glTF の読み書き（対応する範囲）、URDF の書き出し、.solidcraft 形式の設計に対応します。
  - 原文（README）: Files: STEP, IGES, 3MF, STL, OBJ and glTF in and out where supported, URDF export, .solidcraft designs.
- デスクトップアプリ・ブラウザアプリ・画面なしの CLI・MCP サーバーは、すべて同じコマンドで動きます。
  - 原文（README）: Desktop app, browser app, headless CLI and MCP server, all running the same commands.
- スクリプトは UI が実行するのと同じコマンドを並べた JSON の一覧で、solidcraft-cli run で実行します。
  - 原文（README）: A script is a JSON list of the same commands the UI runs, executed with solidcraft-cli run.

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
<!-- PAID_SEALED: solidcraft_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
