---
title: "【徹底解剖】海外急上昇OSS「vectorcraft」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["rust", "oss", "github", "architecture", "programming"]
published: false
---

# vectorcraft: 概要と革新性

近年、クリエイティブツールの世界ではプロプライエタリなSaaSベンダーによる価格改定やライセンス形態の囲い込みに対する反発が強まっています。その中で突如登場し、すでにGitHubスター数8,800超えの熱狂的な支持を集めているのが**VectorCraft**です。

VectorCraftは、Adobe IllustratorのワークフローをピュアRust（ゼロからのフルスクラッチ）で完全クリーンルーム再実装したオープンソースのベクターグラフィックツールです。macOS、Windows、Linux、FreeBSD上でネイティブ動作するだけでなく、WebAssembly（WASM）によってブラウザ上でも全く同じインターフェースと描画エンジンが稼働します。

さらに最大の特徴は、**MCP（Model Context Protocol）サーバーを内包した「エージェント・ネイティブ」な構造**です。Claude CodeなどのLLM/自律型AIエージェントが、JSON制御プロトコル経由で人間のオペレーターと全く同じようにツール操作、描画、レイヤー編集、書き出しを行える設計となっています。

---

## 解決する主要な課題とアーキテクチャ

従来のベクターグラフィックソフトウェア（IllustratorやInkscapeなど）は、数十年にわたるレガシーC/C++コードベースを抱えており、以下の課題を抱えていました：

1. **メインスレッド描画のブロッキング**: 複雑なパス演算や万単位のオブジェクト配置によるUIのフリーズ
2. **ヘッドレス・自動化の困難さ**: GUI前提で設計されているため、CI/CDパイプラインやバックエンド処理でのベクター生成・レンダリングが重厚かつ不安定
3. **AIエージェント連携の不在**: スクリプティング言語（ExtendScript等）のAPI制限が厳しく、自律AIエージェントが自在に図面を操作できない

VectorCraftは、これらの課題をモダンRustの並列処理アーキテクチャとマイクロクレート設計により根本から解決しています。

### アーキテクチャとデータフロー

VectorCraftはコアエンジンとUIレイヤーが完全に分離されており、eguiを採用したUIスレッドとは独立したバックグラウンドスレッドでSIMD並列レンダリングを実行します。さらにCLIやMCPサーバーからの入力を共通の`Control Protocol`を経由して直接`Engine`に伝達します。

```mermaid
graph TD
    subgraph Clients ["入力インターフェース"]
        UI["GUI (egui / WebAssembly)"]
        CLI["vectorcraft-cli"]
        Agent["AI Agent (Claude Code等)"]
    end

    subgraph InterfaceLayer ["制御・連携レイヤー"]
        MCP["MCP Server (stdio)"]
        Socket["JSON Control Protocol (TCP:7979)"]
    end

    subgraph CoreEngine ["VectorCraft Core (Rust Workspace)"]
        Engine["engine / tools crate"]
        Doc["doc crate (Document Model & Undo)"]
        PathOps["pathops & geom (Exact Booleans)"]
        Render["render crate (Multi-thread SIMD)"]
    end

    subgraph Output ["出力・ファイルシステム"]
        Screen["Screen (120fps / Retina)"]
        IO[".vectorcraft / SVG / PDF / AI / Affinity"]
    end

    Agent --> MCP
    MCP --> Socket
    Socket --> Engine
    CLI --> Engine
    UI --> Engine

    Engine --> Doc
    Doc --> PathOps
    Doc --> Render
    Render --> Screen
    Doc --> IO
```

- **SIMD並列オフスレッドレンダリング**: 20,000個のベクターシェイプをRetina解像度においてわずか約27msで描画。UIフレームレートは120fpsを堅持。
- **堅牢な幾何演算エンジン**: 構造共有（Structural Sharing）による無限Undo/Redoと、厳密な幾何ブール演算（パスファインダー処理での「演算不能エラー」を徹底排除）。
- **完全なファイル相互運用性**: ネイティブJSON（`.vectorcraft`）に加え、SVG、PDF/X、AI（PDF互換層）、Affinity（`.afdesign`, `.afpub`等）のダイレクトインポートに対応。

---

## 競合ツール/商用SaaSとの徹底比較

| 機能・指標 | Adobe Illustrator | Inkscape | Figma | **VectorCraft** |
| :--- | :--- | :--- | :--- | :--- |
| **開発言語** | C++ (レガシー) | C++ / GTK | C++ / WebAssembly | **Pure Rust** |
| **ライセンス形態** | 月額課金（プロプライエタリ） | GPL v3 | 月額課金（SaaS） | **MIT / Apache-2.0** |
| **描画性能** | 大規模パスで遅延発生 | 大規模パスで低速 | WebGL高速描画 | **SIMDマルチスレッド (27ms/2万パス)** |
| **エージェント親和性 (MCP)** | 不可 (ExtendScriptのみ) | 不可 (Pythonプラグイン) | プラグインAPI経由 | **ネイティブMCP / JSON RPC対応** |
| **ヘッドレス実行** | 難（デスクトップ起動必須） | 可能（CLI対応） | 外部API依存（制限有） | **CLIネイティブで高速バッチ書き出し** |
| **プラットフォーム** | macOS / Windows | デスクトップ各種 | Web中心 / Electron | **macOS / Win / Linux / BSD / Web** |

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・README から転記したインストール手順・ライセンスの確認先 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/vectorcraft/)
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)

