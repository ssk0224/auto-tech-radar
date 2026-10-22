---
layout: "../../layouts/Layout.astro"
title: "AIHOT - 業界特化型AIトレンド自動収集・日報生成ポータル基盤"
description: "情報源とキュレーション基準を定義するだけで自社専用の業界ホットサイトを構築。2段階LLMスコアリングとクラスタリングを統合した自動要約・日報生成オープンソース基盤。"
pubDate: "2026-10-16"
tags: ["TypeScript", "OSS", "GitHub"]
repoUrl: "https://github.com/KKKKhazix/AIHOT"
repoCreatedAt: "2026-09-29"
stars: 7887
updatedDate: "2026-10-22"
corrections:
  - date: "2026-10-22"
    note: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました"
---

# AIHOT: 概要

KKKKhazix/AIHOT は 2026-09-29 に GitHub で作成されたリポジトリです。2026-10-16 時点のスター数は 7,887 です。

**AIHOT**は、指定した複数の情報源から自動で最新情報を収集し、大規模言語モデル（LLM）を用いて重複排除・多段階スコアリング・要約を行い、業界特化型のポータルサイトや自動日報・週報・月報を生成するフルスタックWebフレームワークです。

従来のRSSリーダーや情報集約スクリプトと決定的に異なるのは、単なる情報の集約（アグリゲーション）にとどまらず、**「専門家レベルの選定ノウハウ（Know-How）をプロンプトとして組み込める選別パイプライン」**と**「同一ニュースの複数メディア報道を束ねるイベントクラスタリング機能」**を標準実装している点です。

### 解決する主要な課題
1. **情報過多によるキュレーションコストの肥大化**:
   業界ニュースを網羅しようとすると、公式発表・テック系メディア・SNS（X/Twitter）・専門ポータルなど同一事象に関する重複記事が溢れ、人間による手動選別に多大な工数がかかっていました。
2. **LLM要約におけるハルシネーションと品質のバラつき**:
   1回のLLM呼び出しだけで要約と評価を行うと、宣伝記事の過大評価や誤認が発生しがちでした。AIHOTは同一基準に対して**独立した2回のスコアリング**を行い、一定のしきい値を超えたものだけを厳選するセーフティネットを敷いています。
3. **最新AI Agentへの対応（MCP / llms.txt）**:
   人間がWebブラウザで閲覧するだけでなく、自律型AI Agentが最新業界動向を参照できるように、MCP、Agent Markdown、`llms.txt`、REST APIなどのインターフェースをネイティブ提供しています。

## 解決する主要な課題とアーキテクチャ

AIHOTは、高スループットな非同期ジョブキュー（`pg-boss`）とPostgreSQL、Node.js 24、Fastify、React Router（SSR）を中核に据え、README の実測値として、ページの 95% を 50 毫秒（50ms）以内に返すと記載されています。

```mermaid
graph TD
    subgraph DataSources ["多重インジェスト層"]
        RSS["RSS / Atom フィード"]
        Web["Webスクレイピング / HTML"]
        API["JSON API / Webhook"]
        SNS["X / SNS アカウント"]
    end

    subgraph Pipeline ["パイプライン処理 pg-boss & LLM"]
        Dedup[URL・ハッシュによる重複排除]
        PreFilter[軽量事前フィルタリング]
        Score1[LLM 独立評価 1回目]
        Score2[LLM 独立評価 2回目]
        Threshold{スコア判定 / 階層別しきい値}
        Cluster["ベクトル類似度 / イベントクラスタリング"]
        Write[タイトル・要約・タグ自動生成]
    end

    subgraph Storage ["データ永続化"]
        PG[("PostgreSQL 17 / pgvector")]
    end

    subgraph Output ["マルチチャネル出力"]
        Portal[Webポータル SSR Fastify 10ms]
        Reports["日報 / 週報 / 月報 自動編纂"]
        AgentInfra["Agent連携: MCP / llms.txt / REST API"]
    end

    DataSources --> Dedup
    Dedup --> PreFilter
    PreFilter --> Score1
    Score1 --> Score2
    Score2 --> Threshold
    Threshold -- 合格 --> Cluster
    Threshold -- 却下 --> Drop["アーカイブ/破棄"]
    Cluster --> Write
    Write --> PG
    PG --> Portal
    PG --> Reports
    PG --> AgentInfra
```

### アーキテクチャのハイライト
- **独立多段階評価アーキテクチャ**:
  `industry/prompts/selection-score.md` に記載されたドメイン固有の評価基準に基づき、同一記事を独立して2回スコアリング。公式1次ソース、準公式、メディア/個人といった情報源の格付け（Tier 1〜3）に応じて通過基準を動的に変更します。
- **イベントベースのクラスタリングと熱度（Hotness）アルゴリズム**:
  同一トピックに関して48時間以内に報じられた記事を1つの「イベント」に束ねます。熱度スコアは「記事の数」ではなく「言及している独立ソースの数」をベースに算出され、24時間で半減期を迎える減衰ロジックを採用しているため、特定のPRメディアによる連投スパムを自然に無効化します。
- **高速SSRとエッジフレンドリーな設計**:
  Fastify + React Router SSRを採用し、README には、ページの中央値 10ms・API の中央値 6ms という実測値が記載されています。

## インストール（README からの転記）

README にインストール手順のコードブロックが見つかりませんでした。導入方法は [README](https://github.com/KKKKhazix/AIHOT#readme) を確認してください。

## ライセンス

- ライセンス: MIT License（SPDX: MIT）
- 確認先: [LICENSE ファイル](https://github.com/KKKKhazix/AIHOT/blob/main/LICENSE)

この節はライセンスの名称と確認先を示すもので、法的な助言ではありません。利用の可否は、LICENSE ファイルの本文と利用する状況に照らして確認してください。
