import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const radarDir = path.resolve(__dirname, '..', 'src', 'pages', 'radar');

// Mermaid図解とマネタイズセクションの補完データマップ
const enrichmentData = {
  'answer-me-with-html': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    User["ユーザー質問"] --> LLM["LLM (Claude / GPT / Gemini)"]
    LLM --> AMWH["answer-me-with-html 変換エンジン"]
    AMWH --> Template["Tailwind / CSS コンポーネント"]
    Template --> SingleHTML["単一HTMLカード出力 (図解・表組・視覚化)"]
    SingleHTML --> View["ブラウザ / レポート即時描画 (トークン87%削減)"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 社内AIレポート自動生成基盤（受託開発: 80万〜180万円）
LLMのテキスト出力をそのまま表示するのではなく、1枚の美しいHTML/PDFに即時変換して経営陣に納品する自動化基盤をクライアント企業向けに構築。
### 2. マイクロSaaS「HTMLカード生成API」
月額課金でMarkdownやプロンプトからリッチなインフォグラフィックHTMLを返すHeadlessサービスを展開。
`
  },
  'crates-io-index': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    Cargo["Cargo CLI"] --> GitIndex["crates.io-index (Git / Sparse)"]
    GitIndex --> Mirror["ローカル / 社内ミラーキャッシュ"]
    Mirror --> RustBuild["高速ビルド環境 (CI/CD ＆ オンプレミス)"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. セキュアRust社内ミラー基盤構築（受託: 100万〜200万円）
外部通信が制限された金融・車載・組込み開発向けに、crates.ioのセルフホスト完全同期ミラーと依存脆弱性検知システムを導入。
`
  },
  'dsh-tavern': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    Browser["Web UI"] --> Server["dsh-tavern Core"]
    Server --> LLM["ローカル推論 (vLLM / Ollama / API)"]
    Server --> State["キャラクター状態・コンテキストメモリ"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 特化型AIペルソナ接客エージェント（受託: 120万〜250万円）
自治体やECサイト向けに、専属AIキャラクターによる多言語接客・24時間Q&A自動化基盤をセルフホストで納品。
`
  },
  'gptqmodel': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    FullModel["FP16 / BF16 重みモデル"] --> GPTQ["GPTQModel 量子化パイプライン"]
    GPTQ --> Calibration["キャリブレーションデータセット評価"]
    Calibration --> INT4["INT4 / INT8 高圧縮モデル"]
    INT4 --> VRAM["GPUメモリ消費 75% 削減 / 超高速推論"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. エンタープライズLLM軽量化コンサルティング（受託: 120万〜280万円）
オンプレGPUクラスタのメモリ枯渇に悩む企業に対し、商用モデルを精度維持したままINT4量子化し、インフラコストを半減。
`
  },
  'homebrew-cask': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    Brew["brew install --cask"] --> CaskRepo["homebrew-cask リポジトリ"]
    CaskRepo --> RubyRubyDSL["Ruby Cask DSL 解析"]
    RubyRubyDSL --> Binary["macOS GUI App (.dmg / .pkg / .app)"]
    Binary --> Install["自動展開 ＆ /Applications 配置"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. macOSエンタープライズゼロタッチキッティング自動化（受託: 80万〜150万円）
情シス部門向けに、社員のMac端末初期設定をHomebrew CaskとMDMを連携させて1コマンドで完全自動配備するスクリプトパッケージを納品。
`
  },
  'homebrew-core': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    CLI["brew install <formula>"] --> Formula["Formula Ruby定義"]
    Formula --> Bottle["ビルド済みバイナリ (Bottles)"]
    Bottle --> Target["/opt/homebrew または /usr/local 配置"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 企業向けプライベートHomebrew Tap基盤構築（受託: 80万〜160万円）
社内独自CLIツールやセキュリティパッチを全社Mac環境へ安全・自動配信する社内専用TapとCI/CDパイプラインを構築。
`
  },
  'internships-2027': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    Scraper["GitHub API / 自動巡回ボット"] --> Repo["internships-2027 リポジトリ"]
    Repo --> Markdown["マークダウン一覧表自動更新"]
    Markdown --> JobSeeker["グローバルテック就活生 / エンジニア"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. テック採用マッチング特化型マイクロSaaS（月額サブスク）
グローバルITインターン情報をリアルタイムスクレイピングし、Discord/Slackへの新着通知と応募管理ダッシュボードを有料提供。
`
  },
  'jiuwenswarm': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    Task["大タスク / ゴール"] --> Orchestrator["JiuwenSwarm スウォーム司令塔"]
    Orchestrator --> AgentA["調査エージェント"]
    Orchestrator --> AgentB["コード生成エージェント"]
    Orchestrator --> AgentC["テスト＆監査エージェント"]
    AgentA & AgentB & AgentC --> Memory["共有スウォームメモリ"]
    Memory --> Result["高精度な最終納品物自動生成"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 自律型マルチエージェント業務自動化基盤（受託: 150万〜350万円）
複数AIが協調動作してリサーチ・執筆・検証を完全自律で行う社内業務システムを大企業DX部門へ納品。
`
  },
  'md3music': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    Flutter["Material Design 3 UI"] --> Player["オーディオ再生コア"]
    Player --> Cache["オフラインキャッシュ / メタデータ"]
    Cache --> Device["Android / iOS / Desktop 再生"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. BGM・音声コンテンツ配信アプリ開発（受託: 100万〜220万円）
ブランド独自のMaterial You対応オーディオストリーミングアプリやポッドキャストプレイヤーを短納期で受託開発。
`
  },
  'mediawiki': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    User["Webブラウザ"] --> PHP["MediaWiki PHP Core"]
    PHP --> Parser["Wikitext パーサー"]
    PHP --> DB[(MySQL / MariaDB / PostgreSQL)]
    PHP --> Cache["Memcached / Redis キャッシュ"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 社内セキュアナレッジ基盤リプレイス（受託: 120万〜250万円）
大手企業の分散したマニュアル・仕様書をMediaWikiベースのセルフホストWiki＋社内AI検索連携基盤へ統合移行。
`
  },
  'nixpkgs': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    NixExpr["Nix式定義 (.nix)"] --> NixStore["/nix/store ハッシュ分離"]
    NixStore --> Isolation["依存関係の完全再現性"]
    Isolation --> Env["開発環境 / 本番サーバー展開"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. 開発環境の完全再現性保証・DevOpsコンサル（受託: 100万〜250万円）
「自分の環境では動くが本番で動かない」問題をゼロにする、Nix/Devboxを活用した企業向け再現可能開発基盤を設計・導入。
`
  },
  'opensandbox': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    UntrustedCode["AI生成コード / 外部実行スクリプト"] --> Manager["OpenSandbox デーモン"]
    Manager --> Cgroup["Linux Namespace / Cgroups / seccomp"]
    Cgroup --> MicroVM["ミリ秒単位の軽量セキュア隔離環境"]
    MicroVM --> CleanReturn["安全な実行結果のみ返却"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. AIエージェントセキュア実行サンドボックス構築（受託: 120万〜300万円）
AIエージェントに自動シェル実行やコードテストを許可する際、ホストOSを100%破壊から保護するエンタープライズ隔離実行環境を構築納品。
`
  },
  'potatotool': {
    mermaid: `
\`\`\`mermaid
flowchart LR
    Network["トラフィック / アプリケーション入力"] --> Core["PotatoTool 解析コア"]
    Core --> Crypto["暗号解読モジュール"]
    Core --> Detection["悪意あるスクリプト自動検知"]
    Detection --> AuditReport["脆弱性診断レポート自動生成"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. セキュリティ脆弱性自動診断パッケージ（受託: 80万〜200万円）
企業の社内WebサービスやAPIの通信プロトコルを精査し、暗号設定不備やインジェクション脆弱性をレポート化する診断サービスを提供。
`
  },
  'tokenspeed': {
    mermaid: `
\`\`\`mermaid
flowchart TD
    Client["Agent Client / API Request"] --> SMG["SMG AsyncLLM Entrypoint"]
    subgraph ControlPlane["C++ Control Plane (FSM)"]
        FSM["Lifecycle & KV Ownership Manager"]
    end
    subgraph ExecPlane["Python Execution Plane"]
        Runtime["Inference Engine Runtime"]
        Kernels["Modular Layered Kernels (MLA on Blackwell)"]
    end
    SMG --> ControlPlane
    ControlPlane --> ExecPlane
    ExecPlane --> Hardware["NVIDIA Blackwell / AMD ROCm GPU"]
\`\`\`
`,
    monetization: `
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
### 1. ローカルLLM推論高速化・GPUコスト削減支援（受託: 100万〜250万円）
既存のvLLM/TensorRT環境をTokenSpeedへ移行・チューニングし、APIコスト削減とエージェント応答速度の2〜3倍高速化を実現。
`
  }
};

let enrichedCount = 0;

for (const [slug, data] of Object.entries(enrichmentData)) {
  const filePath = path.join(radarDir, `${slug}.md`);
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Mermaid追加
  if (!content.includes('```mermaid') && data.mermaid) {
    if (content.includes('## 解決する主要な課題とアーキテクチャ')) {
      content = content.replace(
        '## 解決する主要な課題とアーキテクチャ',
        `## 解決する主要な課題とアーキテクチャ\n${data.mermaid.trim()}\n`
      );
      modified = true;
    } else {
      content += `\n\n## アーキテクチャ図解\n${data.mermaid.trim()}\n`;
      modified = true;
    }
  }

  // マネタイズ追加
  if (!content.includes('ビジネス') && !content.includes('受託') && !content.includes('マネタイズ') && data.monetization) {
    content += `\n\n${data.monetization.trim()}\n`;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ 品質補完完了: ${slug}.md`);
    enrichedCount++;
  }
}

console.log(`\n全 ${enrichedCount} ファイルの品質補完が完了しました！`);
