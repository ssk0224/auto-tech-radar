---
layout: "../../layouts/Layout.astro"
title: "claw-code - README の要点（原文）"
description: "ultraworkers/claw-code の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-31"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/ultraworkers/claw-code"
repoCreatedAt: "2026-03-31"
stars: 194995
generator_model: "gemini-2.5-flash"
---

# claw-code: 概要

ultraworkers/claw-code は 2026-03-31 に GitHub で作成されたリポジトリです。2026-10-31 時点のスター数は 194,995 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Claw Code is not the serious production project here.
- 原文（README）: This repository is closer to a museum exhibit than a product pitch, a crustacean-run artifact kept alive by clawed gajaes, swept and labeled by agents, and automatically maintained according to the harnesses above.
- 原文（README）: It is an **agent-managed exhibit**: the harnesses plan, execute, verify, label, and preserve the artifact while the crabs keep the tank running.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Claw Code is the public Rust implementation of the `claw` CLI agent harness.
- 原文（README）: The canonical implementation lives in [`rust/`](./rust), and the current source of truth for this repository is **ultraworkers/claw-code**.
- 原文（README）: `rust/` — canonical Rust workspace and the `claw` CLI binary
- 原文（README）: `USAGE.md` — task-oriented usage guide for the current product surface
- 原文（README）: `PARITY.md` — Rust-port parity status and migration notes
- 原文（README）: `ROADMAP.md` — active roadmap and cleanup backlog

## インストール（README からの転記）

以下は [README](https://github.com/ultraworkers/claw-code#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
# 1. Clone and build
git clone https://github.com/ultraworkers/claw-code
cd claw-code/rust
cargo build --workspace

# 2. Set your API key (Anthropic API key — not a Claude subscription)
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Verify everything is wired correctly
./target/debug/claw doctor

# 4. Run a prompt
./target/debug/claw prompt "say hello"

# 5. Start an interactive session
./target/debug/claw
```

```powershell
   cargo --version
```

```powershell
   git clone https://github.com/ultraworkers/claw-code
   cd claw-code/rust
   cargo build --workspace
```

```powershell
   $env:ANTHROPIC_API_KEY = "sk-ant-..."
   .\target\debug\claw.exe prompt "say hello"
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/ultraworkers/claw-code/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
