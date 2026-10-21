---
title: "【徹底解剖】海外急上昇OSS「universal-modder」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["python", "oss", "github", "architecture", "programming"]
published: false
---

# universal-modder: 概要と革新性

`universal-modder`（GitHubスター数7,900超）は、Claude Code、Codex、Cursor、Gemini CLIなどのLLMコーディングエージェントに対して、**PCゲームのリバースエンジニアリング、コード生成、生成AIアセット作成、ゲーム内実機テスト、紹介動画作成**までの一連のMod開発パイプラインを統合実行させるオープンソースの自律型エージェント環境です。

従来、ゲームMod制作はアセンブリ解析、バイナリパッチ、ゲームエンジン固有の非公開データ構造調査、ピクセルアートや3Dモデル制作など、高度かつ多分野にわたる職人芸を要求されてきました。`universal-modder`は、Agent Skills仕様に準拠したツールチェーン、専用CLI（`um`）、fal.aiと連携するMCP（Model Context Protocol）サーバー、そして過去の解析知見を蓄積する自律型ナレッジベース（KB）を組み合わせることで、**「ゲームのパスとModの要件を自然言語で渡すだけで、AIが実バイナリを調査し、稼働するModを実装・検証する」**という異次元の開発体験を実現しています。

---

## 解決する主要な課題とアーキテクチャ

ゲームMod開発やレガシーバイナリのカスタマイズにおいて、エンジニアは以下の重大なボトルネックに直面していました。

1. **極度の文脈断片化**: ゲームエンジンの特定（Unity/Unreal/.NET/C++）、ローダー選定（BepInEx, Harmony, Fabric等）、逆コンパイルコードの解読という前工程の工数が膨大。
2. **クリエイティブアセットの調達コスト**: スプライト、3Dモデル、BGM/SFXの制作に別個のツールとスキルが必要。
3. **インゲーム検証のフィードバックループ欠如**: AIがコードを生成しても、実ゲーム内でクラッシュせず意図通り動くかを自律的にテストできない。

`universal-modder`は、これらを**3層マルチエージェント構造**と**OSレベルの低レイヤー自動化パイプライン**によって解決します。

```mermaid
graph TD
    User([開発者 / オペレーター]) -->|プロンプト・要件定義| Orchestrator["mod-orchestrator<br>監督エージェント"]
    
    subgraph "universal-modder コアアーキテクチャ"
        Orchestrator -->|タスク指示 & ログ照合| OfflineWorker["mod-offline-worker<br>設計・解析・スタブ検証"]
        Orchestrator -->|実行指示| GameWorker["mod-game-worker<br>実機ビルド・インジェクト・実機検証"]
        
        OfflineWorker -->|検索・知見共有| KB[(Knowledge Base<br>AI written field notes)]
        OfflineWorker -->|アセット生成| FalMCP[fal.ai MCP / ComfyUI<br>2D/3D/SFX/PBR]
        
        GameWorker -->|逆コンパイル・解析| RE[ILSpy / Cpp2IL / Ghidra / Frida]
        GameWorker -->|GUI制御・キャプチャ| WinDrive[um win<br>低遅延入力 / 画面録画 / 音声ループバック]
        GameWorker -->|ビルド & 配布| Loader[ゲームエンジン / Modローダー]
    end
    
    Loader --> TargetGame[(対象PCゲーム)]
    TargetGame -.->|フレームバッファ / 状態| WinDrive
```

### アーキテクチャの3大中核
1. **監督・分業型サブエージェント（Multi-Agent Roles）**
   - `mod-orchestrator`: 全体計画立案、各ワーカーの報告内容と実ログの監査、進行管理。
   - `mod-offline-worker`: 実機を汚さず、逆コンパイル結果の解析、SDK調査、パッチ設計、アセット生成を実施。
   - `mod-game-worker`: ゲームプロセスへのMod投入、実機プロセスメモリのプローブ計測、クラッシュログ解析を専任。
2. **OS/ゲーム自動化エンジン（`um win` CLI）**
   - DirectInput/RawInputをエミュレートし、バックグラウンドでも対象ゲームウィンドウのみに安全にキーストローク・マウス操作を送信。
   - プロセス単位のDirectX/Vulkanフレームキャプチャおよびオーディオループバック録音を行い、AIが目視・聴覚で挙動を検証。
3. **AI間ナレッジ蓄積ループ（Self-Updating Knowledge Base）**
   - 解決困難なエンジン固有の落とし穴（例: 特定バージョンのアンチチート挙動、メモリレイアウト）をMarkdown形式のフィールドノートとして自動生成。次世代のセッションへフィードバックされるエコシステムを形成。

---

## 競合ツール/商用SaaSとの徹底比較

