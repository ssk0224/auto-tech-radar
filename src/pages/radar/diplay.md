---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-14"
tags: ["Kotlin","OSS","GitHub"]
repoUrl: "https://github.com/shihabal3amri/DiPlay"
repoCreatedAt: "2026-09-25"
stars: 10296
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "DiPlay - 対応する BYD の Android ヘッドユニットで CarPlay を使うためのアプリです。有線と無線に対応し、DiAuto のインターフェースを使います"
description: "対応する BYD の Android ヘッドユニットで CarPlay を使うためのアプリです。有線と無線に対応し、DiAuto のインターフェースを使います。"
---

# DiPlay: 概要

shihabal3amri/DiPlay は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 10,296 です。

- 対応する BYD の Android ヘッドユニットで CarPlay を使うためのアプリです。有線と無線に対応し、DiAuto のインターフェースを使います。
  - 原文（README）: CarPlay for compatible BYD Android head units. Wired and wireless, with the familiar DiAuto interface.
- 対象は BYD の車です。他のブランドでも動く可能性はありますが、対応しておらず、ブランド固有の非互換を直す予定もありません。
  - 原文（README）: BYD support scope: These projects focus on BYD cars. They may work on other brands, but other brands are unsupported and there are no plans to add support or fix brand-specific incompatibilities.
- iPhone ではなく車にインストールします。脱獄・ドングル・Mac・アカウント・認証サーバーは不要です。
  - 原文（README）: Install on the car, not the iPhone. No jailbreak, dongle, Mac, account or authentication server is required for use.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- CarPlay の中核機能に ADB は不要ですが、ダッシュボード・バッテリー・車輪速・駐車中の動画の機能には必要です。
  - 原文（README）: Core CarPlay does not require ADB; optional dashboard, battery, wheel-speed and parked-video features do.
- APK は Android 7.0 以降（API 24）に対応しますが、Android 7.0〜8.1 での対応は実車でまだ確認されていません。
  - 原文（README）: The APK supports Android 7.0+ (API 24); Android 7.0–8.1 support is not yet confirmed on a vehicle.
- 無線接続は Wi-Fi Direct、車の既存のホットスポット、既存の Wi-Fi（同じ LAN）に対応します。
  - 原文（README）: Wireless supports Wi-Fi Direct, the car’s existing hotspot or Existing Wi-Fi / Same LAN.
- Apple の認証を受けた製品ではありません。
  - 原文（README）: This is not an Apple-certified product.
- APK には、公開されている Carlinkit のファームウェアから取り出した実験的なアクセサリーの識別情報が同梱されており、DiPlay 用に新しく発行された MFi の識別情報ではありません。同梱の秘密鍵は取り出せます。
  - 原文（README）: The APK bundles an experimental accessory identity recovered from public Carlinkit firmware, not a newly provisioned MFi identity for DiPlay. A bundled private key is extractable.
- ほかのヘッドユニットや iOS での互換性は保証されていません。
  - 原文（README）: Broader head-unit and iOS compatibility is not guaranteed.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/shihabal3amri/DiPlay#readme) を確認してください。

## ライセンス

- ライセンス: GNU General Public License v3.0（SPDX: GPL-3.0）
- 確認先: [LICENSE ファイル](https://github.com/shihabal3amri/DiPlay/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
