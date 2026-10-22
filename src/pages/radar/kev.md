---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-14"
tags: ["Python","OSS","GitHub","LLM","AI"]
repoUrl: "https://github.com/jaredpalmer/kev"
repoCreatedAt: "2026-09-18"
stars: 9128
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "kev - 自分で学習・実行できる、Jev に似た小さな判断モデルです"
description: "自分で学習・実行できる、Jev に似た小さな判断モデルです。"
---

# kev: 概要

jaredpalmer/kev は 2026-09-18 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 9,128 です。

- 自分で学習・実行できる、Jev に似た小さな判断モデルです。
  - 原文（README）: Small Jev-like decision models you can train and run yourself.
- Kev は、Qwen3.5 と Qwen3.8 をもとに、Jev's Architecture Unmasked に書かれた構成にならって作られた小さな判断モデルの系列です。
  - 原文（README）: Kev is a family of small decision models built on Qwen3.5 and Qwen3.8 and based on the architecture described in Jev's Architecture Unmasked.
- API は TypeSafe の System One と同じ形なので、その Python SDK を手元のサーバーに向けて使えます。
  - 原文（README）: The API matches TypeSafe's System One, so you can point their Python SDK at your local server.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- はい・いいえ（noul）、選択式（choice）、評価（score）の質問を 1 回のリクエストで扱います。質問は同じ文書を共有しますが、互いの内容は読めません。
  - 原文（README）: Yes/no (noul), multiple-choice (choice) and rating (score) questions in one request. The questions share the text but can't read each other.
- 既定で較正された確率を返します。各チェックポイントには調整済みの temperature が付いています。
  - 原文（README）: Calibrated probabilities by default: each checkpoint ships with a fitted temperature.
- 最大 65,536 トークンの文書を、CUDA と、MLX を通じて Apple Silicon で扱えます。
  - 原文（README）: Documents of up to 65,536 tokens, on CUDA and on Apple Silicon through MLX.
- 自分でラベルを付けた例でファインチューニングできます。
  - 原文（README）: Fine-tune on your own labelled examples.
- 1 つのコマンドで自分の HTTPS エンドポイントをデプロイでき、使われていないときは 0 まで縮小します。
  - 原文（README）: Deploy your own HTTPS endpoint with one command. It scales to zero when idle.

## インストール（README からの転記）

以下は [README](https://github.com/jaredpalmer/kev#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
git clone https://github.com/jaredpalmer/kev.git && cd kev
uv sync --extra serve
uv run --extra serve python -m kev.serve --run jaredpalmer/kev-4b --port 8009
```

```bash
curl -s localhost:8009/v1/systemone -H 'content-type: application/json' -d '{
  "state": "Shoes arrived two weeks late and in the wrong size. Also I see two charges on my card.",
  "model": "kev-latest",
  "questions": {
    "department":  {"type": "choice", "instructions": "Which team should handle this?",
                    "criteria": {"returns": "Exchanges, refunds, wrong or damaged items",
                                 "shipping": "Delivery status, delays, lost packages",
                                 "billing": "Charges, invoices, payment problems"}},
    "escalate":    {"type": "noul",  "instructions": "Does this need urgent human attention?"},
    "frustration": {"type": "score", "instructions": "How frustrated is the customer?",
                    "criteria": ["Calm", "Frustrated", "Very angry"]}
  }}'
```

```json
{
  "model": "kev-latest",
  "answers": {
    "department":  { "type": "choice", "choice": "returns", "confidence": 0.21,
                     "probabilities": { "returns": 0.47, "shipping": 0.28, "billing": 0.25 } },
    "escalate":    { "type": "noul", "noul": 0.93 },
    "frustration": { "type": "score", "score": 1.44, "confidence": 0.34,
                     "legend": { "0": "Calm", "1": "Frustrated", "2": "Very angry" },
                     "probabilities": { "0": 0.00, "1": 0.56, "2": 0.44 } }
  },
  "usage": { "input_tokens": 101, "output_tokens": 161 },
  "latency_ms": 495
}
```

```python
from typesafe_sdk import Choice, Noul, Score, TypeSafeClient

client = TypeSafeClient(
    api_key="local",
    base_url="http://127.0.0.1:8009",
    model="kev-latest",
)
response = client.system_one(
    state="I was charged twice. Please fix this ASAP.",
    questions={
        "billing": Noul(instructions="Is this ticket about billing?"),
        "tone": Choice(
            instructions="What is the customer's tone?",
            criteria={"calm": None, "frustrated": None, "angry": None},
        ),
        "urgency": Score(
            instructions="How urgent is this ticket?",
            criteria=["can wait", "this week", "today"],
        ),
    },
)
print(response.nouls["billing"].noul)
print(response.choices["tone"].choice)
print(response.scores["urgency"].score)
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/jaredpalmer/kev/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
