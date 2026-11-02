---
layout: "../../layouts/Layout.astro"
title: "superpowers - README の要点（原文）"
description: "obra/superpowers の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-11-02"
tags: ["Shell","OSS","GitHub"]
repoUrl: "https://github.com/obra/superpowers"
repoCreatedAt: "2025-10-10"
stars: 310637
generator_model: "gemini-3.5-flash"
---

# superpowers: 概要

obra/superpowers は 2025-10-10 に GitHub で作成されたリポジトリです。2026-11-02 時点のスター数は 310,637 です。Radar Ledger の記録では、直近 7 日間の増加数は 5,378 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Superpowers is a complete software development methodology for your coding agents, built on top of a set of composable skills and some initial instructions that make sure your agent uses them.
- 原文（README）: As soon as it sees that you're building something, it *doesn't* just jump into trying to write code.
- 原文（README）: Instead, it steps back and asks you what you're really trying to do.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: It emphasizes true red/green TDD, YAGNI (You Aren't Gonna Need It), and DRY.
- 原文（README）: Next up, once you say "go", it launches a *subagent-driven-development* process, having agents work through each engineering task, inspecting and reviewing their work, and continuing forward.
- 原文（README）: And because the skills trigger automatically, you don't need to do anything special.
- 原文（README）: Ask your coding agent to "figure out what went wrong with superpowers in this session" and it will invoke the **diagnosing-superpowers** skill.
- 原文（README）: The skill reads the session transcript, reports what happened with line-level evidence, and, if you want, packages a scrubbed bundle for a bug report.

## インストール（README からの転記）

以下は [README](https://github.com/obra/superpowers#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
  /plugin install superpowers@claude-plugins-official
```

```bash
  /plugin marketplace add obra/superpowers-marketplace
```

```bash
  /plugin install superpowers@superpowers-marketplace
```

```bash
agy plugin install https://github.com/obra/superpowers
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/obra/superpowers/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
