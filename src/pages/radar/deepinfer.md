---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-21"
tags: ["Python","OSS","GitHub"]
repoUrl: "https://github.com/deepseek-ai/DeepInfer"
repoCreatedAt: "2026-10-16"
stars: 12071
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "採用判定のラベル・導入を勧める表現と根拠のない性能比較を削除し、README の記載に基づく記述に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "DeepInfer - このオープンソース版は、大規模な提供に必要な中核機能を備えたオフライン推論を提供します"
description: "このオープンソース版は、大規模な提供に必要な中核機能を備えたオフライン推論を提供します。"
---

# DeepInfer: 概要

deepseek-ai/DeepInfer は 2026-10-16 に GitHub で作成されたリポジトリです。2026-10-21 時点のスター数は 12,071 です。

- このオープンソース版は、大規模な提供に必要な中核機能を備えたオフライン推論を提供します。
  - 原文（README）: This open-source release provides offline inference with the core features needed for serving at scale.
- NVIDIA SM100 GPU に対応しています。
  - 原文（README）: NVIDIA SM100 GPUs
- Huawei Ascend 950 NPU に対応しています。
  - 原文（README）: Huawei Ascend 950 NPUs

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- チューニングされたカーネルとして、FlashMLA、DeepGEMM、DeepEP、TileKernels、DeepSelect と独自の TileLang カーネルを使います。
  - 原文（README）: Optimized kernels: FlashMLA, DeepGEMM, DeepEP, TileKernels, DeepSelect, and custom TileLang kernels.
- DSpark と信頼度に基づく検証: ドラフトトークンでデコードを速め、信頼度の推定で検証の時期を決めます。
  - 原文（README）: DSpark and confidence-scheduled verification: accelerate decoding with draft tokens and use confidence estimates to schedule verification.
- 非同期スケジューリング: CPU でのバッチのスケジューリングとデバイスでの実行を重ねます。既定で有効です。
  - 原文（README）: Asynchronous scheduling: overlap CPU batch scheduling with device execution. Enabled by default.
- バッチ不変の推論: バッチの構成が違ってもモデルの結果を同じに保ちます。
  - 原文（README）: Batch-invariant inference: keep model results identical across different batch compositions.
- 構造化出力: 生成を正規表現・JSON スキーマ・EBNF 文法に沿うよう制約します。
  - 原文（README）: Structured outputs: constrain generation to a regex, JSON schema, or EBNF grammar.

## インストール（README からの転記）

以下は [README](https://github.com/deepseek-ai/DeepInfer#readme) のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。

```bash
# Use `ascend` instead for the Ascend platform
# Keep it exported in the environment where you run DeepInfer
export DEEPINFER_ACCELERATOR=nvidia
./build.sh
```

```bash
python examples/offline_inference.py
```

## ライセンス

- ライセンス: Apache License 2.0（SPDX: Apache-2.0）
- 確認先: [LICENSE ファイル](https://github.com/deepseek-ai/DeepInfer/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
