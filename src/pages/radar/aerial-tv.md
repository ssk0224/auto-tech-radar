---
layout: "../../layouts/Layout.astro"
title: "aerial-tv - README の要点（原文）"
description: "pengchujin/aerial-tv の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-26"
tags: ["Kotlin","OSS","GitHub"]
repoUrl: "https://github.com/pengchujin/aerial-tv"
repoCreatedAt: "2026-10-20"
stars: 4973
generator_model: "gemini-2.5-flash"
---

# aerial-tv: 概要

pengchujin/aerial-tv は 2026-10-20 に GitHub で作成されたリポジトリです。2026-10-26 時点のスター数は 4,973 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: 给国产电视的一块干净桌面。
- 原文（README）: 参照 Apple TV 做的 Android TV 桌面：没有广告，没有推荐流，只有你的 App、壁纸和航拍屏保。
- 原文（README）: 适合小米、TCL、创维、索尼等国产电视，也能装在盒子和投影仪上。开机自动进入，待机也不会被清理。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: **首页**：常用的一排 App 放在屏幕下方的玻璃底板上，往下是全部 App。
- 原文（README）: **整理**：长按 OK 键（或按菜单键）可以移动、放进文件夹、隐藏、卸载。
- 原文（README）: **用手机整理**：扫电视上的二维码，手机上就是和电视一样的图标网格：按住拖动排序，点一下改名、换图标、放进文件夹或隐藏，也能把 HDMI 等信号源加到主屏幕。
- 原文（README）: **控制中心**：在第一排按上键到右上角打开，有信号源、网络、设置、音量、亮度和个性化。
- 原文（README）: **屏保**：Apple TV 的 114 段航拍影片，电视支持时播 4K 或 4K 杜比视界，也可以换成照片、时钟或从手机添加的本地视频（[说明](docs/SCREENSAVER_VIDEOS.md)）。
- 原文（README）: **个性化**：单排或双排、时钟大小和位置、App 名称、焦点样式、按键声音，都能改。

## インストール（README からの転記）

以下は [README](https://github.com/pengchujin/aerial-tv#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```text
请帮我把开源电视桌面 Aerial 装到我的电视上，并设为开机进入的桌面。
电视 IP：<电视IP>
保持 ADB 常开：要

安装说明在这里：https://aerial.qust.me/agent.md
（打不开时用 https://raw.githubusercontent.com/pengchujin/aerial-tv/main/site/agent.md ）

请先完整读完安装说明再动手，然后在我的电脑上亲自运行命令，不要只把步骤告诉我。需要我在电视上操作时提醒我。
最后按说明里的「验收」，把这几条命令的原始输出原样贴给我：
- adb shell "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME"
- adb shell settings get secure enabled_accessibility_services
- 按主页键后的 adb shell "dumpsys window | grep mCurrentFocus"
```

```bash
curl -fsSL https://aerial.qust.me/install.sh | KEEP_ADB=1 TV=192.168.1.20 bash
```

```bash
adb connect 192.168.1.20:5555
adb install -r aerial-standard.apk
adb shell pm grant app.orchard.tv android.permission.WRITE_SECURE_SETTINGS
adb shell cmd notification allow_listener app.orchard.tv/app.orchard.tv.guard.RevivalListener
adb shell appops set app.orchard.tv SYSTEM_ALERT_WINDOW allow
adb shell am start -n app.orchard.tv/.MainActivity
```

```bash
curl -fsSL https://aerial.qust.me/install.sh | TV=192.168.1.20 bash -s restore
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/pengchujin/aerial-tv/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
