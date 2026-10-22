# 「laya」README の要点（原文）｜有料版: 導入提案書テンプレート（Markdown）、工数・見積表、活用・収益化の考え方

## はじめに

NandhaKishorM/laya は 2026-09-18 に GitHub で作成されたリポジトリです。2026-10-10 時点のスター数は 31,976 です。

## README の要点（原文）

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: Multilingual, non-autoregressive System 1 decision engine.
- 原文（README）: With uv, run uv add laya in a uv project or uv pip install laya in a virtual environment. Python 3.10 or newer.
- 原文（README）: Long documents. laya-multilingual reads up to 8,192 tokens with max_len=8192.
- 原文（README）: Laya evaluates typed questions (choice, score, noul) over any state (text, email, ticket or JSON document) in a single forward pass — 33 ms for one question, 7.2 ms/question batched, measured on a T4.
- 原文（README）: Three checkpoints, and a Router that picks between them per request:
- 原文（README）: The Router detects the script and language and sends non-English text to laya-multilingual:
- 原文（README）: predict_batch in the Python HTTP SDK, one POST /v1/systemone/batch for a list of states, results in input order, no splitting and no fallback to single requests (#1297).

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: laya_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#OSS #Python #calibration #classification #huggingface
