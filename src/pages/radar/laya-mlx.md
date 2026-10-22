---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-17"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/mizorewww/laya-mlx"
repoCreatedAt: "2026-09-19"
stars: 6956
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベルと根拠のない比較表現を削除し、README のベンチマーク値（M3 Max）に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "laya-mlx - 重みが公開された型つきの判断モデルを、Apple Silicon でネイティブに動かします"
description: "重みが公開された型つきの判断モデルを、Apple Silicon でネイティブに動かします。"
---

# laya-mlx: 概要

mizorewww/laya-mlx は 2026-09-19 に GitHub で作成されたリポジトリです。2026-10-17 時点のスター数は 6,956 です。

- 重みが公開された型つきの判断モデルを、Apple Silicon でネイティブに動かします。
  - 原文（README）: Open-weight typed decisions, running natively on Apple Silicon.
- MLX によるローカルの推論で、PyTorch・Transformers のランタイム・クラウドの API は使いません。
  - 原文（README）: Local MLX inference, with no PyTorch, Transformers runtime, or cloud API.
- Apple Silicon、Python 3.11 以降、macOS 14 以降が必要です。
  - 原文（README）: Apple Silicon, Python 3.11+, macOS 14+.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- MLX 版は、独自のエンコーダーと判断ヘッド、CPU/GPU のストリーム、dtype、batch_size などの制御を備えます。
  - 原文（README）: MLX keeps its native encoder/decision head, CPU/GPU streams, dtype, row batch_size, pad_to_multiple, native compile=True, and bounded cache_prompts=True controls.
- Rust のトークナイザーと推論の経路は、PyTorch も Transformers も必要としません。
  - 原文（README）: The Rust tokenizer and inference path do not require PyTorch or Transformers.
- 初回の読み込みでチェックポイントをダウンロードし、その後の推論はすべてローカルで行います。
  - 原文（README）: First load downloads the checkpoint; later inference is fully local.
- 追加の extras として serve・mcp・structured・calibration・langchain・langgraph・llamaindex・crewai・agno があります。
  - 原文（README）: Optional extras are serve, mcp, structured, calibration, langchain, langgraph, llamaindex, crewai, and agno.

## インストール（README からの転記）

以下は [README](https://github.com/mizorewww/laya-mlx#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
pip install laya-mlx
```

```python
import laya_mlx as laya

agent = laya.load("aac6fef/laya-mlx")
result = agent.predict(
    "I was billed twice. Please refund the duplicate.",
    {
        "department": {
            "type": "choice",
            "instructions": "Who should handle this?",
            "criteria": ["billing", "technical", "sales"],
        }
    },
)
print(result["answers"]["department"])
```

```bash
pip install 'laya-mlx[demo]'
hf download aac6fef/laya-multilingual-mlx
laya-snake
```

```bash
gh repo clone mizorewww/laya-mlx
cd laya-mlx
uv sync --extra demo
uv run --extra demo laya-snake
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/mizorewww/laya-mlx/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
