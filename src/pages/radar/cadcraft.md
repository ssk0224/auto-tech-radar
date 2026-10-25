---
layout: "../../layouts/Layout.astro"
title: "cadcraft - README の要点（原文）"
description: "storytold/cadcraft の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-18"
updatedDate: "2026-10-22"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/cadcraft"
repoCreatedAt: "2026-10-07"
stars: 5766
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと導入を勧める表現を削除し、README の開発状況（early development）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# cadcraft: 概要

storytold/cadcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 5,766 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Computer-aided design and drafting; an open-source, modern 2D and 3D CAD application, built in pure Rust.
- 原文（README）: It runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
- 原文（README）: CADCraft is in early, fast development.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: DXF is read and written natively (ASCII and binary, R12 through 2018), and DWG files (R13 through 2018) open and save through the open-source acadrust library.
- 原文（README）: Pure Rust and egui, no Electron, no web view.
- 原文（README）: Every menu item, tool and prompt is a command. Agents can type at the command line exactly like a person, call any command with JSON, inspect the drawing to verify their work, and render it — over MCP, a JSON control channel, or the CLI.
- 原文（README）: Export to SVG and PNG today.
- 原文（README）: CADCraft has no fonts in its repository; it uses the TrueType/OpenType fonts installed on your system.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/cadcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/cadcraft
cd cadcraft
cargo run --release -p cadcraft -- --sample       # opens the sample drawing
```

```text
line 0,0 @10,0 @0,5 c          a closed triangle
circle 5,2 1                    a circle
offset 0.25                     then pick the circle and a side
zoom e                          zoom to extents
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/cadcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
