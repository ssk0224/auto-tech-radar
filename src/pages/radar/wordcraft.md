---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-14"
tags: ["Rust","OSS","GitHub","MCP"]
repoUrl: "https://github.com/storytold/wordcraft"
repoCreatedAt: "2026-10-07"
stars: 11077
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "根拠のない比較表現（「人間と同等以上の精度」など）を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "wordcraft - 純粋な Rust で作られた、オープンソースのワードプロセッサーです"
description: "純粋な Rust で作られた、オープンソースのワードプロセッサーです。"
---

# wordcraft: 概要

storytold/wordcraft は 2026-10-07 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 11,077 です。

- 純粋な Rust で作られた、オープンソースのワードプロセッサーです。
  - 原文（README）: Writing and document design; an open-source, modern word processor, built in pure Rust.
- .docx を読み書きでき、macOS・Windows・Linux・BSD でネイティブに、WebAssembly によりブラウザでも動作します。
  - 原文（README）: It reads and writes .docx, runs natively on macOS, Windows, Linux and BSD, and in the browser via WebAssembly.
- スペルや文法のチェックを含め、すべてオフラインで動作します。
  - 原文（README）: Spelling, grammar and everything else work offline.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: WordCraft is in alpha.

## 主な機能と構成（README の要約）

- .docx（OOXML）のほか .odt・.rtf・.html・.md・.tex（LaTeX）・.txt を開いて保存でき、97-2003 の .doc も開けます。PDF には選択できる文字・リンク・しおりつきで書き出せます。
  - 原文（README）: Opens and saves .docx (OOXML), and also .odt, .rtf, .html, .md, .tex (LaTeX), .txt; opens legacy 97-2003 .doc; exports PDF with real, selectable text, links and bookmarks.
- Electron も Tauri も使わず、GPU 上のネイティブな egui で動きます。
  - 原文（README）: No Electron, no Tauri: native egui on the GPU.
- すべての操作は id つきのコマンドで、同じ 422 個のコマンドがリボン・キーボードショートカット・コマンド検索・コマンドラインのツール・JSON の制御チャネル・MCP サーバーを動かします。
  - 原文（README）: Every action is a command with an id. The same 422 commands drive the ribbon, keyboard shortcuts, the command search, a command-line tool, a JSON control channel and an MCP server.
- クリーンルーム方式で、公開された仕様と観察から作られています。
  - 原文（README）: Clean-room: built from public specifications and observation, with every asset original or openly licensed.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/wordcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/wordcraft
cd wordcraft
cargo run --release -p wordcraft -- --sample        # the desktop app with the sample document
cargo run --release -p wordcraft -- report.docx     # open a document
```

```sh
wordcraft-cli convert report.docx report.pdf        # docx, pdf, odt, rtf, html, md, tex, txt, png
wordcraft-cli text report.docx                      # plain text
wordcraft-cli inspect report.docx                   # structure as JSON
wordcraft-cli run --template sample \
  --cmd 'select.text={"text":"Membership"}' --cmd format.bold --save out.docx
wordcraft-cli run --script job.json                 # the same from a file: commands, then save to docx and pdf
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/wordcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
