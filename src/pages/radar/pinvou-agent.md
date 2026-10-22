---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-09"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/Pinvou/pinvou-agent"
repoCreatedAt: "2026-07-24"
stars: 2399
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "pinvou-agent - 仕事・デザイン・コーディングのための、オープンソースのデスクトップ AI エージェントのワークスペースです"
description: "仕事・デザイン・コーディングのための、オープンソースのデスクトップ AI エージェントのワークスペースです。"
---

# pinvou-agent: 概要

Pinvou/pinvou-agent は 2026-07-24 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 2,399 です。

- 仕事・デザイン・コーディングのための、オープンソースのデスクトップ AI エージェントのワークスペースです。
  - 原文（README）: An open-source desktop AI agent workspace for work, design, and coding.
- ローカルのモデルを使えば外部に出さずに完結でき、OpenAI 互換のエンドポイントにも接続でき、MCP サーバー・CLI コネクター・Skills・ワークフローでエージェントを拡張できます。
  - 原文（README）: Use a local model for a fully private loop, connect any OpenAI-compatible endpoint, and extend the agent with MCP servers, CLI connectors, Skills, and workflows.
- データが手元の機器から出るかどうかは、有効にしたモデルとツールによります。ローカルのモデルとローカルのツールだけなら、すべてローカルで完結します。
  - 原文（README）: Whether data leaves your machine depends on the model and tools you enable. A local model with local tools stays fully local.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 同じデスクトップのワークスペースで、ACP を通じて Codex・Claude Code・Kimi を使えます。コーディングエージェントは実際のプロジェクトや隔離された一時的なワークスペースを読み書きし、コマンドを実行できます。
  - 原文（README）: Use Codex, Claude Code, or Kimi through ACP in the same desktop workspace. The coding agent can read and edit a real project or an isolated temporary workspace, run commands, and surface plans, tool steps, permission requests, and file changes.
- Artifact パネルは、エージェントが作成・編集したファイルを自動で集め、1 か所で確認・検索・オープンできます。
  - 原文（README）: Artifact panel automatically collects every file the agent creates or edits; preview, locate, and open them in one place
- ローカルのナレッジベースはファイル管理・全文検索・ベクトル検索に対応し、1 つのチャットに複数のコレクションを付けられます。
  - 原文（README）: Local knowledge base with file management, full-text and vector retrieval; attach multiple collections to one chat, enable or disable each independently, and retain collection and file provenance in answers
- リモート操作: スマートフォンで QR コードを読み取り、動いているワークスペースを確認・操作できます。
  - 原文（README）: Remote control — scan a QR code from your phone to view and steer the running workspace
- セッション・設定・ナレッジ・ランタイムの拡張は、すべて ~/.pinvou3/ に保存されます。
  - 原文（README）: Sessions, settings, knowledge, and runtime extensions all live under ~/.pinvou3/

## インストール（README からの転記）

以下は [README](https://github.com/Pinvou/pinvou-agent#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
git clone --recursive https://github.com/Pinvou/pinvou-agent.git
cd pinvou-agent/pinvou3-app
npm ci
cd ..
./pinvou3-app/run-dev.sh
```

```bash
git submodule update --init --recursive
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/Pinvou/pinvou-agent/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
