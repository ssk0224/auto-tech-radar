---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-09"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/opensandbox-group/OpenSandbox"
repoCreatedAt: "2025-12-17"
stars: 15739
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "OpenSandbox - 自分のインフラ上のサンドボックスで AI エージェントを動かします"
description: "自分のインフラ上のサンドボックスで AI エージェントを動かします。"
---

# OpenSandbox: 概要

opensandbox-group/OpenSandbox は 2025-12-17 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 15,739 です。

- 自分のインフラ上のサンドボックスで AI エージェントを動かします。
  - 原文（README）: Run AI agents in sandboxes on your own infrastructure.
- OpenSandbox は、AI アプリケーションに、コードの実行・コマンドの実行・ファイルの管理・ブラウザやデスクトップの操作のための隔離された環境を与えます。
  - 原文（README）: OpenSandbox gives AI applications isolated environments to execute code, run commands, manage files, and operate browsers or desktops.
- Docker を使ってローカルで始め、統一されたサンドボックスの API で Kubernetes にデプロイします。
  - 原文（README）: Start locally with Docker and deploy on Kubernetes through a unified sandbox API.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- Firecracker のサンドボックスは、メモリとディスクの状態を保ったまま一時停止と再開ができます。
  - 原文（README）: Firecracker sandboxes support pause/resume with memory and disk state preserved.
- ネットワークのアクセス制御: 受信の通信は共通の ingress ゲートウェイを通し、送信はサンドボックスごとの egress ポリシーで制御します。
  - 原文（README）: Network access control / Route inbound traffic through a unified ingress gateway and control outbound access with per-sandbox egress policies.
- Credential Vault: 本物の認証情報をサンドボックス内の処理に見せずに、エージェントから外部のサービスを呼べます。
  - 原文（README）: Credential Vault / Let agents call external services without exposing real credentials to sandbox workloads.
- Python・Java/Kotlin・TypeScript/JavaScript・C#/.NET・Go の SDK があり、ターミナルからは osb を使い、エージェントは MCP でつなげます。
  - 原文（README）: SDKs, CLI, and MCP / Integrate with Python, Java/Kotlin, TypeScript/JavaScript, C#/.NET, or Go SDKs. Use osb from the terminal or connect agents through MCP.

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
