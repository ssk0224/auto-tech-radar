---
layout: "../../layouts/Layout.astro"
title: "solidcraft - README の要点（原文）"
description: "tangency-labs/solidcraft の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-19"
updatedDate: "2026-10-22"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/tangency-labs/solidcraft"
repoCreatedAt: "2026-10-08"
stars: 5717
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと導入を勧める表現を削除し、README の記載（76 部品中 75 部品の一致）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# solidcraft: 概要

tangency-labs/solidcraft は 2026-10-08 に GitHub で作成されたリポジトリです。2026-10-19 時点のスター数は 5,717 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: An open-source parametric 3D CAD application built in pure Rust.
- 原文（README）: Sketch, constrain, and build solids with a parametric feature timeline. Change a dimension and watch your model rebuild.
- 原文（README）: Run it on your desktop, in your browser, or let AI agents model through the built-in MCP server.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Early but usable for simple parts: 75 of 76 public reference parts match their analytic or FreeCAD-computed volume, area, centre of mass and bounding box (oracle); the other is a tracked bug.
- 原文（README）: Features: extrude, revolve, sweep, loft, fillet, chamfer, shell, draft, holes, threads, patterns, mirror, split and combine on an editable parametric timeline.
- 原文（README）: Files: STEP, IGES, 3MF, STL, OBJ and glTF in and out where supported, URDF export, .solidcraft designs.
- 原文（README）: Desktop app, browser app, headless CLI and MCP server, all running the same commands.
- 原文（README）: A script is a JSON list of the same commands the UI runs, executed with solidcraft-cli run.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/tangency-labs/solidcraft#readme) を確認してください。

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/tangency-labs/solidcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
