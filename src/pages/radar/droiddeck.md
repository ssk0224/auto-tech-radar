---
layout: "../../layouts/Layout.astro"
title: "DroidDeck - AndroidでSteamOS風の体験を目指すOSS"
description: "DroidDeckは、AndroidデバイスでSteamOSのゲーミング体験とWindowsゲームの実行を目指すオープンソースプロジェクトです。"
pubDate: "2026-10-15"
tags: ["Kotlin", "OSS", "GitHub", "Android", "Gaming", "SteamOS", "Proton"]
repoUrl: "https://github.com/Droid-Deck/DroidDeck"
repoCreatedAt: "2026-09-25"
stars: 8333
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# DroidDeck: 概要

Droid-Deck/DroidDeck は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-15 時点のスター数は 8,333 です。

DroidDeckは、Androidデバイス上でValveのSteamOS体験を再現し、Steam Big PictureモードとARM64版Protonを介してWindowsゲームの実行を目指すオープンソースプロジェクトです。対象は README に記載された Adreno GPU 搭載のデバイスです。

従来のAndroidゲーミングは、ネイティブアプリに限定されるか、クラウドゲーミングサービスに依存していました。DroidDeckは、この現状を打破し、デバイス上で直接PCゲームを動作させるという、これまでになかった自由とパフォーマンスを提供します。特に、Steam Deckのような専用ハードウェアに投資することなく、既存のAndroidデバイス資産を最大限に活用できる点が、その最大の魅力であり革新性と言えるでしょう。

## 解決する主要な課題とアーキテクチャ

DroidDeckが解決する主要な課題は以下の通りです。

1.  **AndroidデバイスでのPCゲーム体験の欠如:** 多くのAndroidデバイスは高性能なハードウェアを持つものの、PCゲームの実行環境がありませんでした。DroidDeckはProtonを導入することで、このギャップを埋めます。
2.  **高価な専用ゲーミングハードウェアへの依存:** Steam Deckのような専用デバイスは魅力的ですが、初期投資が必要です。DroidDeckは既存のAndroidデバイスを活用し、コストを削減します。
3.  **クラウドゲーミングの制約:** ネットワーク環境に依存し、遅延やデータ使用量の問題があるクラウドゲーミングに対し、DroidDeckはデバイス上でのローカル実行を可能にします。

DroidDeckのアーキテクチャは、Androidアプリケーション、Linuxランタイム、そしてValveの技術要素を巧みに統合しています。

```mermaid
graph TD
    subgraph AndroidDevice ["Android Device (Adreno 730+ / Android 9+)"]
        A["DroidDeck Android App (Kotlin)"] --> B(Linux Runtime - proot);
        B --> C["Steam Client (Big Picture Mode)"];
        B --> D["Proton (ARM64)"];
        D --> E[Windows Games];
        B --> F["Desktop & Apps (Emulators, Browsers)"];
        B --> G["Stores Integration (Flathub, GOG, Epic, Amazon)"];
        G --> H[Non-Steam Games Integration];
    end

    C -- User Interaction --> A;
    E -- Game Output --> A;
    A -- GPU Acceleration --> I["Adreno GPU (730+)"];
    J[Android 14+ Developer Options] -- "Disable child process restrictions" --> A;

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#ccf,stroke:#333,stroke-width:2px
    style C fill:#afa,stroke:#333,stroke-width:2px
    style D fill:#faa,stroke:#333,stroke-width:2px
    style E fill:#ffc,stroke:#333,stroke-width:2px
    style F fill:#eef,stroke:#333,stroke-width:2px
    style G fill:#fcf,stroke:#333,stroke-width:2px
    style H fill:#fce,stroke:#333,stroke-width:2px
    style I fill:#cff,stroke:#333,stroke-width:2px
    style J fill:#fcc,stroke:#333,stroke-width:2px
```

1.  **DroidDeck Android App (Kotlin):** Androidデバイス上で動作するメインアプリケーション。ユーザーインターフェースを提供し、Linuxランタイムの起動と管理を行います。
2.  **Linux Runtime (proot):** Androidのサンドボックス内で動作する仮想的なLinux環境。`proot`技術を利用し、root権限なしでLinux環境をエミュレートします。
3.  **Steam Client (Big Picture Mode):** Linuxランタイム上で動作するSteamクライアント。ゲームライブラリへのアクセス、ダウンロード、起動を管理します。
4.  **Proton (ARM64):** Valveが開発したWindowsゲーム互換レイヤーのARM64版。WindowsゲームのAPIコールをLinux互換に変換し、Androidデバイス上でWindowsゲームを実行可能にします。
5.  **Adreno GPU (730+):** DroidDeckのパフォーマンスを支える重要なハードウェア要素。DirectX 11/12ゲームのレンダリングを高速化します。
6.  **Stores Integration:** FlathubからのLinuxアプリ、GOG、Epic Games、Amazon Gamesなどの外部ストアからゲームをダウンロードし、Steamに非Steamゲームとして統合する機能を提供します。

このアーキテクチャにより、DroidDeckはAndroidデバイスのハードウェア性能を最大限に引き出し、PCゲーミングの新たな可能性を切り開いています。

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/Droid-Deck/DroidDeck#readme) を確認してください。

## ライセンス

- ライセンス: GNU General Public License v3.0（SPDX: GPL-3.0）
- 確認先: [LICENSE ファイル](https://github.com/Droid-Deck/DroidDeck/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
