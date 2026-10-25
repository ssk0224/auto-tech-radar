---
layout: "../../layouts/Layout.astro"
title: "md3Music - README の要点（原文）"
description: "zzyoxml/md3Music の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-09"
updatedDate: "2026-10-22"
tags: ["Dart","OSS","GitHub"]
repoUrl: "https://github.com/zzyoxml/md3Music"
repoCreatedAt: "2026-05-29"
stars: 858
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# md3Music: 概要

zzyoxml/md3Music は 2026-05-29 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 858 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: A modern Material 3 music player built with Flutter & Rust.
- 原文（README）: MD3Music 是一款基于酷狗音乐 API 的 Flutter 音乐播放器,内置嵌入式 Rust API 服务器,无需外部服务器即可使用。
- 原文（README）: 本项目仅供学习,请勿用于商业用途,详情见免责声明。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: 嵌入式 Rust 服务器 — App 启动时通过 libkugou_server.so(JNI/MethodChannel)启动本地 tiny_http 服务器(127.0.0.1),所有酷狗 API 请求在本地处理
- 原文（README）: 多架构支持 — 支持 armeabi-v7a(32 位)、arm64-v8a(64 位)、x86、x86_64(模拟器)
- 原文（README）: 本地投屏支持 — 内置局域网 HTTP 服务器(支持 Range 请求),本地音乐也能投屏到 DLNA 设备
- 原文（README）: 项目配置了 GitHub Actions,推送 v* 标签会自动构建并创建 GitHub Release。

## インストール（README からの転記）

以下は [README](https://github.com/zzyoxml/md3Music#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
git clone https://github.com/zzyoxml/md3Music.git
cd md3Music
```

```bash
flutter pub get
```

```bash
# 主机编译验证
cd kugou_api_server/rust
cargo build --release

# 安卓交叉编译（4 个 ABI，需要 NDK）
./build_android.sh
```

```bash
# 连接 Android 设备后执行
flutter run
```

## ライセンス

- ライセンス: GNU Affero General Public License v3.0（SPDX: AGPL-3.0）
- 確認先: [LICENSE ファイル](https://github.com/zzyoxml/md3Music/blob/rust-local-force/LICENSE)

README には、利用について次の記載があります（原文のまま）。

- 原文（README）: 本项目仅供学习,请勿用于商业用途,详情见免责声明。

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
