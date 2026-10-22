# 海外急上昇OSS「Compositor」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

robbietilton/Compositor は 2026-09-17 に GitHub で作成されたリポジトリです。2026-10-11 時点のスター数は 15,455 です。

## 主な機能とアーキテクチャ概要

- 作者は合成と後処理に Photoshop を使っていたため、Compositor はその作業の流れを中心に、最終画像を作るのに必要なツールを備えて作られています。
  - 原文（README）: I used to use Photoshop for compositing and post-processing, so Compositor is built around that workflow - with the tools needed to create a pixel-perfect final image.
- Compositor は macOS 専用です。
  - 原文（README）: Compositor is macOS only.
- Apple silicon を搭載した Mac の macOS 26.0 以降で動作します。
  - 原文（README）: macOS 26.0 or later on a Mac with Apple silicon
- レイヤーとフォルダーに対応し、不透明度と Photoshop の描画モード一式を同じ順で備えます。フォルダーの不透明度は中のすべてに効きます。
  - 原文（README）: Layers and folders, with opacity and Photoshop's full set of blend modes in its order — a folder's opacity dims everything inside it
- レイヤー効果（Stroke、Drop Shadow、Color Overlay、Inner Shadow、Outer Glow、Inner Glow）は GPU で描画され、いつでも編集できます。
  - 原文（README）: Layer effects: Stroke, Drop Shadow, Color Overlay, Inner Shadow, Outer Glow and Inner Glow, rendered on the GPU and editable at any time
- JPEG・PNG・HEIC・TIFF・WebP・SVG・PDF（各ページを個別のレイヤーとして、300 DPI またはキャンバスに合わせて）、カメラの RAW、Photoshop の PSD と PSB（8-bit RGB。CMYK は対象外）を読み込めます。
  - 原文（README）: Import JPEG, PNG, HEIC, TIFF, WebP, SVG, PDF (every page its own layer, at 300 DPI or fitted to the canvas), camera RAW (with a develop step first) and Photoshop PSD and PSB (8-bit RGB; not CMYK).
- AI エージェントやスクリプトはプロジェクトを直接作成・編集できます。.comp は PNG のレイヤーとマニフェストを入れたフォルダーで、開いているプロジェクトは書き込みに合わせて更新されます。
  - 原文（README）: AI agents and scripts can build and edit projects directly: a .comp is a folder of PNG layers and a manifest, and an open project updates live as it's written.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: compositor_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
