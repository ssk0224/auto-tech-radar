---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-18"
tags: ["Rust","OSS","GitHub","Spreadsheet","MCP","WebAssembly"]
repoUrl: "https://github.com/storytold/gridcraft"
repoCreatedAt: "2026-10-07"
stars: 5729
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルを削除し、README の開発状況（alpha）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "gridcraft - 純粋な Rust で作られた、オープンソースのスプレッドシートアプリケーションです"
description: "純粋な Rust で作られた、オープンソースのスプレッドシートアプリケーションです。"
---

# gridcraft: 概要

storytold/gridcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 5,729 です。

- 純粋な Rust で作られた、オープンソースのスプレッドシートアプリケーションです。
  - 原文（README）: Spreadsheets and data; an open-source, high-performance modern spreadsheet application, built in pure Rust.
- macOS・Windows・Linux・BSD でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It runs natively on macOS, Windows, Linux and BSD, and in the browser via WebAssembly.
- デスクトップとウェブで 1 つの Rust のコードベースを使います。
  - 原文（README）: One Rust codebase for desktop and the web.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: GridCraft is in alpha: the core workflow works end to end, but depth, fidelity and file compatibility are still rough.

## 主な機能と構成（README の要約）

- 500 以上の関数、動的配列、LET と LAMBDA、構造化テーブル参照に対応します。
  - 原文（README）: 500+ functions, dynamic arrays, LET and LAMBDA, structured table references.
- XLSX がネイティブの形式で、スタイル・テーマ・数式（動的配列を含む）・テーブル・条件付き書式・入力規則・コメント・ハイパーリンク・グラフ・画像・スパークライン・ピボットテーブル・印刷設定を扱います。
  - 原文（README）: XLSX is the native format: styles, themes, formulas (including dynamic arrays), tables, conditional formats, validation, comments, hyperlinks, charts, pictures, sparklines, pivot tables and print settings round-trip.
- 97-2003 形式の .xls ブックは、値・数式・数値の書式とともに開けます（書式設定とオブジェクトはまだ対象外です）。
  - 原文（README）: Legacy 97-2003 .xls workbooks open with their values, formulas and number formats (formatting and objects not yet).
- コピーオンライトのブック、差分の再計算、画面に見える部分だけを配置する仮想化されたグリッドを備えます。
  - 原文（README）: Copy-on-write workbooks (undo snapshots are nearly free), incremental recalculation, and a virtualised grid that only lays out what's on screen.
- リボンのボタン・メニューの項目・ダイアログ・キー操作・マウス操作はすべてコマンドで、エージェントは JSON の制御チャネル・MCP サーバー・CLI から実行できます。
  - 原文（README）: Every ribbon button, menu item, dialog, keystroke and mouse gesture is a command that agents can run over a JSON control channel, an MCP server, or the CLI.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/gridcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
cargo run --release -p gridcraft                              # desktop app
cargo run --release -p gridcraft -- --sample sales            # open a sample (sales, budget, grades)
cargo run --release -p gridcraft -- book.xlsx                 # open a workbook
cargo run --release -p gridcraft -- --sample sales --control 7979   # + JSON control channel
cargo xtask ci                                                 # fmt, clippy, tests, assets, layering, wasm
```

```sh
cd apps/gridcraft-web && trunk build --release     # → dist/web (serve it with any static server)
cd apps/gridcraft-web && trunk serve --release     # http://127.0.0.1:8771  (?sample=sales opens a sample)
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/gridcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
