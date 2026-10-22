---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-10"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/NandhaKishorM/laya"
repoCreatedAt: "2026-09-18"
stars: 31976
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "laya - 多言語対応の、非自己回帰型の System 1 判断エンジンです"
description: "多言語対応の、非自己回帰型の System 1 判断エンジンです。"
---

# laya: 概要

NandhaKishorM/laya は 2026-09-18 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 31,976 です。

- 多言語対応の、非自己回帰型の System 1 判断エンジンです。
  - 原文（README）: Multilingual, non-autoregressive System 1 decision engine.
- uv を使う場合は、uv のプロジェクトで uv add laya、仮想環境で uv pip install laya を実行します。Python 3.10 以降が必要です。
  - 原文（README）: With uv, run uv add laya in a uv project or uv pip install laya in a virtual environment. Python 3.10 or newer.
- 長い文書: laya-multilingual は max_len=8192 を指定すると 8,192 トークンまで読みます。
  - 原文（README）: Long documents. laya-multilingual reads up to 8,192 tokens with max_len=8192.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- Laya は、型つきの質問（choice・score・noul）を、任意の状態（テキスト・メール・チケット・JSON 文書）に対して 1 回の順伝播で評価します。
  - 原文（README）: Laya evaluates typed questions (choice, score, noul) over any state (text, email, ticket or JSON document) in a single forward pass — 33 ms for one question, 7.2 ms/question batched, measured on a T4.
- 3 つのチェックポイントがあり、Router がリクエストごとにどれを使うかを選びます。
  - 原文（README）: Three checkpoints, and a Router that picks between them per request:
- Router は文字体系と言語を判定し、英語以外の文章を laya-multilingual に送ります。
  - 原文（README）: The Router detects the script and language and sends non-English text to laya-multilingual:
- Python の HTTP SDK の predict_batch は、状態の一覧を 1 回の POST /v1/systemone/batch で送り、入力の順に結果を返します。
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
