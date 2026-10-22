---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-13"
tags: ["Rust","OSS","GitHub","PDF","MCP","AI"]
repoUrl: "https://github.com/storytold/pdfcraft"
repoCreatedAt: "2026-09-30"
stars: 11454
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "pdfcraft - 純粋な Rust で作られた、オープンソースの PDF リーダー兼エディターです"
description: "純粋な Rust で作られた、オープンソースの PDF リーダー兼エディターです。"
---

# pdfcraft: 概要

storytold/pdfcraft は 2026-09-30 に GitHub で作成されたリポジトリです。2026-10-13 時点のスター数は 11,454 です。

- 純粋な Rust で作られた、オープンソースの PDF リーダー兼エディターです。
  - 原文（README）: The PDF workbench; an open-source, modern PDF reader and editor, built in pure Rust.
- アカウント・テレメトリ・クラウドは不要で、オフラインで動作します。
  - 原文（README）: No account, no telemetry, no cloud. It works offline and opens instantly.
- エンジン・CLI・アプリはすべてオープンソースです。
  - 原文（README）: The engine, CLI and app are all open source.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: Where it stands (October 2026), honestly: PdfCraft is alpha.

## 主な機能と構成（README の要約）

- 保存のたびに変更を追記し、元のバイト列には手を加えません。書き込みはアトミックで、間違って閉じても何も失われません。
  - 原文（README）: Every save appends your changes and leaves the original bytes untouched. Writes are atomic, undo runs deep, and nothing is lost if you close by mistake.
- 大きなページはタイルに分けて描画するため、どの倍率でも文字がくっきり表示されます。
  - 原文（README）: Large pages render in tiles, so text stays crisp at any magnification.
- 各ページは個別に描画され、壊れた文書は修復されます。983 ファイルからなる pdf.js のテストコーパスでは、クラッシュは 0 件でした。
  - 原文（README）: Every page renders in isolation and damaged documents are repaired. Across the 983-file pdf.js test corpus the result is 0 crashes.
- 入力しながら文書全体を検索し、⌘G で一致箇所を順にたどり、正しい読み順で文字を選択できます。
  - 原文（README）: Search the whole document as you type, step through matches with ⌘G , and select text that comes out in the right reading order.

## インストール（README からの転記）

以下は [README](https://github.com/storytold/pdfcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
git clone https://github.com/storytold/pdfcraft
cd pdfcraft
cargo xtask models                                # fetch the OCR models Scan & OCR needs (release builds include them)
cargo run --release -p pdfcraft -- some.pdf     # desktop app
cargo xtask demo-pdf                              # build the showcase PDF used in these screenshots
cargo xtask screenshots                           # regenerate every screenshot in this README
```

```sh
git clone https://github.com/storytold/craft-fonts ../craft-fonts
CRAFT_FONTS_DIR=../craft-fonts cargo run --release -p pdfcraft -- some.pdf
```

```sh
eselect repository add snakebyte git https://github.com/switch87/snakebyte-overlay.git
emaint sync -r snakebyte
echo 'app-text/pdfcraft-bin ~amd64' >> /etc/portage/package.accept_keywords/pdfcraft
emerge --ask app-text/pdfcraft-bin
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/pdfcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
