---
title: "【徹底解剖】海外急上昇OSS「solidcraft」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["rust", "oss", "github", "architecture", "programming"]
published: false
---

# solidcraft: 概要と革新性

`SolidCraft`は、純粋なRust（Pure Rust）でフルスクラッチ開発されたオープンソースのパラメトリック3D CADアプリケーションです。Autodesk Fusionなどの商用CADと同様の幾何拘束スケッチ、フィーチャータイムライン、パラメトリックリビルド、板金加工、アセンブリモデリングをローカルデスクトップ、Webブラウザ（WebGPU/WASM）、ヘッドレスCLIのすべてで動作させます。

特筆すべき最大のエッジは、**「Model Context Protocol（MCP）サーバー」をコアCLIに内蔵している点**です。LLMエージェント（Claude DesktopやCursor等）がMCPツール経由で3Dパーツを直接生成・計測・操作できる「AIネイティブCAD」として、製造業DXおよび自動設計パイプラインにパラダイムシフトをもたらしています。

## 🎯 成熟度の目安（AI による見立て）

- **根拠**:
  - 記事作成時点の GitHub スター数は 5,700 を超えています（スター数は品質の保証ではありません）。
  - 幾何オラクル検証において、76 個の公開参照パーツのうち 75 個で、体積・面積・重心・バウンディングボックスが解析解または FreeCAD の計算結果と一致したと README に記載されています（残り 1 個は既知の不具合として追跡中）。
  - レイヤードアーキテクチャ（L0〜L5）で構成された、MIT/Apache-2.0デュアルライセンスのクリーンルーム実装。
  - README では「Early but usable for simple parts」（初期段階だが単純な部品には使える）とされ、複雑な曲面モデリングや大規模アセンブリには未実装の領域があります。**「AI による定型の治具・ブラケットの生成」「Web 上の 3D カスタマイザー」「ヘッドレス CAD パイプライン」**などの限られた用途で検証候補になります。

## 解決する主要な課題とアーキテクチャ

従来のオープンソースCAD（FreeCADやOpenSCAD等）や商用CAD（Fusion 360, SolidWorks等）が抱えていた以下の課題を根本から解決します。

1. **AIエージェント親和性の欠如**: 従来のGUI中心CADは外部APIが貧弱であり、AIエージェントによるリアルタイム操作が困難だった。
2. **パフォーマンスと依存性の肥大化**: C++で書かれた旧来のCADエンジンはビルドが複雑でWeb展開が困難。SolidCraftはPure Rust＋WebGPUによりWebブラウザでもネイティブ同様に60fpsで動作。
3. **テッセレーションのボトルネック**: 独自のGPU Compute Shaderを用いたパッチ生成により、従来比50〜65倍（78ボディの評価が約65ms）の超高速メッシュ化を実現。

### システムアーキテクチャ ＆ データフロー図

```mermaid
graph TD
    subgraph UI_And_Agent_Layer ["Interface & Control Layer"]
        DesktopApp["Desktop App: egui + wgpu"]
        WebApp["Web Browser: WASM + WebGPU"]
        AIAgent["LLM / AI Agent: Claude, Cursor"]
        CLI["Headless CLI: solidcraft-cli"]
    end

    subgraph Core_Engine ["SolidCraft Engine: L4 / L5"]
        MCPServer["MCP Server stdio / TCP"]
        CommandRegistry["Command Registry: Everything is a Command"]
        SessionMgr["Document & Session Manager"]
    end

    subgraph CAD_Kernel ["Parametric Kernel: L0 - L3"]
        Timeline["L2: Parametric Timeline & Expr Engine"]
        ConstraintSolver["L1: Geometric Solver Loci + LM"]
        BRepKernel["L1: B-Rep Kernel truck"]
        TessPlanner["L5: Compute Shader Tessellation Planner"]
        IOEngine["L3: STEP / IGES / STL / 3MF / URDF Engine"]
    end

    DesktopApp --> CommandRegistry
    WebApp --> CommandRegistry
    CLI --> CommandRegistry
 AIAgent -->|MCP Tools JSON-RPC| MCPServer
    MCPServer --> CommandRegistry

    CommandRegistry --> SessionMgr
    SessionMgr --> Timeline
    Timeline --> ConstraintSolver
    Timeline --> BRepKernel
    BRepKernel --> TessPlanner
    BRepKernel --> IOEngine
```

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・README から転記したインストール手順・ライセンスの確認先 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/solidcraft/)
- 🔒 **有料（note）**: 導入提案書テンプレート（Markdown）と工数・見積表 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)

