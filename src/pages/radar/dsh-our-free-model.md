---
layout: "../../layouts/Layout.astro"
title: "dsh-our-free-model - 最先端AIモデルを無料で無制限に利用！DeepSeek Harnessプラグインの革新性"
description: "DeepSeek Harness (dsh) のプラグイン「dsh-our-free-model」は、ログイン・登録・APIキー不要でDeepSeek V4.1 Flash、Kimi K3などの最先端AIモデルを無料で無制限に利用可能にします。README の記載をもとに解説します。"
pubDate: "2026-10-13"
tags: ["JavaScript", "OSS", "GitHub", "AI", "DeepSeek", "Kimi", "LLM"]
repoUrl: "https://github.com/Ebony-Vinyl/dsh-our-free-model"
repoCreatedAt: "2026-09-25"
stars: 12121
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "根拠のない価格比較の表現を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# dsh-our-free-model: 最先端AIモデルを無料で無制限に利用！DeepSeek Harnessプラグインの革新性

Ebony-Vinyl/dsh-our-free-model は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-13 時点のスター数は 12,121 です。

「dsh-our-free-model」は、DeepSeek Harness (dsh) のためのプラグインです。その最大の魅力は、**ログイン、登録、APIキーが一切不要**でありながら、DeepSeek V4.1 FlashやKimi K3といった**AIモデルを無料で利用できる**と README に記載されている点です。利用条件や提供の継続は上流のサービス次第のため、README を確認してください。

本プラグインは、dshのカーネルを一切変更せず、ビルドステップも不要、依存関係もゼロという極めて軽量な設計が特徴です。インストールするだけで即座に利用開始できる「開箱即用（Out-of-the-box）」の体験を提供します。

README に記載されている主な機能は以下の通りです。

*   **設定不要の即時利用:** アカウント、APIキー、配額申請が一切不要。
*   **透明性の高い上流ソース:** OpenCodeのZenゲートウェイやKilo AIの公共ゲートウェイを直接利用し、第三者の中継なし。
*   **リアルタイムなモデルリスト:** モデル集合、コンテキスト長、能力は上流から常に最新情報を取得。
*   **利用可能なモデルのみ表示:** 選択肢には実際に利用可能なモデルのみが提示され、ユーザー体験を最適化。
*   **高度なトークン削減機能:** ツール出力圧縮（RTK）、プロンプト軽量化、ローカル応答により、効率的なAI利用を実現。
*   **柔軟なルーティング（降級チェーン）:** 複数のモデルを組み合わせ、フォールバックやラウンドロビン戦略で最適なモデルを自動選択。
*   **OpenAI/Anthropic互換ローカルゲートウェイ:** 本機やLAN内の他のツールから、OpenAI/AnthropicのAPI形式でモデルを呼び出し可能。
*   **データプライバシーの確保:** 利用状況データ（トークン消費、速度など）は全てローカルに保存され、外部への送信は一切なし。
*   **多チャネル統合:** 13の無料利用チャネル（CodeArts, Kiloなど）と、76社のプロバイダーを統合管理する「聚合渠道」を搭載。
*   **アプリ内アップグレードとホットリロード:** アプリケーションを再起動することなく、プラグインの更新やコード変更を即座に適用。

## 解決する主要な課題とアーキテクチャ

「dsh-our-free-model」は、現代のAI活用における以下の主要な課題を解決します。

1.  **高額なAI利用料:** 商用AIサービスの従量課金モデルは、特に大規模な利用においてコストが膨大になる可能性があります。本プラグインは「無料・無制限」という選択肢を提供し、この課題を根本から解決します。
2.  **複数のAIモデル管理の煩雑さ:** 異なるプロバイダーのAIモデルを利用する際、それぞれ異なるAPI仕様や認証方法に対応する必要があります。本プラグインは「聚合渠道」機能により、76社ものプロバイダーを単一のインターフェースで統合管理し、この複雑さを解消します。
3.  **APIキー管理とセキュリティリスク:** APIキーの漏洩は深刻なセキュリティリスクに繋がります。本プラグインは主要な無料チャネルでAPIキーを不要とし、聚合渠道で利用するAPIキーもローカルの安全な場所に保存し、ページ上では指紋のみを表示することでリスクを最小化します。
4.  **データプライバシーへの懸念:** AIサービス利用時のプロンプトや生成結果、利用状況データが外部に送信されることへの懸念は少なくありません。本プラグインは利用状況データを全てローカルに保存し、データプライバシーを重視する企業や個人に安心を提供します。
5.  **モデルの可用性や性能のリアルタイム把握の難しさ:** モデルの可用性や応答速度は常に変動します。本プラグインはリアルタイムで上流から情報を取得し、利用可能なモデルのみを表示することで、常に最適なモデル選択を支援します。

