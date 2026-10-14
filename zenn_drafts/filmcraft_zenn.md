---
title: "【徹底解剖】海外急上昇OSS「filmcraft」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["rust", "oss", "github", "architecture", "プログラミング"]
published: true
---

# filmcraft: 概要と革新性

**FilmCraft**は、Adobe Premiere ProのUIおよびワークフローをピュアRustでゼロからクリーンルーム再実装したオープンソースのノンリニアビデオ編集（NLE）システムです。

従来のオープンソース動画編集ソフト（Shotcut、Kdenlive、Blenderなど）の多くは、動画デコード・エンコード処理をFFmpegなどのC/C++ライブラリに全面的に依存していました。しかし、FilmCraftは**FFmpeg非依存**を掲げ、H.264、HEVC、ProRes、AACなどの主要コーデックやコンテナパーサーをITU-T/ISO/IETFの公式仕様書に基づきピュアRustで独自実装しています。

最大の革新性は、全UI操作および編集パイプラインが650以上の厳密に型定義されたコマンドとして抽象化されており、標準で**MCP (Model Context Protocol)** サーバーおよびJSON-RPC制御ソケットを備えている点です。人間が触るPremiere互換のネイティブGUIを持ちながら、Claudeなどの自律型AIエージェントがヘッドレスまたはリアルタイム描画付きでタイムライン配置・カラーコレクション・音声ミックス・書き出しをミリ秒精度の完全自律操作で行える「AIネイティブ・ビデオ編集基盤」を実現しています。

## 解決する主要な課題とアーキテクチャ

FilmCraftは、長年プロフェッショナル映像制作業界と自動化エンジニアリングを悩ませてきた以下の課題を解決します。

1. **高額なプロ向けNLEのライセンス縛りと自動化の難しさ**: Premiere Pro等のExtendScript/CEP/UXPは低速でヘッドレス運用が難しく、クラウド自動レンダリングに不向き。
2. **フレーム落ち・音ズレ問題（浮動小数点ドリフト）**: ドロップフレーム（29.97fps）や混在フレームレートの計算に浮動小数点数を用いると、長時間シーケンスで1フレーム未満の累積誤差（ドリフト）が発生する。
3. **C/C++製マルチメディアライブラリの脆弱性とクラッシュ**: 外部メモリ破壊やセグフォをRustの所有権・型システムで完全排除。

### アーキテクチャとデータフロー

FilmCraftは、UIフレームワークやOS APIに依存しないレイヤードアーキテクチャを採用しています。タイムベースには毎秒`254,016,000,000`ティック（24, 25, 30, 23.976, 29.97, 59.94fpsおよび44.1kHz, 48kHz, 96kHzの公倍数）の固定小数点整数を使用し、絶対的な時間精度を保証します。

```mermaid
graph TD
    subgraph Control_Layer [制御・インターフェース層]
        UI[Desktop UI / egui]
        Web[WebAssembly / Web Browser]
        CLI[filmcraft-cli]
        MCP[MCP Server / AI Agent Claude]
        Socket[TCP JSON-RPC Control Server]
    end

    subgraph Engine_Layer [コアエンジン層]
        Registry[Command Registry: 650+ Typed Commands]
        Session[Session / Undo-Redo / Crash Journal]
        TimeBase[Exact Integer Timebase: 254G ticks/sec]
    end

    subgraph Pipeline_Layer [レンダリング & DSP層]
        GPU[wgpu Linear Light Compositor: Metal/Vulkan/DX12/WebGPU]
        DSP[Audio DSP: BS.1770 / EBU R128 Loudness / Mixdown]
        Color[Lumetri-Style 32-bit Float Pipeline]
    end

    subgraph Pure_Rust_Codecs [完全独自 Rust コーデック層]
        Dec[Decoders: H.264 / HEVC / ProRes / VP9 / AV1 / AAC]
        Enc[Encoders: H.264 / ProRes 422HQ / DNxHR / AAC]
        Mux[Demux/Mux: ISOBMFF MP4 / MOV / Matroska]
    end

    UI --> Registry
    Web --> Registry
    CLI --> Registry
    MCP --> Registry
    Socket --> Registry

    Registry --> Session
    Session --> TimeBase
    Session --> Pipeline_Layer
    
    Pipeline_Layer --> Pure_Rust_Codecs
    Pure_Rust_Codecs --> Storage[(Disk / Export File)]
```

