---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-15"
tags: ["Kotlin","OSS","GitHub","Android","SteamOS","Proton"]
repoUrl: "https://github.com/Droid-Deck/DroidDeck"
repoCreatedAt: "2026-09-25"
stars: 8333
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "DroidDeck - DroidDeck は SteamOS の体験を Android で提供します。Adreno 搭載の携帯機で Valve の Steam クライアントを Big Picture で動かし、Windows のゲームを Valve の ARM64 版 Proton で動かします"
description: "DroidDeck は SteamOS の体験を Android で提供します。Adreno 搭載の携帯機で Valve の Steam クライアントを Big Picture で動かし、Windows のゲームを Valve の ARM64 版 Proton で動かします。"
---

# DroidDeck: 概要

Droid-Deck/DroidDeck は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 8,333 です。

- DroidDeck は SteamOS の体験を Android で提供します。Adreno 搭載の携帯機で Valve の Steam クライアントを Big Picture で動かし、Windows のゲームを Valve の ARM64 版 Proton で動かします。
  - 原文（README）: DroidDeck brings the SteamOS experience to Android: Valve's Steam client in Big Picture on your Adreno handheld, with Windows games through Valve's ARM64 Proton.
- 対応する Adreno の機器（730 以降、または 8xx）で Android 9 以降を使います。
  - 原文（README）: Use Android 9 or newer on a supported Adreno device (730 or newer, or 8xx).
- root は不要です。
  - 原文（README）: No root is required.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- ランタイムに約 3 GB、デスクトップとエミュレーターにさらに 1.1 GB を見込んでください。
  - 原文（README）: Allow about 3 GB for the runtime and 1.1 GB more for the desktop and emulators.
- Releases から APK をインストールし、Linux のランタイムを入れてから Play を押してサインインします。Steam は初回の起動時にダウンロードされます。
  - 原文（README）: Install the APK from Releases, install the Linux runtime, then press Play and sign in. Steam downloads on first launch.
- Store は Flatpak を使って Flathub から Linux のアプリとゲーム（ARM64 ビルド）をインストールします。
  - 原文（README）: The Store installs Linux apps and games from Flathub (ARM64 builds) with Flatpak; with additional options to install Appimages and set up scripts.
- Stores は GOG、Epic Games、Amazon Games にサインインし、ゲームを Games のストレージにダウンロードします。
  - 原文（README）: Stores (Setup › Stores › "Show Stores in the rail") signs in to GOG, Epic Games and Amazon Games and downloads games into the Games storage.
- Android 14 以降では、Steam の起動前に開発者オプションで Disable child process restrictions を有効にする必要があります。
  - 原文（README）: On Android 14 and newer, before Steam launches, you must turn on Disable child process restrictions in Developer options.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/Droid-Deck/DroidDeck#readme) を確認してください。

## ライセンス

- ライセンス: GNU General Public License v3.0（SPDX: GPL-3.0）
- 確認先: [LICENSE ファイル](https://github.com/Droid-Deck/DroidDeck/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
