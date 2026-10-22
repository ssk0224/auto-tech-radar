---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-18"
tags: ["Rust","OSS","GitHub","CAD","MCP"]
repoUrl: "https://github.com/storytold/cadcraft"
repoCreatedAt: "2026-10-07"
stars: 5766
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと導入を勧める表現を削除し、README の開発状況（early development）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "cadcraft - CADCraft は、純粋な Rust で作られたオープンソースの 2D・3D CAD アプリケーションです"
description: "CADCraft は、純粋な Rust で作られたオープンソースの 2D・3D CAD アプリケーションです。"
---

# cadcraft: 概要

storytold/cadcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 5,766 です。

- CADCraft は、純粋な Rust で作られたオープンソースの 2D・3D CAD アプリケーションです。
  - 原文（README）: Computer-aided design and drafting; an open-source, modern 2D and 3D CAD application, built in pure Rust.
- macOS・Windows・Linux・FreeBSD でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
- CADCraft は初期の段階にあり、開発が速いペースで進んでいます。
  - 原文（README）: CADCraft is in early, fast development.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

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
