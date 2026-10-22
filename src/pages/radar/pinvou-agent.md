---
layout: "../../layouts/Layout.astro"
title: "pinvou-agent - README の要点（原文）"
description: "Pinvou/pinvou-agent の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-09"
updatedDate: "2026-10-22"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/Pinvou/pinvou-agent"
repoCreatedAt: "2026-07-24"
stars: 2399
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# pinvou-agent: 概要

Pinvou/pinvou-agent は 2026-07-24 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 2,399 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: An open-source desktop AI agent workspace for work, design, and coding.
- 原文（README）: Use a local model for a fully private loop, connect any OpenAI-compatible endpoint, and extend the agent with MCP servers, CLI connectors, Skills, and workflows.
- 原文（README）: Whether data leaves your machine depends on the model and tools you enable. A local model with local tools stays fully local.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Use Codex, Claude Code, or Kimi through ACP in the same desktop workspace. The coding agent can read and edit a real project or an isolated temporary workspace, run commands, and surface plans, tool steps, permission requests, and file changes.
- 原文（README）: Artifact panel automatically collects every file the agent creates or edits; preview, locate, and open them in one place
- 原文（README）: Local knowledge base with file management, full-text and vector retrieval; attach multiple collections to one chat, enable or disable each independently, and retain collection and file provenance in answers
- 原文（README）: Remote control — scan a QR code from your phone to view and steer the running workspace
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
