---
title: "【徹底解剖】海外急上昇OSS「cadcraft」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["rust", "oss", "github", "architecture", "programming"]
published: false
---

# cadcraft: 概要と革新性

CADソフトウェアの世界は数十年にわたり、Autodesk社のAutoCADをはじめとする独占的な商用プロプライエタリ製品が支配してきました。オープンソースの世界でもLibreCADやFreeCADなどが存在したものの、旧来のC++ベースの重厚なUIフレームワークへの依存や、スクリプト自動化・ヘッドレス運用の難しさが課題でした。

この現状を根本から打破するために登場したのが **「CADCraft」** です。
CADCraftは、クリーンルーム設計でPure Rustを用いて開発されたAutoCAD互換の2D/3D CADアプリケーションです。ElectronやWebViewを一切使わず、Rustの即時モードGUIフレームワーク「egui」と「wgpu」をダイレクトに駆動させることで、超軽量・瞬時起動・ゼロクラッシュの堅牢性を達成しています。

さらに最大の革新性は、**「AIエージェントによる自律設計（Agent-drivable over MCP）」** を設計思想の中核に据えている点です。コマンドライン、JSONコントロールチャネル、そして業界標準のMCP（Model Context Protocol）サーバーがネイティブ統合されており、LLM（ClaudeやGPTなど）が図面生成・編集・視覚的検証を完全自動で実行可能です。

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
        DocDB["cadcraft_doc\n(CoW Entity Store / cheap undo)"]
        Geom["cadcraft_geom\n(f64幾何計算・スプライン・交点・オフセット)"]
        Render["cadcraft_render\n(CPU/GPU Display List・ハッチ・寸法)"]
        IO["cadcraft_io\n(DXF R12-2018 / DWG / SVG / PNG / PDF)"]
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

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・README から転記したインストール手順・ライセンスの確認先 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/cadcraft/)
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)

