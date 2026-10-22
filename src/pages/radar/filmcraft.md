---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-12"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/filmcraft"
repoCreatedAt: "2026-09-30"
stars: 10085
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "filmcraft - 純粋な Rust で作られた、オープンソースのノンリニア動画編集ソフトです"
description: "純粋な Rust で作られた、オープンソースのノンリニア動画編集ソフトです。"
---

# filmcraft: 概要

storytold/filmcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-12 時点のスター数は 10,085 です。

- 純粋な Rust で作られた、オープンソースのノンリニア動画編集ソフトです。
  - 原文（README）: Video editing, color and sound; an open-source, professional non-linear video editor, built in pure Rust.
- macOS・Windows・Linux でネイティブに動作し、WebAssembly によりブラウザでも動作します。
  - 原文（README）: An open-source, modern non-linear video editing workflow: native on macOS, Windows and Linux, and in the browser via WebAssembly.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: FilmCraft is in alpha.

## 主な機能と構成（README の要約）

- H.264・HEVC・ProRes・AAC のコーデックは、公開された仕様をもとに Rust で独自に書かれています。
  - 原文（README）: The H.264, HEVC, ProRes and AAC codecs are our own, written in Rust from the public specifications.
- GPU のコンポジターはリニアな光で処理します。
  - 原文（README）: A GPU compositor works in linear light.
- フレームの計算は正確な整数の時間で行うため、編集がずれません。
  - 原文（README）: Frame math runs on exact integer time, so edits never drift.
- アプリのすべての操作はコマンドで、AI エージェントが人と同じ精度で実行できます。
  - 原文（README）: And every action in the app is a command that an AI agent can drive as precisely as you can.
- 保存はアトミックで、自動保存は直近の複数の版を残し、各編集のすぐ後に書かれるクラッシュ復旧用の記録が、クラッシュや停電のあとに未保存の変更を戻します。
  - 原文（README）: Saves are atomic, auto-save keeps a rolling set of versions, and a crash-recovery journal written about a second after each edit brings back unsaved changes after a crash or power cut.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/filmcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
cargo run --release -p filmcraft                           # the desktop app, with a demo project
cargo run --release -p filmcraft -- --control 9876         # plus the JSON-lines control server
cargo run --release -p filmcraft-cli -- commands           # list every engine command
cargo run --release -p filmcraft-cli -- mcp                # MCP server (headless)
```

```sh
git clone https://github.com/storytold/craft-fonts ../craft-fonts
CRAFT_FONTS_DIR="$PWD/../craft-fonts" cargo run --release -p filmcraft
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/filmcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
