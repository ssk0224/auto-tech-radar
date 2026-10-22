---
layout: "../../layouts/Layout.astro"
title: "Compositor - The Photoshop alternative for Mac"
description: "Apple Siliconネイティブで動作し、AIエージェントによる外部自動制御にも対応したMITライセンスのオープンソース画像編集ソフトウェア「Compositor」の技術解説。"
pubDate: "2026-10-11"
tags: ["Swift", "OSS", "GitHub", "macOS", "Metal", "AI"]
repoUrl: "https://github.com/robbietilton/Compositor"
repoCreatedAt: "2026-09-17"
stars: 15455
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# Compositor: 概要

robbietilton/Compositor は 2026-09-17 に GitHub で作成されたリポジトリです。2026-10-11 時点のスター数は 15,455 です。

近年、Adobe Creative Cloudのサブスクリプションコスト高騰やクラウド依存への反発から、ローカルネイティブかつ軽量なクリエイティブツールの需要が急速に高まっています。「Compositor」は、macOS（Apple Silicon）専用にゼロからSwiftで設計された、完全オープンソース（MITライセンス）のPhotoshopオルタナティブです。

従来のGIMPのようなマルチプラットフォームOSSが抱えていた「UI/UXの非直感性」「macOS独自機能への非対応」「描画レスポンスの遅延」といった課題を、macOS専用設計（MetalやAccelerateフレームワークのフル活用）により完全に克服。さらに特筆すべき革新性として、**「AIエージェントフレンドリーなアーキテクチャ」**を標準搭載している点が挙げられます。独自プロジェクト形式（`.comp`）をファイルシステム直結のJSONマニフェストとPNG群で構成することで、外部スクリプトや生成AIモデルがバックグラウンドから画像編集をリアルタイムに駆動できる設計になっています。

## 解決する主要な課題とアーキテクチャ

Compositorが解決する中核的な技術課題は以下の3点です：

1. **高負荷なGPU非破壊レンダリングのローカル完結**:
   各レイヤーの調整レイヤー（Curves, Levels, LUT）、レイヤースタイル（Drop Shadow, Stroke等）をMetalパイプライン上でリアルタイム計算。メモリ消費を動的にスケーリングし、大容量PSD/PSBファイルも即座に展開。
2. **Photoshop風のワークフロー**:
   ブレンドモードの計算順序、クリッピングマスク、非破壊変形、Camera Raw風フィルターパネルなど、プロが違和感なく移行できる操作系を提供。
3. **人間とAIエージェントのハイブリッド制作基盤**:
   `.comp`ファイルの実体はディレクトリ構造（`manifest.json` + `layer_*.png`）であり、OSのファイル監視（FSEvents）と連動。AIスクリプトがレイヤーを追加・変形すると、エディタ側がリロードなしで即座にビューポートを更新します。

```mermaid
graph TD
    subgraph Storage ["プロジェクト実体: .comp ディレクトリ"]
        M["manifest.json: 階層構造/座標/ブレンドモード/エフェクト"]
        L1["layer_001.png: 背景ラスタデータ"]
        L2["layer_002.png: 被写体/テキストマスク"]
    end

    subgraph ExternalAgents ["外部スクリプト / AIエージェント"]
        Python["Python / Node.js 自動生成スクリプト"]
        LLM["ローカルLLM / Vision Agent"]
        Python -->|書き込み & 更新| Storage
        LLM -->|パラメータ調整| M
    end

    subgraph CompositorEngine ["Compositor Core Engine (Swift / Metal)"]
        FSWatcher[FSEvents ファイル監視モジュール]
        Parser["JSON & Image Decoder"]
        RenderPipeline[Metal GPU レンダリングパイプライン]
        Viewport["Native macOS Viewport (MetalView)"]
        
        Storage -->|変更検知| FSWatcher
        FSWatcher --> Parser
        Parser --> RenderPipeline
        RenderPipeline --> Viewport
        Viewport -->|人間による手動操作・保存| Storage
    end
```

## インストール（README からの転記）

以下は [README](https://github.com/robbietilton/Compositor#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
brew install --cask robbietilton-compositor
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/robbietilton/Compositor/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
