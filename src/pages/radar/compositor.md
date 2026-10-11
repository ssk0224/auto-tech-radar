---
layout: "../../layouts/Layout.astro"
title: "Compositor - The Photoshop alternative for Mac"
description: "Apple Siliconネイティブで動作し、AIエージェントによる外部自動制御にも対応したMITライセンスのオープンソース画像編集ソフトウェア「Compositor」の技術解説。"
pubDate: "2026-10-11"
tags: ["Swift", "OSS", "GitHub", "macOS", "Metal", "AI"]
repoUrl: "https://github.com/robbietilton/Compositor"
stars: 15455
---

# Compositor: 概要と革新性

近年、Adobe Creative Cloudのサブスクリプションコスト高騰やクラウド依存への反発から、ローカルネイティブかつ軽量なクリエイティブツールの需要が急速に高まっています。「Compositor」は、macOS（Apple Silicon）専用にゼロからSwiftで設計された、完全オープンソース（MITライセンス）のPhotoshopオルタナティブです。

従来のGIMPのようなマルチプラットフォームOSSが抱えていた「UI/UXの非直感性」「macOS独自機能への非対応」「描画レスポンスの遅延」といった課題を、macOS専用設計（MetalやAccelerateフレームワークのフル活用）により完全に克服。さらに特筆すべき革新性として、**「AIエージェントフレンドリーなアーキテクチャ」**を標準搭載している点が挙げられます。独自プロジェクト形式（`.comp`）をファイルシステム直結のJSONマニフェストとPNG群で構成することで、外部スクリプトや生成AIモデルがバックグラウンドから画像編集をリアルタイムに駆動できる設計になっています。

## 解決する主要な課題とアーキテクチャ

Compositorが解決する中核的な技術課題は以下の3点です：

1. **高負荷なGPU非破壊レンダリングのローカル完結**:
   各レイヤーの調整レイヤー（Curves, Levels, LUT）、レイヤースタイル（Drop Shadow, Stroke等）をMetalパイプライン上でリアルタイム計算。メモリ消費を動的にスケーリングし、大容量PSD/PSBファイルも即座に展開。
2. **Photoshopワークフローの完全再現**:
   ブレンドモードの計算順序、クリッピングマスク、非破壊変形、Camera Raw風フィルターパネルなど、プロが違和感なく移行できる操作系を提供。
3. **人間とAIエージェントのハイブリッド制作基盤**:
   `.comp`ファイルの実体はディレクトリ構造（`manifest.json` + `layer_*.png`）であり、OSのファイル監視（FSEvents）と連動。AIスクリプトがレイヤーを追加・変形すると、エディタ側がリロードなしで即座にビューポートを更新します。

```mermaid
graph TD
    subgraph Storage [プロジェクト実体: .comp ディレクトリ]
        M[manifest.json: 階層構造/座標/ブレンドモード/エフェクト]
        L1[layer_001.png: 背景ラスタデータ]
        L2[layer_002.png: 被写体/テキストマスク]
    end

    subgraph ExternalAgents [外部スクリプト / AIエージェント]
        Python[Python / Node.js 自動生成スクリプト]
        LLM[ローカルLLM / Vision Agent]
        Python -->|書き込み & 更新| Storage
        LLM -->|パラメータ調整| M
    end

    subgraph CompositorEngine [Compositor Core Engine (Swift / Metal)]
        FSWatcher[FSEvents ファイル監視モジュール]
        Parser[JSON & Image Decoder]
        RenderPipeline[Metal GPU レンダリングパイプライン]
        Viewport[Native macOS Viewport (MetalView)]
        
        Storage -->|変更検知| FSWatcher
        FSWatcher --> Parser
        Parser --> RenderPipeline
        RenderPipeline --> Viewport
        Viewport -->|人間による手動操作・保存| Storage
    end
```

## 競合ツール/商用SaaSとの徹底比較

| 機能・指標 | Adobe Photoshop | GIMP | Figma | **Compositor (本OSS)** |
|---|---|---|---|---|
| **ライセンス / コスト** | 月額約3,278円〜 / プロプライエタリ | 無料 / GPLv3 | 無料〜月額課金 / クラウド限定 | **完全無料 (MITライセンス)** |
| **プラットフォーム** | macOS / Windows / iPad | Win / Mac / Linux | Web / Electron | **macOS (Apple Silicon特化)** |
| **レンダリング基盤** | 独自GPUエンジン | GEGL (CPU主体/一部GPU) | WebGL | **Metal / Swift Native (超低遅延)** |
| **PSD/PSB 互換性** | 完全対応 (ネイティブ) | 部分対応 (スタイル欠落あり) | インポートのみ | **高精度対応 (レイヤー・マスク保持)** |
| **外部自動化 / AI統合** | ExtendScript / UXP (重厚) | Script-Fu / Python-fu | REST API / プラグイン | **ローカルファイル直書き換え型 (超高速)** |
| **ソースコード改変** | 不可 | 可能 (難解なCベース) | 不可 | **可能 (モダンSwift/Xcode)** |

## 💡 ビジネス・マネタイズ活用アイデア（実践例）

1. **EC事業者向けバナー大量自動生成ローカルパイプライン受託**:
   クラウドSaaSの画像生成API（CloudinaryやBannerbear等）を利用すると毎月数十万のAPI従量課金が発生します。Compositorの`.comp`書き換えアーキテクチャを活用し、ローカルMac Studioで数千枚の多言語・多サイズバナーを全自動バッチ出力するシステムを構築・納品する受託モデル（想定開発費：150万円〜）。
2. **広告代理店向け「AIアシスト型社内画像編集スイート」の内製化支援**:
   Compositorをフォークし、自社ファインチューニング済みのStable Diffusionや背景除去モデルをワンクリックで起動・差し替えできるプラグインを組み込んだ専用ビルドを提供。月額保守または開発ライセンスで収益化。
3. **ゲームアセット・2Dスプライト制作の自動化パイプライン**:
   UnityやUnreal Engineと連携し、キャラクタースキンや装備のバリエーションレイヤーを外部スクリプトから一括生成し、デザイナーがCompositor上で最終レタッチを行うハイブリッド制作フローのインテグレーション。

## インストール & クイックスタート手順

### 1. Homebrewによるワンコマンドインストール
最も簡単な導入方法はHomebrew Caskを使用することです：

```bash
brew install --cask robbietilton-compositor
```

### 2. ソースコードからのビルド（開発者向け）
独自のツールやレイヤーエフェクトを追加したい場合は、Xcodeからビルドします：

```bash
# リポジトリのクローン
git clone https://github.com/robbietilton/Compositor.git
cd Compositor

# Xcodeプロジェクトを開いてビルド
open Compositor.xcodeproj
```
※macOS 14 (Sonoma) 以降、およびApple Silicon搭載Macが必要です。Schemeを「Compositor」に設定して `Cmd + R` で起動します。

## 商用利用可否 & ライセンス考察

Compositorは**MIT License**の下で公開されています。
- **商用利用**: 商用プロジェクトでの制作、業務利用、またはコードをベースとした商用アプリケーションの再配布・販売が可能。
- **改変と組み込み**: 自社独自の機能を追加して社内ツールとして配備することや、クローズドソースの製品に組み込んで配布することも許容されています（著作権表示およびMIT許諾表示の保持のみが必要）。
- **GPLとの違い**: コピーレフト条項がないため、自社で開発したプラグインや追加コードをオープンソース化する義務が一切発生しません。エンタープライズ受託開発において極めて採用しやすいライセンスです。