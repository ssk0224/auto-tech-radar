---
layout: "../../layouts/Layout.astro"
title: "dsh-our-free-model - README の要点（原文）"
description: "Ebony-Vinyl/dsh-our-free-model の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-13"
updatedDate: "2026-10-22"
tags: ["JavaScript","OSS","GitHub"]
repoUrl: "https://github.com/Ebony-Vinyl/dsh-our-free-model"
repoCreatedAt: "2026-09-25"
stars: 12121
corrections:
  - date: "2026-10-21"
    note: "根拠のない価格比較の表現を訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# dsh-our-free-model: 概要

Ebony-Vinyl/dsh-our-free-model は 2026-09-25 に GitHub で作成されたリポジトリです。2026-10-13 時点のスター数は 12,121 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: All you do is install this plugin in dsh: no login, no sign-up, no API key, nothing else.
- 原文（README）: 纯插件挂载:不改内核、无构建步骤、零依赖。
- 原文（README）: 清单跟随上游——模型集合、上下文长度与能力在每次刷新时向上游重新拉取,插件内不保存静态快照。

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: 应用内升级——设置页一键升级:下载 → SHA-256 校验 → 备份 → 原子替换 → 校验回读 → 热重载,任一步失败自动回滚至上一版本。
- 原文（README）: 用量看板,数据全部留在本机——Token 热力图、总量曲线(支持总计与单模型视图)、输出速度与首字延迟逐次采样。 不上传任何数据。
- 原文（README）: OpenAI 兼容转发端口——本机其它工具通过 base URL 与 Key 即可调用这些模型。
- 原文（README）: 独立服务默认使用 ~/.our-free-model 和端口 18900,拥有自己的 API Key, 不读取插件数据。
- 原文（README）: ⚠️ 不要通过 npm 安装本插件。 npm 上的 dsh-our-free-model 包不是本仓库发布的。

## インストール（README からの転記）

以下は [README](https://github.com/Ebony-Vinyl/dsh-our-free-model#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```
dsh plugin --profile web add /绝对路径/dsh-our-free-model
```

```
PROFILE_UPGRADE_REQUIRED: offline dependency migration is not yet available
```

```
node -e "
const g = require('/sidecar/dist/lib/profile-upgrade.js');
const app = '', profile = '/profiles/';
console.log(g.planProfileUpgrade(app, profile));
g.assertProfileStartup(app, profile);
console.log('startup gate: PASS');
"
```

```
DSH_HOME= dsh --profile  --dump-config | grep our-free-model
```

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/Ebony-Vinyl/dsh-our-free-model/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
