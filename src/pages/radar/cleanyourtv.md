---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-21"
tags: ["Java","OSS","GitHub"]
repoUrl: "https://github.com/Gathin23/cleanyourtv"
repoCreatedAt: "2026-10-17"
stars: 11608
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "ライセンス表記を LICENSE ファイルに基づき訂正（MIT License と、同梱フォントの SIL Open Font License 1.1 の表示）。導入を勧める表現・根拠のない比較と、ランチャーのサイズの記載を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "cleanyourtv - Android TV には、Android のスマートフォンと同じデバッグブリッジがあります"
description: "Android TV には、Android のスマートフォンと同じデバッグブリッジがあります。"
---

# cleanyourtv: 概要

Gathin23/cleanyourtv は 2026-10-17 に GitHub で作成されたリポジトリです。2026-10-21 時点のスター数は 11,608 です。

- Android TV には、Android のスマートフォンと同じデバッグブリッジがあります。
  - 原文（README）: Android TVs have the same debug bridge as Android phones.
- root もケーブルも不要で、何もアンインストールせず、気が変わったら 1 行で元に戻せます。
  - 原文（README）: No root, no cable, nothing uninstalled, and a one-line restore if you change your mind.
- TV と同じ Wi-Fi につながったコンピューターと、シェルを使えるコーディングアシスタントが必要です。
  - 原文（README）: You need a computer on the same Wi-Fi as the TV and a coding assistant with shell access.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 無効化: メーカーのテレメトリ、広告サービス、コンテンツの列、プリインストールの不要なアプリを pm disable-user で無効にします。
  - 原文（README）: Disable / The manufacturer's telemetry, ad services, content rows and preloaded junk, with pm disable-user.
- 何もアンインストールしないので、復元スクリプトですべての手順を元に戻せます。
  - 原文（README）: Nothing is uninstalled, so a restore script can undo every step.
- インストール: 小さなネイティブのランチャーを入れ、既定のホーム画面にします。
  - 原文（README）: Install / A small native launcher, made the default home screen.
- 不要なアプリはブランドごとに違うため、プロンプトはコーディングアシスタントに TV 上で探させ、使うかもしれないものに触れる前に確認させます。
  - 原文（README）: The bloat differs by brand, so the prompt has your coding assistant discover it on your TV and ask before touching anything you might use.
- Android TV または Google TV で動く機器が対象です。
  - 原文（README）: Anything running Android TV or Google TV.
- Fire TV: Fire OS はホームを他社製のランチャーに渡さないため、不要アプリの無効化だけが使えます。
  - 原文（README）: Fire TV / The debloat half only, since Fire OS will not hand Home to a third-party launcher.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/Gathin23/cleanyourtv#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/Gathin23/cleanyourtv/blob/main/LICENSE)
- 追加の表示: 一部のファイル（フォント等）は SIL Open Font License 1.1（LICENSE ファイルに記載）

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
