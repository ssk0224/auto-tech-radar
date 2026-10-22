---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-10"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/photocraft"
repoCreatedAt: "2026-09-30"
stars: 35313
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "photocraft - Adobe Photoshop をクリーンルーム方式で純粋な Rust により作り直した、オープンソースの画像編集ソフトです"
description: "Adobe Photoshop をクリーンルーム方式で純粋な Rust により作り直した、オープンソースの画像編集ソフトです。"
---

# photocraft: 概要

storytold/photocraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 35,313 です。

- Adobe Photoshop をクリーンルーム方式で純粋な Rust により作り直した、オープンソースの画像編集ソフトです。
  - 原文（README）: Image editing; an open-source, clean-room reimplementation of Adobe Photoshop, rebuilt in pure Rust.
- レイヤー・マスク・調整レイヤー・レイヤースタイル・文字・ベクター・ブラシ・PSD ファイルを、すべて Rust で書かれたネイティブアプリで扱います。
  - 原文（README）: Layers, masks, adjustment layers, layer styles, type, vectors, brushes and real PSD files, in a native app written entirely in Rust.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: Status: PhotoCraft is in early alpha, and we want to be straight about where it stands: much of Photoshop's feature surface exists in some form, but it is not yet a Photoshop replacement for daily professional work.

## 主な機能と構成（README の要約）

- wgpu（Metal・Vulkan・DX12・WebGPU）上の GPU コンポジター、コピーオンライトのタイル、マルチスレッドのフィルターを使います。
  - 原文（README）: ⚡ Native and fast A GPU compositor on wgpu (Metal, Vulkan, DX12, WebGPU), copy-on-write tiles and multithreaded filters.
- レイヤーつきの Photoshop 文書（PSD）を開いて編集・保存できます。psd-tools のテストファイル 309 個のうち 307 個は、保存し直しても描画結果が変わりません。
  - 原文（README）: 🗂️ Real PSD files Open, edit and save layered Photoshop documents. Re-saving keeps the render of 307 of the 309 psd-tools test files.
- すべての操作はコマンドなので、同じエンジンを UI・CLI・JSON の制御チャネル・MCP サーバーから動かせます。
  - 原文（README）: 🤖 Agent-ready Every action is a command, so you can drive the same engine from the UI, the CLI, a JSON control channel or an MCP server.
- 自動の選択機能は手元の機器で動き、クラウドもアカウントも使いません。
  - 原文（README）: Smart selection runs on your machine, with no cloud and no account.
- 文字レイヤーは編集可能なまま残り、レイヤースタイルを付けられ、PSD を往復しても保たれます。
  - 原文（README）: Type layers stay editable, take layer styles, and round-trip through PSD.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/photocraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/photocraft
cd photocraft
cargo run --release -p photocraft -- image.psd   # the desktop app
cargo test --workspace                           # the test suite
```

```sh
git clone https://github.com/storytold/craft-fonts ../craft-fonts
CRAFT_FONTS_DIR="$PWD/../craft-fonts" cargo run --release -p photocraft
```

```sh
flatpak install --user photocraft-<version>-linux-x86_64.flatpak   # or -linux-aarch64
flatpak run ai.storyteller.photocraft
```

```sh
ditto -x -k photocraft-cli-<version>-macos-universal.zip .
spctl --assess --type install -vv photocraft-cli-<version>-macos-universal/photocraft-cli
# ... accepted, source=Notarized Developer ID
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/photocraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
