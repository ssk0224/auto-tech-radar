---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-16"
tags: ["Kotlin","OSS","GitHub","Android"]
repoUrl: "https://github.com/jev-chat/jev-chat-jarvis"
repoCreatedAt: "2026-09-21"
stars: 7815
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "jev-chat-jarvis - 返信する前に、Jev が相手の本当の意図・その場面のリスク・応じ方を判断し、ワンタップで入力できる返信の下書きを作ります"
description: "返信する前に、Jev が相手の本当の意図・その場面のリスク・応じ方を判断し、ワンタップで入力できる返信の下書きを作ります。"
---

# jev-chat-jarvis: 概要

jev-chat/jev-chat-jarvis は 2026-09-21 に GitHub で作成されたリポジトリです。2026-10-16 時点のスター数は 7,815 です。

- 返信する前に、Jev が相手の本当の意図・その場面のリスク・応じ方を判断し、ワンタップで入力できる返信の下書きを作ります。
  - 原文（README）: Before you answer, Jev works out what the other person really means, how risky the moment is and how to respond, then drafts replies you can fill in with one tap.
- 送るかどうかは常に利用者が決めます。
  - 原文（README）: Whether to send is always up to you.
- 送信は利用者が押します。jev-chat は入力欄に入れるだけで、自分からは送りません。
  - 原文（README）: You press send — jev-chat only fills the input box and never sends on its own

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- Jev の判断モデルが会話を読み、相手の意図とその場面のリスク、応じ方を割り出します。
  - 原文（README）: Its Jev judgment model reads the conversation and works out the other person's intent, the risk in the moment and the best way to respond.
- Android では WhatsApp・QQ・Feishu・X、Windows と macOS ではチャットのウィンドウ、iOS ではキーボードを通じてあらゆるアプリで使えます。
  - 原文（README）: Works where you chat — WhatsApp, QQ, Feishu and X on Android; chat windows on Windows and macOS; any app through the iOS keyboard
- 独自のサーバーは使わず、リクエストは利用者が設定したモデルの提供元に、利用者のキーで送られます。
  - 原文（README）: Your keys, no server of ours — requests go only to the model provider you configure, with your own key
- Windows 版の Jev for Windows は、チャットのウィンドウの横に置かれ、スクリーンショットと端末上の OCR で内容を読みます。
  - 原文（README）: Windows / Jev for Windows / Sits beside your chat window and reads it with screenshots and on-device OCR / Released
- Android は 11 以降が必要です（中国版は ARM64 のスマートフォンが必要です）。
  - 原文（README）: Android: Android 11 or later (the Chinese edition needs an ARM64 phone)

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/jev-chat/jev-chat-jarvis#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/jev-chat/jev-chat-jarvis/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
