---
layout: "../../layouts/Layout.astro"
title: "rea - README の要点（原文）"
description: "morluto/rea の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-22"
updatedDate: "2026-10-22"
tags: ["TypeScript","OSS","GitHub"]
repoUrl: "https://github.com/morluto/rea"
repoCreatedAt: "2026-04-14"
stars: 354932
generator_model: "gemini-2.5-flash"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# rea: 概要

morluto/rea は 2026-04-14 に GitHub で作成されたリポジトリです。2026-10-22 時点のスター数は 354,932 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: One MCP for reverse engineering across binaries, applications, and runtime behavior.
- 原文（README）: REA connects your agent to tools for inspecting native binaries, JavaScript and Electron apps, .NET assemblies, and websites.
- 原文（README）: Analysis runs locally, and results include the evidence and limitations behind each conclusion.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: It can inspect the app without its source code, explain how the feature works, show the evidence, and build a version for your project.
- 原文（README）: Native analysis can use an existing Hopper, Ghidra, or IDA installation; setup can optionally install Hopper with approval.
- 原文（README）: Static JavaScript analysis needs no native analysis engine.
- 原文（README）: Setup adds REA's MCP server and matching workflow instructions, with backups of existing configuration.
- 原文（README）: MCP uses compact input schemas by default to reduce context overhead.

## インストール（README からの転記）

以下は [README](https://github.com/morluto/rea#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
npx rea-agents setup
```

```text
Understand how search works in the Notes app, show me the evidence, and build a
similar feature for my project.
```

```bash
npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json
```

```bash
npm install --global rea-agents
rea --help
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/morluto/rea/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
