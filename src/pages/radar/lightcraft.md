---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-12"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/lightcraft"
repoCreatedAt: "2026-09-30"
stars: 10183
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "lightcraft - 純粋な Rust で作られた、オープンソースの非破壊型の写真ライブラリと RAW 現像ソフトです"
description: "純粋な Rust で作られた、オープンソースの非破壊型の写真ライブラリと RAW 現像ソフトです。"
---

# lightcraft: 概要

storytold/lightcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-12 時点のスター数は 10,183 です。

- 純粋な Rust で作られた、オープンソースの非破壊型の写真ライブラリと RAW 現像ソフトです。
  - 原文（README）: Photo library and raw development; an open-source, non-destructive photo library and raw developer, built in pure Rust.
- macOS・Windows・Linux でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: Native on macOS, Windows and Linux. In the browser via WebAssembly.
- AI エージェントが MCP を通じて最初から最後まで操作できます。
  - 原文（README）: Drivable end to end by AI agents over MCP.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: LightCraft is young and moving fast: alpha.

## 主な機能と構成（README の要約）

- すべての調整は非破壊で、元の画像には手を加えません。
  - 原文（README）: Every adjustment is non-destructive, so your originals are never touched.
- すべてのスライダーは、シーン参照・広色域・32-bit 浮動小数点のパイプラインで描画されます。
  - 原文（README）: Every slider renders through a scene-referred, wide-gamut, 32-bit float pipeline: highlights roll off like film, shadows open up without halos, and colour stays clean from capture to export.
- ホワイトバランスは色温度と色かぶり補正で調整し（RAW は Kelvin、JPEG は相対値）、プリセット・Auto・クリックで中立にするスポイトを使えます。
  - 原文（README）: White balance by temperature and tint (Kelvin for raw, relative for JPEG) with presets, Auto and a click-to-neutralise eyedropper.
- これらはすべて、知覚に基づく色空間 OkLCh で計算されます。
  - 原文（README）: All of it is computed in OkLCh, a modern perceptual colour space.
- カーブは構造上単調なので、意図しない階調の反転は起きません。
  - 原文（README）: Curves are monotone by construction, so you never get an accidental tone inversion.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/lightcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/lightcraft && cd lightcraft
cargo run --release -p lightcraft                       # opens your library (~/Pictures/LightCraft Library; a new one starts with demo photos)
cargo run --release -p lightcraft -- ~/Pictures/trip    # import your photos (folders are scanned, duplicates skipped)
cargo run --release -p lightcraft -- --memory           # a throwaway in-memory demo session (writes nothing)
cargo run --release -p lightcraft -- --control 7980     # with the automation channel
cargo xtask web --serve                                 # the same app in the browser: http://127.0.0.1:8080/
cargo run --release -p lightcraft-cli -- render photo.jpg -o out.jpg --set light.exposure=0.5
cargo xtask ci                                          # fmt, clippy, HEIF, tests, parity, layers, assets, WASM
```

```sh
CARGO_BUILD_JOBS=1 cargo build --release -p lightcraft -p lightcraft-cli
# Alternatively: CARGO_BUILD_JOBS=2 cargo build --release -p lightcraft -p lightcraft-cli
```

```sh
CARGO_BUILD_JOBS=1 CARGO_PROFILE_RELEASE_DEBUG=0 CARGO_PROFILE_RELEASE_LTO=false CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16 cargo build --release -p lightcraft -p lightcraft-cli
```

```sh
git clone https://github.com/storytold/craft-fonts ../craft-fonts
CRAFT_FONTS_DIR=../craft-fonts cargo run --release -p lightcraft
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/lightcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
