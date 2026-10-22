---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-10"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/browser-use/jev-ultrafast"
repoCreatedAt: "2026-09-17"
stars: 22480
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "説明文の最上級の表現を削除し、機能の説明に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "jev-ultrafast - 動的でインデックスつきの行動空間を持つブラウザエージェントです"
description: "動的でインデックスつきの行動空間を持つブラウザエージェントです。"
---

# jev-ultrafast: 概要

browser-use/jev-ultrafast は 2026-09-17 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 22,480 です。

- 動的でインデックスつきの行動空間を持つブラウザエージェントです。
  - 原文（README）: A browser agent with a dynamic, indexed action space.
- TypeSafe の Jev が操作と要素を選び、操作が TYPE_TEXT のときだけ小さな LLM が文章を書きます。
  - 原文（README）: TypeSafe's Jev picks an operation and an element. A small LLM writes text only when the operation is TYPE_TEXT.
- ポリシーには、サイト専用の操作スクリプトや用意された入力文字列はありません。
  - 原文（README）: There are no site-specific action scripts or prepared field strings in the policy.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 操作は CLICK・TYPE_TEXT・SELECT・SCROLL_UP・SCROLL_DOWN・WAIT・DONE・BLOCKED です。
  - 原文（README）: The operations are CLICK, TYPE_TEXT, SELECT, SCROLL_UP, SCROLL_DOWN, WAIT, DONE, and BLOCKED.
- 2 つの判断を 1 回のネットワークの往復で行います。
  - 原文（README）: Two decisions, one network round trip.
- Chrome は uv sync で入る Browser Harness を通じて接続します。
  - 原文（README）: Chrome connects through Browser Harness, installed by uv sync.
- 既定のエージェントのループではスクリーンショットを使わず、Jev は構造化された状態を読みます。
  - 原文（README）: No screenshots in the default agent loop. Jev consumes structured state.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/browser-use/jev-ultrafast#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/browser-use/jev-ultrafast/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
