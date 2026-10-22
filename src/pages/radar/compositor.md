---
layout: "../../layouts/Layout.astro"
title: "Compositor - README の要点（原文）"
description: "robbietilton/Compositor の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-11"
updatedDate: "2026-10-22"
tags: ["Swift","OSS","GitHub"]
repoUrl: "https://github.com/robbietilton/Compositor"
repoCreatedAt: "2026-09-17"
stars: 15455
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# Compositor: 概要

robbietilton/Compositor は 2026-09-17 に GitHub で作成されたリポジトリです。2026-10-11 時点のスター数は 15,455 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: I used to use Photoshop for compositing and post-processing, so Compositor is built around that workflow - with the tools needed to create a pixel-perfect final image.
- 原文（README）: Compositor is macOS only.
- 原文（README）: macOS 26.0 or later on a Mac with Apple silicon

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Layers and folders, with opacity and Photoshop's full set of blend modes in its order — a folder's opacity dims everything inside it
- 原文（README）: Layer effects: Stroke, Drop Shadow, Color Overlay, Inner Shadow, Outer Glow and Inner Glow, rendered on the GPU and editable at any time
- 原文（README）: Import JPEG, PNG, HEIC, TIFF, WebP, SVG, PDF (every page its own layer, at 300 DPI or fitted to the canvas), camera RAW (with a develop step first) and Photoshop PSD and PSB (8-bit RGB; not CMYK).
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
