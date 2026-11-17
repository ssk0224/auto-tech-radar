---
layout: "../../layouts/Layout.astro"
title: "rea-video - README の要点（原文）"
description: "JuneYaooo/rea-video の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-11-17"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/JuneYaooo/rea-video"
repoCreatedAt: "2026-10-30"
stars: 9768
generator_model: "gemini-3.5-flash"
---

# rea-video: 概要

JuneYaooo/rea-video は 2026-10-30 に GitHub で作成されたリポジトリです。2026-11-17 時点のスター数は 9,768 です。Radar Ledger の記録では、直近 7 日間の増加数は 4,107 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Reverse-engineer any video.
- 原文（README）: Shot by shot: was it filmed, AI-generated or coded, and how to remake it.
- 原文（README）: Every breakdown is written in **[VIDEO.md](https://videomd.github.io/videomd/)**, an open format that agents read layer by layer.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Each one gives you two outputs:
- 原文（README）: **Report** (`report.html` / PDF), for you: more reader-friendly, with a clearer structure, easier to learn from and to understand how the video was made and how to remake it.
- 原文（README）: **[VIDEO.md](https://videomd.github.io/videomd/)**, for your AI: layered, so the AI reads only what a question needs and uses fewer tokens.
- 原文（README）: You can also hook up a video-capable model (Gemini or Doubao both work) by giving the agent its endpoint and key.
- 原文（README）: After rea-video breaks a video down, the remake recipe in [capsule-cinema](https://github.com/JuneYaooo/capsule-cinema) generates a new version that keeps the original's camera, motion, pacing and transitions and swaps only the elements you pick.

## インストール（README からの転記）

以下は [README](https://github.com/JuneYaooo/rea-video#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```text
Install https://github.com/JuneYaooo/rea-video, then break down this video: /path/to/video.mp4
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/JuneYaooo/rea-video/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
