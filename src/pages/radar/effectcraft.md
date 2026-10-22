---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-18"
tags: ["Rust","OSS","GitHub"]
repoUrl: "https://github.com/storytold/effectcraft"
repoCreatedAt: "2026-10-01"
stars: 7161
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと根拠のない比較表現を削除し、ライセンスの条件の記述を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "effectcraft - 純粋な Rust で作られた、オープンソースのモーショングラフィックスと視覚効果のスタジオです"
description: "純粋な Rust で作られた、オープンソースのモーショングラフィックスと視覚効果のスタジオです。"
---

# effectcraft: 概要

storytold/effectcraft は 2026-10-01 に GitHub で作成されたリポジトリです。2026-10-18 時点のスター数は 7,161 です。

- 純粋な Rust で作られた、オープンソースのモーショングラフィックスと視覚効果のスタジオです。
  - 原文（README）: Motion graphics and visual effects; an open-source, professional motion graphics and visual effects studio, built in pure Rust.
- EffectCraft は、アニメーションのタイトル、モーショングラフィックス、合成の作業のためのものです。
  - 原文（README）: EffectCraft is for animated titles, motion graphics and compositing work: the kind of thing motion designers and VFX artists need.
- EffectCraft の最初のコミットは 2026 年 10 月 1 日です。
  - 原文（README）: EffectCraft is young: its first commit was on 1 October 2026.

## 🎯 成熟度の目安（README の記載）

README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。

- 原文（README）: EffectCraft is in alpha: about 91% of the features tracked in docs/target-app-parity.md exist, and we estimate it is about 45% of the way to being ready for full professional production work.

## 主な機能と構成（README の要約）

- レイヤー（平面・シェイプ・テキスト・フッテージ・ほかのコンポジション）からコンポジションを組み、キーフレームでプロパティを動かし、エフェクトを重ねて結果をレンダリングします。
  - 原文（README）: You build a composition out of layers (solids, shapes, text, footage, other compositions), animate their properties with keyframes, stack effects on them and render the result.
- プロジェクトはバージョンつきの JSON（.ecproj）なので、バージョン管理で差分をきれいに取れます。
  - 原文（README）: Projects are versioned JSON (.ecproj), so they diff cleanly in version control.
- メニューの項目・タイムラインのドラッグ・プロパティの編集はすべて 1 つのコマンドの登録簿を通るため、同じ操作をコマンドライン・JSON の制御チャネル・エージェント向けの MCP サーバーから実行できます。
  - 原文（README）: Every menu item, timeline drag and property edit goes through one command registry, so the same actions are reachable from a command line, a JSON control channel and an MCP server for agents.
- FFmpeg は使いません。動画と音声のデコードとエンコードは純粋な Rust で、FilmCraft のコーデックと EffectCraft 独自の VP9・AV1・HEVC・Opus のエンコーダーを使います。
  - 原文（README）: No FFmpeg. Video and audio decoding and encoding are pure Rust: FilmCraft's codecs and EffectCraft's own VP9, AV1, HEVC and Opus encoders.
- MCP サーバー: effectcraft-cli mcp は stdio で Model Context Protocol を話し、単独でも、起動中のアプリにつないでも（--bridge 9877）動きます。
  - 原文（README）: MCP server: effectcraft-cli mcp speaks the Model Context Protocol over stdio, headless or bridged to the running app (--bridge 9877).

## インストール（README からの転記）

以下は [README](https://github.com/storytold/effectcraft#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```sh
eselect repository add snakebyte git https://github.com/switch87/snakebyte-overlay.git
emaint sync -r snakebyte
echo 'media-video/effectcraft-bin ~amd64' >> /etc/portage/package.accept_keywords/effectcraft
emerge --ask media-video/effectcraft-bin
```

```sh
git clone https://github.com/storytold/effectcraft
cd effectcraft
cargo run --release -p effectcraft          # the app (add `-- --demo` to open the demo project)
cargo run --release -p effectcraft-cli -- render --out intro.mp4    # render the demo headless
cargo xtask web --serve 8765                # the browser build on http://127.0.0.1:8765/ (docs/web.md)
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/storytold/effectcraft/blob/main/LICENSE-APACHE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
