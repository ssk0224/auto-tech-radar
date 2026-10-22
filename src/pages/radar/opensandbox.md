---
layout: "../../layouts/Layout.astro"
title: "OpenSandbox - Secure, Fast, and Extensible Sandbox runtime for AI agents."
description: "Secure, Fast, and Extensible Sandbox runtime for AI agents."
pubDate: "2026-10-09"
tags: ["Python", "OSS", "GitHub"]
repoUrl: "https://github.com/opensandbox-group/OpenSandbox"
repoCreatedAt: "2025-12-17"
stars: 15739
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# OpenSandbox: 概要

opensandbox-group/OpenSandbox は 2025-12-17 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 15,739 です。

OpenSandboxは、AIエージェント向けに設計された、セキュア、高速、かつ拡張可能なサンドボックスランタイムです。AIアプリケーションがコード実行、コマンド実行、ファイル管理、ブラウザ/デスクトップ操作を隔離された環境で実行することを可能にします。Dockerでのローカル開発からKubernetesへのデプロイメントまで、統一されたサンドボックスAPIを通じてシームレスな運用を提供します。

本プロジェクトは、OpenSSF Best PracticesおよびCNCF Landscapeに掲載されており、その信頼性とコミュニティにおける重要性が示されています。

主要機能は以下の通りです。

*   **Fast Sandbox runtime**: Firecrackerベースの高速かつ高密度なサンドボックス実行環境。64 ms P50 (シリアル) / 125.4 ms P99 (10並行) の起動性能を誇り、メモリとディスク状態を保持した一時停止/再開をサポートします。
*   **Agent working environments**: エージェントがコード実行、コマンド実行、ファイル管理を行うための組み込みAPIを提供し、コーディングエージェント、ブラウザ、デスクトップのサンドボックス内実行を可能にします。
*   **Network access control**: 統一されたイングレスゲートウェイによるインバウンドトラフィックルーティングと、サンドボックスごとのエグレスポリシーによるアウトバウンドアクセス制御を実現します。
*   **Credential Vault**: エージェントが外部サービスを呼び出す際に、実際の認証情報をサンドボックスワークロードに公開することなく安全に利用できるメカニズムを提供します。
*   **Local to cluster**: Dockerでのローカル開発からKubernetesへのデプロイメントまで、統一されたライフサイクルAPIを提供。リソースプールとバッチ作成により、エージェント評価や強化学習（RL）トレーニングワークロードをサポートします。
*   **SDKs, CLI, and MCP**: Python, Java/Kotlin, TypeScript/JavaScript, C#/.NET, Go向けのSDK、ターミナルCLI (`osb`)、およびMCP を通じたエージェント接続をサポートします。
*   **Extensible sandbox protocol**: 定義されたサンドボックスライフサイクルおよび実行APIに基づき、カスタムランタイム統合を構築するための拡張性を提供します。

## 解決する主要な課題とアーキテクチャ
```mermaid
flowchart TD
    UntrustedCode["AI生成コード / 外部実行スクリプト"] --> Manager["OpenSandbox デーモン"]
    Manager --> Cgroup["Firecracker MicroVM / 隔離カーネル"]
    Cgroup --> MicroVM["ミリ秒単位の軽量セキュア隔離環境"]
    MicroVM --> CleanReturn["安全な実行結果のみ返却"]
```

### 従来の技術スタックにおける問題点

AIエージェントが自律的にコードを実行したり、外部リソースにアクセスしたりする際、以下の課題が顕在化します。

1.  **セキュリティリスク**: エージェントがホストシステムに直接アクセスしたり、機密情報を含む環境で実行されたりすると、悪意のあるコード実行や情報漏洩のリスクが高まります。特に、生成AIが生成したコードの安全性を保証することは困難です。
2.  **環境の分離と一貫性**: 複数のAIエージェントが同時に動作する場合、互いの環境に影響を与えたり、依存関係の競合が発生したりする可能性があります。また、エージェントの評価やトレーニングにおいて、毎回クリーンで一貫した環境を迅速にプロビジョニングすることが課題となります。
3.  **パフォーマンスとリソース効率**: 従来の仮想マシン（VM）は起動に時間がかかり、リソース消費も大きいため、多数のAIエージェントを並行して実行する際のボトルネックとなります。コンテナは軽量ですが、カーネル共有によるセキュリティ上の懸念が残ります。
4.  **資格情報の管理**: AIエージェントが外部APIやサービスを利用する際、APIキーや認証情報を安全に管理し、サンドボックス環境に漏洩させずに利用させるメカニズムが不足しています。
5.  **開発からデプロイメントへの移行**: ローカルでの開発環境と本番環境（特にKubernetesのような分散環境）でのサンドボックスの管理・運用に一貫性がなく、移行プロセスが複雑になりがちです。

### 本ツールが採用するアプローチと仕組み

OpenSandboxはこれらの課題に対し、以下の技術的アプローチとアーキテクチャで解決策を提供します。

1.  **マイクロVMベースのサンドボックス化 (Firecracker)**:
    *   AWSが開発した軽量仮想化技術であるFirecrackerを基盤とし、従来のVMよりもはるかに高速な起動（P50で64ms）と、コンテナよりも高いセキュリティ分離（カーネルレベルでの分離）を両立します。
    *   メモリとディスクの状態を保持したまま環境を一時停止・再開できるため、エージェント評価や強化学習における環境リセットのオーバーヘッドを大幅に削減します。
2.  **統一されたサンドボックスAPIと制御プレーン**:
    *   Dockerでのローカル開発環境からKubernetesクラスターへの大規模デプロイメントまで一貫したライフサイクルAPIを提供します。
3.  **厳格なネットワーク制御とCredential Vault**:
    *   エグレスポリシーによるアウトバウンド通信制御と、APIキーをサンドボックス内に直接露出させないCredential Vault機能により、機密情報の漏洩を防ぎます。

## インストール（README からの転記）

以下は [README](https://github.com/opensandbox-group/OpenSandbox#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
uvx opensandbox-server init-config ~/.sandbox.toml --example docker

uvx opensandbox-server

# Show help
# uvx opensandbox-server -h
```

```bash
uv pip install opensandbox
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/opensandbox-group/OpenSandbox/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
