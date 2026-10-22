---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-11"
tags: ["Swift","OSS","GitHub","macOS","AI"]
repoUrl: "https://github.com/robbietilton/Compositor"
repoCreatedAt: "2026-09-17"
stars: 15455
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "Compositor - 作者は合成と後処理に Photoshop を使っていたため、Compositor はその作業の流れを中心に、最終画像を作るのに必要なツールを備えて作られています"
description: "作者は合成と後処理に Photoshop を使っていたため、Compositor はその作業の流れを中心に、最終画像を作るのに必要なツールを備えて作られています。"
---

# Compositor: 概要

robbietilton/Compositor は 2026-09-17 に GitHub で作成されたリポジトリです。2026-10-11 時点のスター数は 15,455 です。

- 作者は合成と後処理に Photoshop を使っていたため、Compositor はその作業の流れを中心に、最終画像を作るのに必要なツールを備えて作られています。
  - 原文（README）: I used to use Photoshop for compositing and post-processing, so Compositor is built around that workflow - with the tools needed to create a pixel-perfect final image.
- Compositor は macOS 専用です。
  - 原文（README）: Compositor is macOS only.
- Apple silicon を搭載した Mac の macOS 26.0 以降で動作します。
  - 原文（README）: macOS 26.0 or later on a Mac with Apple silicon

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- レイヤーとフォルダーに対応し、不透明度と Photoshop の描画モード一式を同じ順で備えます。フォルダーの不透明度は中のすべてに効きます。
  - 原文（README）: Layers and folders, with opacity and Photoshop's full set of blend modes in its order — a folder's opacity dims everything inside it
- レイヤー効果（Stroke、Drop Shadow、Color Overlay、Inner Shadow、Outer Glow、Inner Glow）は GPU で描画され、いつでも編集できます。
  - 原文（README）: Layer effects: Stroke, Drop Shadow, Color Overlay, Inner Shadow, Outer Glow and Inner Glow, rendered on the GPU and editable at any time
- JPEG・PNG・HEIC・TIFF・WebP・SVG・PDF（各ページを個別のレイヤーとして、300 DPI またはキャンバスに合わせて）、カメラの RAW、Photoshop の PSD と PSB（8-bit RGB。CMYK は対象外）を読み込めます。
  - 原文（README）: Import JPEG, PNG, HEIC, TIFF, WebP, SVG, PDF (every page its own layer, at 300 DPI or fitted to the canvas), camera RAW (with a develop step first) and Photoshop PSD and PSB (8-bit RGB; not CMYK).
- AI エージェントやスクリプトはプロジェクトを直接作成・編集できます。.comp は PNG のレイヤーとマニフェストを入れたフォルダーで、開いているプロジェクトは書き込みに合わせて更新されます。
  - 原文（README）: AI agents and scripts can build and edit projects directly: a .comp is a folder of PNG layers and a manifest, and an open project updates live as it's written.

## インストール（README からの転記）

以下は [README](https://github.com/robbietilton/Compositor#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
brew install --cask robbietilton-compositor
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/robbietilton/Compositor/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
