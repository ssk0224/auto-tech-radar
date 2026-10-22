---
layout: "../../layouts/Layout.astro"
title: "photocraft - An open-source, clean-room reimplementation of Adobe Photoshop in pure Rust"
description: "An open-source, clean-room reimplementation of Adobe Photoshop in pure Rust"
pubDate: "2026-10-10"
tags: ["Rust", "OSS", "GitHub"]
repoUrl: "https://github.com/storytold/photocraft"
repoCreatedAt: "2026-09-30"
stars: 35313
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# photocraft: 概要

storytold/photocraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 35,313 です。

**PhotoCraft**（フォトクラフト）は、Adobe Photoshopをクリーンルーム設計（仕様の分析と振る舞い観察のみに基づき、プロプライエタリなコードを一切参照しない完全新規実装）により、**Pure Rust**で再構築したオープンソースの本格的画像編集アプリケーションです。

単なる「Photoshop風のUIを持つペイントソフト」にとどまらず、PSDファイルの高精度な可逆性（psd-toolsテストセット309件中307件で描画完全一致）、非破壊調整レイヤー、レイヤースタイル、高度なベクターパス、スマートオブジェクト、カラーマネジメント（ICC、CMYK/Lab、32bit HDR対応）に対応すると README に記載されています。さらに、**「AIエージェント対応（MCP / CLI / JSON制御）」**を中核に設計されており、人間がGUIから操作するツールとしてだけでなく、LLMや自動化パイプラインから操作できるグラフィックエンジンとして設計されています。

---

## 解決する主要な課題とアーキテクチャ

### 1. 解決する技術課題
- **ベンダーロックインと月額コストの高騰**: 商用SaaSやAdobe CCの高額ライセンス、クラウド強制同期、データ主権の問題を完全ローカル・オフライン動作で解決。
- **リソース過剰消費と非効率なUIスタック**: 近年のデスクトップアプリに多いElectron/Chromiumベースではなく、Pure Rustとegui、GPUネイティブコンポジタを採用。
- **自動化とヘッドレス運用の障壁**: 従来のDTP/グラフィックツールはGUI主導であり、サーバーサイドでのバッチ処理やAI連携が困難だったが、全機能をコマンド駆動化。

### 2. コアアーキテクチャ設計
PhotoCraftは24のクレートから構成される強固なレイヤードアーキテクチャを持ち、UI層とドキュメントエンジン層が完全に分離されています。

```mermaid
graph TD
    subgraph ControlInterfaces ["操作インターフェース"]
        UI["GUI (egui)"]
        CLI["photocraft-cli"]
        MCP["MCP Server (AI Agent)"]
        WS["JSON Control Channel"]
    end

    subgraph CommandLayer ["Unified Command Registry"]
        CR["500+ Command Registry<br/>(Undo/Redo / Deterministic)"]
    end

    subgraph EngineCore ["Engine Core (Pure Rust)"]
        DM["Document Model<br/>(Layers, Masks, Vectors)"]
        CoW["Tile Engine (256x256 Sparse CoW)"]
        ICC["Color Management (8/16/32bit, CMYK, Lab)"]
    end

    subgraph Compositing ["Compositing Pipeline"]
        GPU["wgpu Compositor<br/>(Metal / Vulkan / DX12 / WebGPU)"]
        CPU["CPU Reference Compositor<br/>(Oracle / Testing)"]
    end

    subgraph IOLayer ["I/O & Codecs"]
        PSD["photocraft-psd<br/>(Byte-level parser/writer)"]
        Codecs["TIFF / EXR / WebP / SVG"]
    end

    UI --> CR
    CLI --> CR
    MCP --> CR
    WS --> CR

    CR --> DM
    DM --> CoW
    DM --> ICC
    CoW --> GPU
    CoW --> CPU
    DM --> PSD
    DM --> Codecs
```

- **統一コマンドレジストリ**: 500以上の全操作がコマンドとして抽象化され、GUIクリックもMCP経由のプロンプト指示も全く同じ内部関数を叩きます。
- **Copy-on-Write (CoW) タイルエンジン**: キャンバスを256×256ピクセルのスパースタイルで管理。大解像度キャンバスでも変更部分のみを複製するため、ヒストリー（Undo）がメモリを圧迫しません。
- **デュアルコンポジタ**: CPUリファレンスコンポジタ（テスト用正解オラクル）と、`wgpu`を用いたマルチバックエンド（Vulkan, Metal, DirectX 12, WebGPU）GPUコンポジタを備え、画質の完全性とミリ秒単位の描画を両立。

---

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
