---
layout: "../../layouts/Layout.astro"
title: "ZCode - README の要点（原文）"
description: "zai-org/ZCode の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-15"
updatedDate: "2026-10-22"
tags: ["TypeScript","OSS","GitHub"]
repoUrl: "https://github.com/zai-org/ZCode"
repoCreatedAt: "2026-09-20"
stars: 7854
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# ZCode: 概要

zai-org/ZCode は 2026-09-20 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 7,854 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: ZCode 是 AI 编程工作台,提供桌面应用、浏览器界面和终端 Agent。
- 原文（README）: 本仓库包含客户端、后端服务、共享 UI,以及 Agent CLI 与运行时源码。
- 原文（README）: 准备 Git、Node.js 24.14.0 和 pnpm 10.33.2,版本以 mise.toml 为准。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Agent CLI 与运行时源码位于 apps/zcode-cli/,作为普通目录随本仓库一起克隆,无需单独拉取或初始化 Git submodule。
- 原文（README）: 命令行发行包包含 TUI、Web 和 Agent,统一使用 zcode 启动:无参数进入 TUI;第一个参数为 --web 时启动 Web;其他参数交给现有 Agent CLI 处理。
- 原文（README）: 两种模式都在本机运行,无需 Electron。
- 原文（README）: Web 模式默认工作目录为当前目录,监听 127.0.0.1,默认不启用访问令牌,自动选择空闲端口并打开浏览器。
- 原文（README）: 局域网访问可使用 --host 0.0.0.0;监听非本机地址时默认生成访问令牌,使用终端输出的带令牌链接。

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/zai-org/ZCode#readme) を確認してください。

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/zai-org/ZCode/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
