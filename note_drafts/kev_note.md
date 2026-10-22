# 海外急上昇OSS「kev」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに

jaredpalmer/kev は 2026-09-18 に GitHub で作成されたリポジトリです。2026-10-14 時点のスター数は 9,128 です。

## 主な機能とアーキテクチャ概要

- 自分で学習・実行できる、Jev に似た小さな判断モデルです。
  - 原文（README）: Small Jev-like decision models you can train and run yourself.
- Kev は、Qwen3.5 と Qwen3.8 をもとに、Jev's Architecture Unmasked に書かれた構成にならって作られた小さな判断モデルの系列です。
  - 原文（README）: Kev is a family of small decision models built on Qwen3.5 and Qwen3.8 and based on the architecture described in Jev's Architecture Unmasked.
- API は TypeSafe の System One と同じ形なので、その Python SDK を手元のサーバーに向けて使えます。
  - 原文（README）: The API matches TypeSafe's System One, so you can point their Python SDK at your local server.
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

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: kev_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub
