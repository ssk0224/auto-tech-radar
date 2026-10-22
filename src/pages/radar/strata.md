---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-10"
tags: ["C++","OSS","GitHub"]
repoUrl: "https://github.com/Niko1221/Strata"
repoCreatedAt: "2026-09-25"
stars: 19544
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "Strata - Strata は、通常はサーバーが必要なモデル Qwen3.8-Flash-Next（125-billion-parameter）を、一般的な PC で動かします"
description: "Strata は、通常はサーバーが必要なモデル Qwen3.8-Flash-Next（125-billion-parameter）を、一般的な PC で動かします。"
---

# Strata: 概要

Niko1221/Strata は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 19,544 です。

- Strata は、通常はサーバーが必要なモデル Qwen3.8-Flash-Next（125-billion-parameter）を、一般的な PC で動かします。
  - 原文（README）: Strata runs Qwen3.8-Flash-Next, a 125-billion-parameter model that normally needs a server, on a normal PC.
- チャットとファイルは手元の PC に残ります。
  - 原文（README）: Your chats and files stay on your PC.
- OpenAI と Anthropic の API を話すため、Claude Code・Codex CLI・OpenCode などのエージェントから接続できます。
  - 原文（README）: It speaks the OpenAI and Anthropic APIs, so Claude Code, Codex CLI, OpenCode and other agents connect to it.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- RAM とグラフィックスメモリ（VRAM）を合わせて 32 GB 以上が必要です。Mac や Ryzen AI Max では統合メモリがこれにあたります。
  - 原文（README）: You need at least 32 GB of RAM and graphics memory (VRAM) together. On a Mac or a Ryzen AI Max, that is the unified memory.
- 同じメーカーのカード 2〜3 枚でモデルを分担できます（multi-GPU）。NVIDIA と AMD のカードにまたがってモデルを分けることはしません。
  - 原文（README）: Two or three cards of the same make can share a model (multi-GPU). Strata never splits a model across NVIDIA and AMD cards.
- アプリにはエンジンが内蔵されており、インストールしてモデルを選べばチャットできます。
  - 原文（README）: The app has the engine inside: install it, pick a model, chat.
- Strata が何をダウンロードし、いつインターネットを使い、ダウンロードをどう検証するかは docs/SAFETY.md にあります。
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
