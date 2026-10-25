---
layout: "../../layouts/Layout.astro"
title: "Strata - README の要点（原文）"
description: "Niko1221/Strata の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-10"
updatedDate: "2026-10-22"
tags: ["C++","OSS","GitHub"]
repoUrl: "https://github.com/Niko1221/Strata"
repoCreatedAt: "2026-09-25"
stars: 19544
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# Strata: 概要

Niko1221/Strata は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 19,544 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Strata runs Qwen3.8-Flash-Next, a 125-billion-parameter model that normally needs a server, on a normal PC.
- 原文（README）: Your chats and files stay on your PC.
- 原文（README）: It speaks the OpenAI and Anthropic APIs, so Claude Code, Codex CLI, OpenCode and other agents connect to it.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: You need at least 32 GB of RAM and graphics memory (VRAM) together. On a Mac or a Ryzen AI Max, that is the unified memory.
- 原文（README）: Two or three cards of the same make can share a model (multi-GPU). Strata never splits a model across NVIDIA and AMD cards.
- 原文（README）: The app has the engine inside: install it, pick a model, chat.
- 原文（README）: What Strata downloads, when it uses the internet and how it checks downloads is in docs/SAFETY.md.

## インストール（README からの転記）

以下は [README](https://github.com/Niko1221/Strata#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
curl -fsSL https://github.com/Niko1221/Strata/releases/latest/download/install.sh | sh
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```powershell
irm https://github.com/Niko1221/Strata/releases/latest/download/install.ps1 | iex
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```sh
strata launch
```

```sh
strata launch --model q2_0 --yes --no-tui
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/Niko1221/Strata/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
