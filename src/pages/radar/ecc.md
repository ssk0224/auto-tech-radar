---
layout: "../../layouts/Layout.astro"
title: "ECC - README の要点（原文）"
description: "affaan-m/ECC の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-11-04"
tags: ["JavaScript","OSS","GitHub"]
repoUrl: "https://github.com/affaan-m/ECC"
repoCreatedAt: "2026-01-18"
stars: 296609
generator_model: "gemini-3.5-flash"
---

# ECC: 概要

affaan-m/ECC は 2026-01-18 に GitHub で作成されたリポジトリです。2026-11-04 時点のスター数は 296,609 です。Radar Ledger の記録では、直近 7 日間の増加数は 5,689 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Your agent can write code, but ECC gives it a coordinated engineering system and toolbox: it plans before it builds, verifies changes with tests, reviews its own work from a fresh context, remembers what matters, and turns repeated wins into reusable skills and workflows.
- 原文（README）: Instead of rebuilding that process in every prompt, you install it once and make it part of how your agent works.
- 原文（README）: ECC is MIT-licensed open source.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Access to 71 agents, 314 skills, and 98 legacy command shims, plus hooks, rules, memory, continuous learning, and AgentShield security scanning.
- 原文（README）: The agents are specialized for planning, review, build repair, security, architecture, and domain work.
- 原文（README）: ECC 2.2 includes guided package setup for Claude Code, Codex, and Kimi Code.
- 原文（README）: The universal package requires Node.js 18 or newer.
- 原文（README）: Rerun the same command whenever you want to update ECC, change scope, or change its hook profile.

## インストール（README からの転記）

以下は [README](https://github.com/affaan-m/ECC#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
npx ecc-universal@2.2.3 setup
```

```powershell
   node --version
   git --version
   claude --version
```

```powershell
   npx ecc-universal@2.2.3 setup
```

```bash
npm view ecc-universal version
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/affaan-m/ECC/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
