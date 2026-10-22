---
layout: "../../layouts/Layout.astro"
title: "cadcraft - Pure Rust製オープンソース2D/3D CADエンジンの衝撃とMCPによるAI自律設計"
description: "AutoCAD互換の操作体系をPure Rustでフルスクラッチ実装。eguiによるネイティブ描画と、MCPによるAIエージェント駆動を実現した次世代CAD「cadcraft」を徹底解剖。"
pubDate: "2026-10-18"
tags: ["Rust", "OSS", "GitHub", "CAD", "MCP", "AI-Agent"]
repoUrl: "https://github.com/storytold/cadcraft"
repoCreatedAt: "2026-10-07"
stars: 5766
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと導入を勧める表現を削除し、README の開発状況（early development）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# cadcraft: 概要

storytold/cadcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 5,766 です。

CADソフトウェアの世界は数十年にわたり、Autodesk社のAutoCADをはじめとする独占的な商用プロプライエタリ製品が支配してきました。オープンソースの世界でもLibreCADやFreeCADなどが存在したものの、旧来のC++ベースの重厚なUIフレームワークへの依存や、スクリプト自動化・ヘッドレス運用の難しさが課題でした。

この現状を根本から打破するために登場したのが **「CADCraft」** です。
CADCraftは、クリーンルーム設計でPure Rustを用いて開発されたAutoCAD互換の2D/3D CADアプリケーションです。ElectronやWebViewを一切使わず、Rustの即時モードGUIフレームワーク「egui」と「wgpu」を使っています。README のバッジは開発状況を early development としており、一部のグラフィックドライバでクラッシュしうることも記載されています。

さらに最大の革新性は、**「AIエージェントによる自律設計（Agent-drivable over MCP）」** を設計思想の中核に据えている点です。コマンドライン、JSONコントロールチャネル、そして業界標準のMCPサーバーがネイティブ統合されており、LLM（ClaudeやGPTなど）が図面生成・編集・視覚的検証を完全自動で実行可能です。

## 🎯 成熟度の目安（AI による見立て）

- **根拠**:
  - **アーキテクチャの完成度**: C++のレガシーコードを持たず、Pure Rustで幾何計算（geom）、DXFパーサー（dxf）、エンティティDB（doc）、レンダラー（render）が分離されており、依存関係が極めてクリーン。
  - **互換性とパラメトリック機能**: DXF（R12〜2018）、DWG読み込み、拘束ソルバー、TrueType/OpenTypeフォントレンダリング、複線寸法（DIMSTYLE）をすでに網羅。
  - **早期開発（Early Development）フェーズ**: コア機能は完成度が高いものの、3Dソリッドモデリングや一部の高度な拡張エンティティは開発途上。
- **検証候補になる用途**:
  - README で開発初期（early development）とされているため、製造業・建築業における「図面フォーマット変換」「バッチレンダリング」「定型図面の自動生成」などの限られた用途で検証候補になります。本格的な作図環境の置き換えを検討する場合は、README の機能の状況（ROADMAP.md）を確認したうえで段階的に検証してください。

## 解決する主要な課題とアーキテクチャ

CADCraftは以下の課題を解決します。
1. **高額な年間サブスクリプションコスト**: 1シートあたり年間数十万円のライセンス費をゼロに。
2. **プラットフォーム縛り**: Windows、macOS（Apple Silicon/Intel）、Linux、FreeBSD、さらにはWebAssembly（ブラウザ内完全動作）まで同一バイナリ・コードベースで稼働。
3. **AI連携の断絶**: 従来のCADはGUI手作業が前提でしたが、CADCraftは全コマンドがJSONおよびMCP経由で実行可能。

### システムアーキテクチャ図

```mermaid
graph TD
    subgraph Clients["クライアント層"]
        GUI["デスクトップ GUI (egui / wgpu)"]
        Wasm["WebAssembly (ブラウザ版)"]
        CLI["cadcraft-cli"]
        AI["AI エージェント (Claude / Cursor / 自律Agent)"]
    end

    subgraph Interface["通信 & インターフェース層"]
        MCP["MCP Server (stdio / TCP 7979)"]
        JSONControl["JSON Control Channel"]
        CommandParser["AutoCAD互換 コマンドパーサー"]
    end

    subgraph Engine["CADCore (Pure Rust)"]
        EngineCore["cadcraft_engine\n(セッション・スナップ・選択・Undo)"]
        DocDB["cadcraft_doc\n('CoW Entity Store / cheap undo')"]
        Geom["cadcraft_geom\n(f64幾何計算・スプライン・交点・オフセット)"]
        Render["cadcraft_render\n('CPU/GPU Display List・ハッチ・寸法')"]
        IO["cadcraft_io\n('DXF R12-2018 / DWG / SVG / PNG / PDF')"]
    end

    GUI --> CommandParser
    Wasm --> CommandParser
    CLI --> CommandParser
    AI --> MCP
    MCP --> JSONControl
    JSONControl --> CommandParser

    CommandParser --> EngineCore
    EngineCore --> DocDB
    EngineCore --> Geom
    DocDB --> Render
    DocDB --> IO
```

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
