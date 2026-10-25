---
layout: "../../layouts/Layout.astro"
title: "laya - README の要点（原文）"
description: "NandhaKishorM/laya の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。"
pubDate: "2026-10-10"
updatedDate: "2026-10-22"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/NandhaKishorM/laya"
repoCreatedAt: "2026-09-18"
stars: 31976
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
  - date: "2026-10-22"
    note: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります"
---

# laya: 概要

NandhaKishorM/laya は 2026-09-18 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 31,976 です。

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Multilingual, non-autoregressive System 1 decision engine.
- 原文（README）: With uv, run uv add laya in a uv project or uv pip install laya in a virtual environment. Python 3.10 or newer.
- 原文（README）: Long documents. laya-multilingual reads up to 8,192 tokens with max_len=8192.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の原文）

- 原文（README）: Laya evaluates typed questions (choice, score, noul) over any state (text, email, ticket or JSON document) in a single forward pass — 33 ms for one question, 7.2 ms/question batched, measured on a T4.
- 原文（README）: Three checkpoints, and a Router that picks between them per request:
- 原文（README）: The Router detects the script and language and sends non-English text to laya-multilingual:
- 原文（README）: predict_batch in the Python HTTP SDK, one POST /v1/systemone/batch for a list of states, results in input order, no splitting and no fallback to single requests (#1297).

## インストール（README からの転記）

以下は [README](https://github.com/NandhaKishorM/laya#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
python -m pip install laya
```

```python
from laya import Router

router = Router()  # downloads a checkpoint on first use; Router(preload=True) loads all three up front

state = "Hi, we were billed twice for March. Please refund the duplicate today or we will cancel our plan."
questions = {
    "department": {"type": "choice", "instructions": "Which department should handle this?",
                   "criteria": {"billing": "invoices, payments, refunds",
                                "technical": "bugs, outages, system errors",
                                "other": "everything else"}},
    "urgency": {"type": "score", "instructions": "How urgent is this?",
                "criteria": ["not urgent", "soon", "blocking"]},
    "churn_risk": {"type": "noul", "instructions": "Does the user threaten to cancel or leave?"},
}

result = router.predict(state, questions)
print(result["answers"]["department"]["choice"])  # billing
print(result["answers"]["churn_risk"]["noul"])    # probability the answer is yes
print(result["routing"]["model"])                 # english
```

```python
for text in ["मुझसे मार्च में दो बार शुल्क लिया गया, कृपया डुप्लिकेट राशि वापस करें।",
             "La aplicación se cierra cada vez que abro la configuración."]:
    r = router.predict(text, {"department": questions["department"]})
    print(r["routing"]["model"], r["answers"]["department"]["choice"])
# multilingual billing
# multilingual technical
```

```bash
python -m pip install laya
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/NandhaKishorM/laya/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
