---
layout: "../../layouts/Layout.astro"
title: "universal-modder - README の要点（原文）"
description: "rehan-remade/universal-modder の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-15"
updatedDate: "2026-10-22"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/rehan-remade/universal-modder"
repoCreatedAt: "2026-09-30"
stars: 7929
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# universal-modder: 概要

rehan-remade/universal-modder は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 7,929 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Skills, tools and a shared knowledge base that let any AI coding agent mod almost any PC game you own.
- 原文（README）: Each gets the same skills (Agent Skills format), the fal MCP server, and the um CLI.
- 原文（README）: You also need Git, Python 3.10+ and ffmpeg. uv is recommended.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Inside a clone, each agent finds the skills where it looks for them: .agents/skills (Codex, Gemini CLI, Copilot, Cursor, OpenCode) and .claude/skills (Claude Code) are copies of skills/.
- 原文（README）: For assets, get a fal API key. It powers both the fal MCP server and um fal.
- 原文（README）: Blender is needed for 3D → sprite renders.
- 原文（README）: Windows games are driven natively or from WSL.
- 原文（README）: The agent starts with the mod-any-game skill and runs the same loop every time:

## インストール（README からの転記）

以下は [README](https://github.com/rehan-remade/universal-modder#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
uv tool install git+https://github.com/rehan-remade/universal-modder     # or: pipx install git+...
```

```bash
um fal key set                                                   # hidden prompt
export FAL_KEY="$(secret-tool lookup service fal.ai key api)"    # Linux: before starting the agent
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/rehan-remade/universal-modder/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
