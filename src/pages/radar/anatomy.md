---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-14"
tags: ["JavaScript","OSS","GitHub","SVG","WebGL"]
repoUrl: "https://github.com/wheresryan22/anatomy"
repoCreatedAt: "2026-10-08"
stars: 9975
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "anatomy - anatomy は、アイデアを実際に動く物として組み立てて説明する Claude のスキルです"
description: "anatomy は、アイデアを実際に動く物として組み立てて説明する Claude のスキルです。"
---

# anatomy: 概要

wheresryan22/anatomy は 2026-10-08 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 9,975 です。

- anatomy は、アイデアを実際に動く物として組み立てて説明する Claude のスキルです。
  - 原文（README）: A Claude skill that explains an idea by building it as a real, working object.
- Antigravity、OpenCode、Codex、MiniMax Code でも動作します。
  - 原文（README）: Also runs in Antigravity, OpenCode, Codex and MiniMax Code.
- 小さな部品を多く組み合わせた、操作できるアイソメトリックの図を、SVG・WebGL・3D で作ります。
  - 原文（README）: Crafted, interactive isometric figures with many small precise parts, in SVG, WebGL and 3D.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 技術的なアイデアを説明する図を Claude に頼むと、Anatomy はその概念どおりに動く物理的な物を考え出させます。
  - 原文（README）: Ask Claude for a figure that explains a technical idea, and Anatomy has it invent a physical thing whose working is the concept.
- その後 Claude は、小さな部品を多く組み合わせてその物を作り、題名・ヒント・表示つきのカードに入れ、ポインターとキーボードで動かせるようにし、すべての継ぎ目を拡大して自分の作業を確かめます。
  - 原文（README）: Then Claude builds that thing out of dozens of small, solid, shaded parts, puts it in a framed card with a title, a hint and a live readout, makes it move calmly under the pointer and the keyboard, and checks its own work by zooming in on every joint.
- 図に表示される数値は、部品を動かすのと同じ小さなモデルから来ています。
  - 原文（README）: Every number the figure shows comes from the same small model that moves its parts.
- API キーも npm install も不要で、キットは Node の組み込みモジュールだけを使います。
  - 原文（README）: No API keys and nothing to npm install: the kit uses only Node's built-in modules.
- Anatomy は Agent Skill の形式で、ルートに SKILL.md を置いたフォルダーです。このリポジトリがそのフォルダーです。
  - 原文（README）: Anatomy is a standard Agent Skill: a folder with a SKILL.md at its root. This repository is that folder.

## インストール（README からの転記）

以下は [README](https://github.com/wheresryan22/anatomy#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
npx skills add wheresryan22/anatomy -g
```

```text
/anatomy explain how a token bucket rate limiter works, interactive
```

```sh
mkdir -p ~/.claude/skills/anatomy && curl -L https://github.com/wheresryan22/anatomy/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C ~/.claude/skills/anatomy
```

```sh
mkdir -p ~/.gemini/antigravity/skills/anatomy && curl -L https://github.com/wheresryan22/anatomy/archive/refs/heads/main.tar.gz | tar -xz --strip-components=1 -C ~/.gemini/antigravity/skills/anatomy
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/wheresryan22/anatomy/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
