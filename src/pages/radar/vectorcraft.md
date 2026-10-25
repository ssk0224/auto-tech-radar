---
layout: "../../layouts/Layout.astro"
title: "vectorcraft - README の要点（原文）"
description: "storytold/vectorcraft の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-15"
updatedDate: "2026-10-22"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/vectorcraft"
repoCreatedAt: "2026-09-30"
stars: 8898
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# vectorcraft: 概要

storytold/vectorcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 8,898 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Vector illustration; an open-source, modern vector art application, built in pure Rust.
- 原文（README）: It runs natively on macOS, Windows, Linux and FreeBSD, and in the browser via WebAssembly.
- 原文（README）: One codebase for the desktop apps and the same UI in the browser.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: VectorCraft is under active development.
- 原文（README）: Where we are (2026-10-10): alpha.

## 主な機能と構成（README の原文）

- 原文（README）: Multithreaded SIMD rendering off the UI thread.
- 原文（README）: A documented native format (.vectorcraft, JSON), first-class SVG, PDF (and PDF-compatible .ai) import and export, PNG/JPEG/WebP export, Export for Screens, and SVGZ, templates, GIF, TIFF and BMP on open.
- 原文（README）: Every menu item, tool gesture, panel and dialog can be driven over a JSON control channel and an MCP server, so Claude and other agents can draw, edit and export the way a person does.
- 原文（README）: Every piece below was built entirely through VectorCraft's command API, the same one the MCP server exposes to agents, and exported by VectorCraft's own renderer.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/vectorcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/vectorcraft
cd vectorcraft

cargo run --release -p vectorcraft                          # desktop app
cargo run --release -p vectorcraft -- examples/dusk-poster.vectorcraft
cargo run --release -p vectorcraft -- --control 7979        # + JSON control channel
cargo run --release -p vectorcraft-cli -- mcp               # MCP server (stdio)
cargo run --release -p vectorcraft-cli -- run --in examples/ribbons.vectorcraft --export out.pdf   # headless batch
cargo run --release -p vectorcraft-cli -- bench examples/neon-drive.vectorcraft                   # render timing
cargo xtask bundle                                        # dist/VectorCraft.app (macOS)
cd apps/vectorcraft-web && trunk build --release            # web build → dist/web
cargo xtask ci                                            # fmt, clippy, tests, layering, wasm, vendor names
```

```sh
claude mcp add vectorcraft -- /path/to/vectorcraft-cli mcp
```

```sh
claude mcp add vectorcraft -- /path/to/vectorcraft-cli mcp --automation-read-root /work/project --automation-write-root /work/project
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/vectorcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
