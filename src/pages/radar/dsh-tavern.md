---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-09"
tags: ["JavaScript","OSS","GitHub"]
repoUrl: "https://github.com/flizzywine/dsh-tavern"
repoCreatedAt: "2026-08-16"
stars: 819
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "dsh-tavern - DSH（DeepSeek Harness）を基盤にした Agent の「酒館」です"
description: "DSH（DeepSeek Harness）を基盤にした Agent の「酒館」です。"
---

# dsh-tavern: 概要

flizzywine/dsh-tavern は 2026-08-16 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 819 です。

- DSH（DeepSeek Harness）を基盤にした Agent の「酒館」です。
  - 原文（README）: 基于 DSH(DeepSeek Harness)的 Agent 酒馆。
- SillyTavern のエコシステムと互換性があり、キャラクターカードを読み込めば遊べます。
  - 原文（README）: 兼容 SillyTavern 生态,人物卡导入就能玩。
- 現在の版は DSH 0.2.1-rc.2（公式の DeepSeek Harness または単体のコマンドライン。Android は単体の APK）に対応しています。
  - 原文（README）: 当前版本适配 DSH 0.2.1-rc.2(官方 DeepSeek Harness 或独立命令行;Android 使用独立 APK),安装见快速开始。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- 変数はバックエンドが規則に従って計算し、各ターンに更新結果を付けます。失敗したら個別にやり直せ、更新や再インストールでもデータは残ります。
  - 原文（README）: 变量由后台按规则结算,每轮附更新结果,失败可单独重试;更新与重装都保留数据。
- 前面のモデルは本文を書くことだけを担当し、変数の計算などの作業は後ろのモデルに任せます。
  - 原文（README）: 因为前台模型只管写正文,变量结算等任务性工作交给后台模型。
- シナリオは断片ごとに読み込むので、長い小説でも全体をコンテキストに入れる必要はありません。
  - 原文（README）: 剧本按片段读取,再长的小说也不用整本塞进上下文。
- カードの項目を知らなくても、Agent に気に入らない点と変えたい内容を伝えると、まず案を出し、確認してから書き込みます。
  - 原文（README）: 不用懂卡片字段,告诉 Agent 哪里不喜欢、想改成什么样,它先给方案,你确认后才写入。
- DSH のプラグイン: 酒館は DSH 上で動くため、スマートフォンから使う dsh-pocket や、リモートログインの認証を行う dsh-webui-auth などのほかの DSH プラグインと一緒に使えます。
  - 原文（README）: DSH 插件:酒馆运行在 DSH 上,可以直接安装其他 DSH 插件一起使用,例如手机访问的 dsh-pocket、远程登录认证的 dsh-webui-auth、语音朗读插件等。

## インストール（README からの転記）

以下は [README](https://github.com/flizzywine/dsh-tavern#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```powershell
     $env:DSH_TAVERN_HOST='desktop'; $tavernInstaller=[Text.Encoding]::UTF8.GetString((New-Object Net.WebClient).DownloadData('https://raw.githubusercontent.com/flizzywine/dsh-tavern/main/install.ps1')); Invoke-Expression $tavernInstaller
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```sh
   curl -fsSL 'https://raw.githubusercontent.com/flizzywine/dsh-tavern/main/install.sh' -o /tmp/dsh-tavern-install.sh && DSH_TAVERN_HOST=desktop sh /tmp/dsh-tavern-install.sh
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```powershell
$env:DSH_TAVERN_HOST='cli'; $tavernInstaller=[Text.Encoding]::UTF8.GetString((New-Object Net.WebClient).DownloadData('https://raw.githubusercontent.com/flizzywine/dsh-tavern/main/install.ps1')); Invoke-Expression $tavernInstaller
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

```sh
curl -fsSL 'https://raw.githubusercontent.com/flizzywine/dsh-tavern/main/install.sh' -o /tmp/dsh-tavern-install.sh && DSH_TAVERN_HOST=cli sh /tmp/dsh-tavern-install.sh
```

> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。

## ライセンス

- ライセンス: GNU Affero General Public License v3.0（SPDX: AGPL-3.0）
- 確認先: [LICENSE ファイル](https://github.com/flizzywine/dsh-tavern/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
