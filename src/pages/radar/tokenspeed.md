---
layout: "../../layouts/Layout.astro"
pubDate: "2026-10-09"
tags: ["Python","OSS","GitHub","LLM","Inference"]
repoUrl: "https://github.com/lightseekorg/tokenspeed"
repoCreatedAt: "2026-05-06"
stars: 2201
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-21"
    note: "TensorRT-LLM との性能比較の記述を README の記載（TensorRT-LLM レベルの性能を掲げ、最も高性能なエンジンになることを目標とする）に合わせて訂正。比較表の TensorRT-LLM のライセンスを Apache 2.0 に訂正"
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
  - date: "2026-10-22"
    note: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました"
title: "tokenspeed - スケジューラーは、C++ の制御プレーンと Python の実行プレーンでできています"
description: "スケジューラーは、C++ の制御プレーンと Python の実行プレーンでできています。"
---

# tokenspeed: 概要

lightseekorg/tokenspeed は 2026-05-06 に GitHub で作成されたリポジトリです。2026-10-09 時点のスター数は 2,201 です。

- スケジューラーは、C++ の制御プレーンと Python の実行プレーンでできています。
  - 原文（README）: Scheduler: C++ control plane and Python execution plane.
- 実行プレーンは Python で実装されており、研究者やエンジニアが素早く試行を繰り返せます。
  - 原文（README）: The execution plane is implemented in Python, enabling fast iteration and lowering the cognitive load for researchers and engineers.
- 入口は SMG と統合した AsyncLLM で、CPU 側のリクエスト処理の負荷を抑えます。
  - 原文（README）: Entrypoint: SMG-integrated AsyncLLM for low-overhead CPU-side request handling.

## 🎯 成熟度の目安（README の記載）

README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。

## 主な機能と構成（README の要約）

- リクエストのライフサイクル・KV キャッシュの所有・処理の重なりのタイミングを有限状態機械として表し、KV リソースの安全な再利用をコンパイル時に型システムで保証します。
  - 原文（README）: Request lifecycle, KV cache ownership, and overlap timing are encoded as a finite-state machine, with safe KV resource reuse enforced by the type system at compile time.
- TokenSpeed はカーネルをモジュール化されたサブシステムとして扱い、移植可能な公開 API と集中管理の登録簿を通じて中核のエンジンから切り離しています。
  - 原文（README）: TokenSpeed also treats kernels as a first-class, modular subsystem, separating them from the core engine through a portable public API, centralized registry and selection model, and an extensible plugin mechanism for heterogeneous accelerators.

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/lightseekorg/tokenspeed#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/lightseekorg/tokenspeed/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
