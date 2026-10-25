---
layout: "../../layouts/Layout.astro"
title: "AIHOT - README の要点（原文）"
description: "KKKKhazix/AIHOT の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-16"
updatedDate: "2026-10-22"
tags: ["TypeScript","OSS","GitHub"]
repoUrl: "https://github.com/KKKKhazix/AIHOT"
repoCreatedAt: "2026-09-29"
stars: 7887
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# AIHOT: 概要

KKKKhazix/AIHOT は 2026-09-29 に GitHub で作成されたリポジトリです。2026-10-16 時点のスター数は 7,887 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: 一个自己找热点、自己写日报的网站框架。
- 原文（README）: 它每天从一批信源里收资料,用大模型先筛一遍、再独立打两次分,挑出真正值得看的,写成中文标题和摘要;把不同来源说的同一件事聚成一个事件,按有多少人在说排出热点;每天早上出一份日报。
- 原文（README）: 这个仓库是它的引擎和框架:网站、后台、精选流程、聚簇和热度算法,所有提示词的原文和入选门槛,都在这里。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: 一条资料从信源进来,先判重,再预筛;可能重要的独立打两次分,写好中文标题和摘要,和别的报道聚成事件,算进热度。
- 原文（README）: 每一步的提示词都在 industry/prompts/,改标准不用改代码。
- 原文（README）: 热度按事件算,不按文章算:48 小时内,每个独立来源只算一次,24 小时减半。
- 原文（README）: 六种信源 / RSS、网页列表、JSON 接口、X 账号、微信公众号,以及你自己脚本推送进来的内容。
- 原文（README）: 给 Agent 用 / RSS(精选、全部、全文、日报、周报、月报)、公开 API、MCP、Agent Markdown、llms.txt,同一份内容给人看也给 Agent 用

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/KKKKhazix/AIHOT#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/KKKKhazix/AIHOT/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