| 評価軸 | universal-modder (OSS) | 従来のMod制作ツール群 (Vortex/ModOrganizer) | 一般的なAIコーディング (Cursor/Copilot単体) |
|---|---|---|---|
| **対象レイヤー** | 調査・バイナリ解析〜コード〜アセット〜実機QA | パッケージ配置・競合管理のみ | コード生成・補完のみ |
| **リバースエンジニアリング連携** | ILSpy / Ghidra / Cpp2IL をMCP/CLI経由で自律駆動 | なし（人間が外部ツールで実施） | なし（バイナリ入力不可） |
| **マルチモーダルアセット生成** | fal.ai / ComfyUI連携で2Dスプライト・3D・音声を一括生成 | なし | テキストのみ（外部SaaS手動併用） |
| **実機フィードバック検証** | OSレベルのプロセス制御・画面キャプチャによる自律QA | なし | なし |
| **知見の永続化** | AIがAIのために書くKB（Pull Request自動起票） | 人間向けフォーラム/Wiki | 会話コンテキスト終了で揮発 |
| **導入コスト** | 完全無料（MITライセンス / API実費のみ） | 無料 | 月額サブスクリプション |

---

## 💡 ビジネス・マネタイズ活用アイデア（実践例）

`universal-modder`の技術スタックは、ゲームModの枠を越え、産業用ソフトウェアのリバースエンジニアリングや自律型QAエージェント事業へと直結します。

### 1. レガシーデスクトップアプリのモダナイゼーション受託
- **ターゲット**: ソースコードを喪失した古いWindows業務用システム（VB6、Delphi、C++ MFC）を運用している企業。
- **提供価値**: `universal-modder`のリバースエンジニアリング自動化パイプラインを活用し、バイナリ解析からAPIフック、モダンWebフロントエンドへのデータバイパス（DLLインジェクション型プロキシ）を短期間で構築。

### 2. インディーゲーム向け自律型QA・回帰テスト自動化SaaS
- **概要**: ビルドバイナリをアップロードするだけで、AIエージェントがゲームを自律起動し、探索・操作を行ってクラッシュや描画破綻を検出、修正パッチ候補とともに動画レポートを納品するマイクロSaaS。
- **収益モデル**: 月額3万円〜15万円のステージ課金制。

### 3. ゲームIPホルダー公認の「UGC/Mod制作支援プラットフォーム」OEM提供
- **概要**: ゲーム開発会社向けに、ファンコミュニティが安全かつ手軽に新規コンテンツ（マップ、アイテム、NPC）をAI生成して配布できるサンドボックス基盤を提供。

---

## インストール & クイックスタート手順

### 必要要件
- OS: Windows 10/11（WSL2経由またはNative PowerShell）
- Python 3.10以上, Git, ffmpeg, uv（推奨）
- 3Dレンダリング用: Blender（パスを通しておくこと）
- fal.ai APIキー（アセット自動生成を行う場合）

### 1. インストール
Claude Codeまたは他エージェントにプラグインとして導入、または`uv`でCLIをセットアップします。

```bash
# 推奨: uvツール経由でum CLIをグローバルインストール
uv tool install git+https://github.com/rehan-remade/universal-modder

# または Claude Code に直接プラグイン登録
/plugin marketplace add rehan-remade/universal-modder
/plugin install universal-modder@universal-modder
```

### 2. APIキーの設定
fal.aiのAPIキーをセキュアストレージに登録します。

```bash
um fal key set
# プロンプトに従い API Key を入力
```

### 3. クイック実行（対象ゲームの調査からMod生成まで）
エージェント（Claude Code等）を起動し、対象ディレクトリを指定して要件を伝えます。

```bash
# 対象ゲームのフィンガープリント調査（CLI単体実行例）
um scan "C:\Games\Terraria"

# Claude Code へのプロンプト例:
# 「Terrariaに新しい追尾型ロケットランチャーを追加して。スプライトはfalで自動生成し、実機テストまで完了させて。」
```

---

## 商用利用可否 & ライセンス考察

- **ライセンス**: **MIT License**
- **商用利用**: ソースコードの改変、再配布、商用SaaSのバックエンドへの組み込みが法的に無償で許諾されています。
- **コンプライアンス上の必須遵守事項**:
  1. **アンチチート/オンライン対戦**: 規約上、オンライン対戦ゲームのバイパスやチートツール開発をプロンプト・コードレベルで明示的にブロック（セーフティガイドラインに準拠）。
  2. **著作権法遵守**: ゲーム本体のバイナリや逆コンパイルされた生コードを再配布せず、パッチ（差分ファイル）または独自アセットのみを出力する設計を維持すること。

## 📖 続きと実務キットについて
本記事は Auto Tech Radar の無料解説の抜粋です。

- 📖 **無料**: アーキテクチャ・競合比較・ライセンス考察の全文 → [Auto Tech Radar で読む](https://ssk0224.github.io/auto-tech-radar/radar/universal-modder/)
- 🔒 **有料（note）**: 導入提案書テンプレート・工数見積表・公式READMEに基づく導入手順 → [note の有料記事・メンバーシップ](https://note.com/vast_ixora7005/membership)

