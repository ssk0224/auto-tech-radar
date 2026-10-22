---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-14"
tags: ["Go","OSS","GitHub"]
repoUrl: "https://github.com/yetone/magpie"
repoCreatedAt: "2026-09-24"
stars: 11503
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "導入手順の表現を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "magpie - 1 つのローカルゲートウェイがすべてのエージェントの要求を受け、利用枠を使い切ると次のアカウントに切り替えます"
description: "1 つのローカルゲートウェイがすべてのエージェントの要求を受け、利用枠を使い切ると次のアカウントに切り替えます。"
---

# magpie: 概要

yetone/magpie は 2026-09-24 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 11,503 です。

- 1 つのローカルゲートウェイがすべてのエージェントの要求を受け、利用枠を使い切ると次のアカウントに切り替えます。
  - 原文（README）: One local gateway serves them all, and when a quota runs out, it quietly moves on to the next account.
- エージェントはそれぞれ、モデルの設定を独自のファイル・形式・キー・base URL で持っています。
  - 原文（README）: Each agent keeps its model in its own file, in its own format, with its own keys and base URLs.
- macOS・Windows・Linux（メニューバーのアプリ、ウィンドウ、TUI、web UI、CLI）、Docker、Termux で動作します。
  - 原文（README）: Runs on macOS, Windows and Linux (menu bar app, window, TUI, web UI and CLI), in Docker, and on Termux.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 1 つの一覧から、どのエージェントにもどのモデルでも選べます。magpie はエージェント自身の設定のうち、関係する 1 つのキーだけを書き換えます。
  - 原文（README）: Pick any model for any agent from one list. magpie edits the one key that matters in the agent's own config.
- 利用枠を使い切っても続けられます。ルーティンググループが次のアカウントかモデルに移り、エージェントにはエラーが見えません。
  - 原文（README）: Keep going when a quota runs out: a routing group moves to the next account or model, and the agent never sees the error.
- 127.0.0.1:3425 のゲートウェイは OpenAI Chat・OpenAI Responses・Anthropic Messages・Gemini の形式を話し、ストリーミング・ツール呼び出し・推論を含めて相互に変換します。
  - 原文（README）: The gateway at 127.0.0.1:3425 speaks OpenAI Chat, OpenAI Responses, Anthropic Messages and Gemini, and translates between them, streaming, tool calls and reasoning included.
- エージェントの設定はアトミックに書き換えられ、コメント・順序・書式はそのまま残ります。
  - 原文（README）: The agent's config is rewritten atomically, and its comments, order and formatting stay as they were.

## インストール（README からの転記）

以下は [README](https://github.com/yetone/magpie#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
curl -fsSL https://usemagpie.ai/install.sh | sh
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```sh
magpie provider add deepseek sk-…              # a preset needs only the key
magpie claude deepseek/deepseek-v4-pro          # Claude Code on DeepSeek
magpie codex moonshot/kimi-k2.5                 # Codex on Kimi
magpie group add "Opus anywhere" models=claude/claude-opus-5-5,copilot/claude-opus-5.5 routing=smart
magpie claude group/opus-anywhere               # fails over between subscriptions
magpie save work && magpie use work             # profiles
magpie quota                                    # what's left on every plan
magpie tui                                      # the whole thing, in a terminal
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/yetone/magpie/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
