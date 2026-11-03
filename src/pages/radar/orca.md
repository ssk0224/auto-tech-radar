---
layout: "../../layouts/Layout.astro"
title: "orca - README の要点（原文）"
description: "stablyai/orca の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-11-03"
tags: ["TypeScript","OSS","GitHub"]
repoUrl: "https://github.com/stablyai/orca"
repoCreatedAt: "2026-03-17"
stars: 114027
generator_model: "gemini-2.5-flash"
---

# orca: 概要

stablyai/orca は 2026-03-17 に GitHub で作成されたリポジトリです。2026-11-03 時点のスター数は 114,027 です。Radar Ledger の記録では、直近 7 日間の増加数は 6,637 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Orca is the place for working with a fleet of agents (e.g. Grok Bot, Claude Code).
- 原文（README）: Run Codex, ClaudeCode, OpenCode or Pi side-by-side — each in its own worktree, tracked in one place.
- 原文（README）: Available on desktop, mobile and remote runtime.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Monitor and steer your agents from your phone — get notified when an agent finishes and send follow-ups from anywhere.
- 原文（README）: Fan one prompt across five agents, each in its own isolated git worktree — compare the results and merge the winner.
- 原文（README）: Click any UI element in a real Chromium window to send its HTML, CSS, and a cropped screenshot straight into your agent's prompt.
- 原文（README）: Browse PRs, issues, and project boards in-app — open a worktree from any task and review without a context switch.
- 原文（README）: Run agents on a beefy remote box with full file editing, git, and terminals — auto-reconnect and port forwarding included.
- 原文（README）: Agents drive Orca too — script every workflow with `orca worktree create`, `snapshot`, `click`, and `fill`.

## インストール（README からの転記）

以下は [README](https://github.com/stablyai/orca#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
# macOS (Homebrew)
# Always use the full name; bare `orca` is an unrelated Plotly cask.
brew install --cask stablyai/orca/orca
# Upgrade an existing install
brew upgrade --cask stablyai/orca/orca

# Arch Linux (AUR) — or stably-orca-git to build from source
yay -S stably-orca-bin
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/stablyai/orca/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