### アーキテクチャ概要とデータフロー

本プラグインのアーキテクチャは、dshの柔軟なプラグインシステムを最大限に活用し、高度な機能と高い拡張性を実現しています。

```mermaid
graph TD
    A[ユーザー] --> B["DeepSeek Harness (dsh) UI/CLI"]
    B --> C[dsh-our-free-model プラグイン]

    subgraph PluginArchitecture ["プラグイン内部アーキテクチャ"]
        C -- リクエスト --> D["LlmAdapter (コア)"]
        D -- モデル選択/ルーティング --> E{モデルチャネル選択}
        E --> F["無料チャネル (OpenCode Zen Gateway)"]
        E --> G["Kiloチャネル (Kilo AI Public Gateway)"]
        E --> H["EACチャネル (DSHEAC AIO)"]
        E --> I["聚合渠道 (76プロバイダー統合)"]
        I -- APIキー管理/モデル検出 --> I1["ローカル設定ファイル (settings.json)"]
        E --> J["ルーティング (降級チェーン)"]
        J -- フォールバック/ラウンドロビン --> E

        D -- トークン削減 --> K[Token Saver]
        K --> K1["ツール出力圧縮 (RTK)"]
        K --> K2[プロンプト軽量化]
        K --> K3[ローカル応答]

        C -- 外部ツール連携 --> L[ローカルゲートウェイ]
        L -- OpenAI/Anthropic互換API --> T["外部ツール/アプリケーション"]

        C -- 監視/管理 --> M["用量看板 (データローカル保存)"]
        C -- 更新 --> N["アプリ内アップグレード/ホットリロード"]
    end

    F --> P[DeepSeek V4.1 Flash]
    G --> Q[Kimi K3]
    H --> R[EACモデル]
    I --> S["NVIDIA NIM, OpenRouter, Groq, Gemini, etc."]

    P --> U[AIモデルプロバイダー]
    Q --> U
    R --> U
    S --> U
```

**データフローの解説:**

1.  **ユーザーリクエスト:** ユーザーはdshのUIまたはCLIを通じてAIモデルにリクエストを送信します。
2.  **プラグインによる処理:** リクエストは「dsh-our-free-model」プラグインのLlmAdapterによって受け取られます。
3.  **トークン削減:** リクエストはまずToken Saverモジュールを通過し、ツール出力の圧縮、プロンプトの軽量化、またはローカル応答による処理が行われ、効率が最大化されます。
4.  **モデル選択とルーティング:** LlmAdapterは、ユーザーが選択したモデル、またはルーティング（降級チェーン）設定に基づいて、最適なAIモデルチャネル（無料チャネル、Kiloチャネル、EACチャネル、聚合渠道）を決定します。
5.  **AIモデルへの送信:** 選択されたチャネルを通じて、リクエストは対応するAIモデルプロバイダー（DeepSeek, Kimi, NVIDIA NIMなど）に送信されます。
6.  **応答の受信と処理:** AIモデルからの応答はプラグインに戻され、dshを通じてユーザーに提示されます。
7.  **ローカルゲートウェイ:** プラグインはOpenAI/Anthropic互換のローカルゲートウェイを提供し、dsh以外の外部ツールやアプリケーションがこれらのAIモデルにアクセスできるようにします。
8.  **用量看板:** 全てのAI利用状況データ（トークン消費、応答速度など）は、ユーザーのローカルマシンにのみ保存され、プライバシーが保護されます。
9.  **管理機能:** アプリ内アップグレード、ホットリロード、リアルタイム通知などの機能により、プラグインの運用と管理が容易になります。

## インストール（README からの転記）

以下は [README](https://github.com/Ebony-Vinyl/dsh-our-free-model#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```
dsh plugin --profile web add /绝对路径/dsh-our-free-model
```

```
PROFILE_UPGRADE_REQUIRED: offline dependency migration is not yet available
```

```
node -e "
const g = require('/sidecar/dist/lib/profile-upgrade.js');
const app = '', profile = '/profiles/';
console.log(g.planProfileUpgrade(app, profile));
g.assertProfileStartup(app, profile);
console.log('startup gate: PASS');
"
```

```
DSH_HOME= dsh --profile  --dump-config | grep our-free-model
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/Ebony-Vinyl/dsh-our-free-model/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