## 競合ツール/商用SaaSとの徹底比較

| 機能・指標 | Adobe Premiere Pro | FFmpeg (CLI/スクリプト) | FilmCraft (本作) |
|---|---|---|---|
| **コア言語** | C++ | C / ASM | **Pure Rust** |
| **ライセンス** | 商用プロプライエタリ (月額サブスク) | LGPL / GPL | **Apache 2.0 / MIT** |
| **AIエージェント操作 (MCP)** | 非対応 (プラグイン開発が必要) | 非対応 (CLIパラメータ生成のみ) | **公式標準対応 (MCP Server内蔵)** |
| **タイムラインUI** | 業界標準 (高機能) | なし (CLIのみ) | **Premiere互換 UI (egui/Wasm)** |
| **外部依存性** | 重厚なランタイム必須 | 多数のCライブラリ依存 | **ゼロ依存 (Self-contained)** |
| **時間精度** | 高精度 | 浮動小数点計算による丸め誤差リスク | **完全整数演算 (2540億ticks/秒)** |
| **WebAssembly実行** | 不可 | 一部可能だが重厚 (ffmpeg.wasm) | **ネイティブ対応 (Wasmビルド公式提供)** |

## 💡 ビジネス・マネタイズ活用アイデア（実践例）

1. **AI動画自動生成・広告量産パイプラインの受託開発**:
   ECサイトの商品データやプロンプトから、ClaudeがMCP経由でFilmCraftを駆動。字幕、テロップ、BGMダッキング、カラーコレクションを自動調整した縦型動画（Reels/TikTok/Shorts）をヘッドレスサーバー上で1日数万本バッチ生成するバックエンド基盤を企業へ提供。
2. **インフラコストゼロのブラウザ完結型動画編集SaaS**:
   WebAssemblyバイナリを活用し、クライアントPCのブラウザ（WebGPU）上でレンダリングが完結する社内向け動画編集ツールを構築。高額なAWS EC2/GPUインスタンスコストを完全に排除した高粗利SaaSを展開。
3. **放送局・制作会社向けコンプライアンス自動修正ゲートウェイ**:
   ITU-R BS.1770 / EBU R128準拠のラウドネス正規化処理と自動モザイク・テロップ差し替えを、AAF/EDL連携を交えて完全自動化するオンプレミスDXシステムを受託導入。

## インストール & クイックスタート手順

### 1. 必要環境の準備
Rustツールチェーン（MSRV最新安定版）がインストールされていることを確認します。

### 2. リポジトリのクローンとデスクトップアプリの起動
```bash
git clone https://github.com/storytold/filmcraft.git
cd filmcraft

# デスクトップアプリをリリースビルドで起動
cargo run --release -p filmcraft
```

### 3. MCPサーバー / ヘッドレス制御モードの起動
AIエージェント（Claude Desktop等）から制御するためのMCPサーバーを起動する場合：
```bash
# ヘッドレスMCPサーバーの起動
cargo run --release -p filmcraft-cli -- mcp

# またはTCP経由のJSON制御サーバーをポート9876で起動
cargo run --release -p filmcraft -- --control 9876
```

### 4. コマンドラインからの全機能確認
```bash
cargo run --release -p filmcraft-cli -- commands
```

## 商用利用可否 & ライセンス考察

FilmCraftは **Apache License 2.0 および MIT License のデュアルライセンス** で公開されています。

- **商用利用**: 完全に許可されています。自社製プロプライエタリな商用製品やSaaSのバックエンドに組み込んで有償提供することが法的に可能です。
- **改変と再配布**: ソースコードの改変やバイナリ配布が自由です。著作権表示およびライセンス通知を保持する義務があります。
- **特許権**: Apache 2.0に基づき、コントリビューターからの明示的な特許ライセンス供与が含まれています。
- **コーデック特許の注意点**: ソフトウェアのライセンス自体はオープンですが、H.264やHEVC等の商用エンコード/デコードを大規模に製品化する場合は、各コーデックの特許プール（MPEG LA / Via Licensing等）のライセンス条項に留意する必要があります。なお、ProResや非特許コーデック（VP9、AV1等）を中心としたワークフローを構築することで特許リスクを極小化できます。

---

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・競合比較・ライセンス考察の全文 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/filmcraft/)
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表・公式READMEに基づく導入手順 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)
