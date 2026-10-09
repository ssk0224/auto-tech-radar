---
layout: "../../layouts/Layout.astro"
title: "mediawiki - 🌻 The collaborative editing software that runs Wikipedia. Mirror from https://gerrit.wikimedia.org/g/mediawiki/core. See https://mediawiki.org/wiki/Developer_access for contributing."
description: "🌻 The collaborative editing software that runs Wikipedia. Mirror from https://gerrit.wikimedia.org/g/mediawiki/core. See https://mediawiki.org/wiki/Developer_access for contributing."
pubDate: "2026-10-09"
tags: ["PHP", "OSS", "GitHub"]
repoUrl: "https://github.com/wikimedia/mediawiki"
stars: 5203
---

# mediawiki: 概要と革新性

**MediaWiki**は、月間数十億PVを誇る世界最大の百科事典「Wikipedia」およびウィキメディア各プロジェクトの中核基盤として稼働しているオープンソースのナレッジ共有プラットフォームです。

PHPで書かれ、350以上の多言語対応と比類のない堅牢性を備えています。MediaWikiの革新性は、**「完全な分散型コラボレーション編集環境」**と**「極限までのスケーラビリティ」**を両立させている点にあります。何千人もの編集者が同時に差分を更新しても破綻しない排他制御・履歴追跡システム、そして数億人規模の読者トラフィックをキャッシュレイヤー経由で捌くアーキテクチャは、Web黎明期から現代に至るまで分散Webシステムの金字塔として進化を続けています。

---

## 解決する主要な課題とアーキテクチャ

### 1. 解決する課題
- **ナレッジの属人化と改ざんリスク**: 全編集履歴の不変性（イミュータブルな差分管理）により、誰が・いつ・何を編集したかを1クリックで追跡・復元可能。
- **超大規模トラフィックと同時編集のコンフリクト**: 多数のユーザーが同一ドキュメントを同時修正する際の競合を自動/半自動で調停。
- **多言語・大規模ドメイン展開のコスト**: 350以上の言語サポートと柔軟な名前空間（Namespaces）管理により、グローバルな情報集約を単一システムで完結。

### 2. コアアーキテクチャ
MediaWikiはLAMP/LEMPスタックを基盤としつつ、極めて洗練された多層分散キャッシュ構造を採用しています。

- **コアエンジン (PHP)**: 構文解析（Wikitext / Parsoid）、パーミッション制御、イベントフックシステムを提供。
- **ストレージ & DB**: MySQL/MariaDBまたはPostgreSQL。ページ本体のメタデータと、履歴差分テキストを分離して最適化保存。
- **キャッシュレイヤー**: Redis/Memcached（オブジェクト・セッション管理）とVarnish/CDNを組み合わせることで、動的リクエストを最小化。
- **拡張性 (Extensions & Hooks)**: 800以上の公式・非公式拡張機能（Semantic MediaWiki、REST API、VisualEditor等）により、単なるWikiを超えたナレッジベースへ拡張可能。

---

## 競合ツール/商用SaaSとの徹底比較

| 項目 | MediaWiki | Notion / Confluence (商用SaaS) | Docusaurus / MkDocs |
| :--- | :--- | :--- | :--- |
| **データ所有権** | **完全なセルフホスト（完全自社管理）** | ベンダーロックインあり | Gitベース（静的ホスティング） |
| **ライセンスコスト** | **無料（オープンソース）** | ユーザー数課金（月額数百〜数千円/人） | 無料（静的生成） |
| **共同編集・履歴管理** | **超大規模な差分追跡・トークページ機能** | リアルタイムだが大規模監査には不向き | Git履歴ベース（開発者向け） |
| **スケーラビリティ** | **数千万PV/月の大規模対応実績あり** | SaaS側のプラン・制限に依存 | 静的配信のため高負荷に強いが更新頻度に限界 |
| **学習コスト** | 中（Wikitext記法・サーバー運用知識が必要） | 低（直感的なリッチUI） | 中（Markdown + Git運用） |

---

## 💡 ビジネス・マネタイズ活用アイデア（実践例）

### 1. 企業内「セキュア・ナレッジベース」構築受託（情シス向け）
- **対象**: 社内情報漏洩を極度に警戒する製造業、金融機関、医療機関。
- **提案**: クラウドSaaS（Notion等）にアップロードできない機密マニュアルや特許情報、社内技術手順をオンプレミス/プライベートクラウド環境のMediaWikiで構築。LDAP/SAML認証連携をセットアップして納品（単価: 80万〜150万円）。

### 2. 業界特化型バーティカルWikiメディアの運営
- **対象**: ゲーム攻略、専門資格、BtoB特定産業（医療機器・法務ガイドなど）。
- **マネタイズ**: SEO集客力に優れたMediaWikiを用いてコミュニティ主導型ナレッジサイトを構築。プログラマティック広告（AdSense）および専門企業からのスポンサードリンク・タイアップ記事で収益化。

### 3. LLM/社内AI向け「グラウンディング用RAGナレッジレポジトリ」の構築
- **概要**: MediaWikiのAPIを活用し、社内Wikiを自社生成AI（RAGシステム）の一次情報ソースとして整備。社内ドキュメントのバージョン履歴が明確なため、ハルシネーション（嘘の出力）を抑止するデータストアとして販売。

---

## インストール & クイックスタート手順

Docker環境を利用して、MediaWikiを即座にローカル起動する手順です。

### 1. `docker-compose.yml` の作成
```yaml
version: '3.8'

services:
  mediawiki:
    image: mediawiki:stable
    restart: always
    ports:
      - "8080:80"
    links:
      - database
    volumes:
      - mw_images:/var/www/html/images
    environment:
      MW_SITE_NAME: "MyPrivateWiki"

  database:
    image: mariadb:10.5
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: my_wiki
      MYSQL_USER: wikiuser
      MYSQL_PASSWORD: wikipassword
    volumes:
      - db_data:/var/lib/mysql

volumes:
  mw_images:
  db_data:
```

### 2. 起動と初期セットアップ
```bash
# コンテナの立ち上げ
docker-compose up -d

# ブラウザでアクセス
open http://localhost:8080
```
画面の指示に従いデータベース接続設定（ホスト名: `database`, DB名: `my_wiki`, ユーザー: `wikiuser`, パスワード: `wikipassword`）を入力すると、`LocalSettings.php` が生成されます。これをコンテナ内 `/var/www/html/LocalSettings.php` に配置することでセットアップ完了です。

---

## 商用利用可否 & ライセンス考察

MediaWikiは **GNU General Public License (GPL) v2.0 or later** でライセンスされています。

- **商用利用（社内利用・SaaS裏方利用）**: 完全無料かつ制限なく商用利用可能です。社内ナレッジベースとしての運用や、外部公開サイトとして広告収益を得る行為は全く問題ありません。
- **再配布とソースコード公開義務（コピーレフト）**: MediaWikiのコアコードを改変して外部へ「配布・販売」する場合、改変したソースコードをGPLv2に基づいて公開する義務が発生します。
- **プライベート利用の特例**: 自社サーバー上でのみ稼働させ、外部にソフトウェアそのものを配布しない場合（いわゆるASP/社内利用）、コードを公開する義務は生じません（AGPLではなくGPLであるため）。自社専用ナレッジツールとしての構築・受託は安心して展開可能です。