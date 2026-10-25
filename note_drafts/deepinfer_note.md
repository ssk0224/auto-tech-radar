# 「DeepInfer」README の要点（原文）｜有料版: 導入提案書テンプレート（Markdown）、工数・見積表、活用・収益化の考え方、導入時の想定問答

## はじめに

deepseek-ai/DeepInfer は 2026-10-16 に GitHub で作成されたリポジトリです。2026-10-21 時点のスター数は 12,071 です。

## README の要点（原文）

以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。

- 原文（README）: This open-source release provides offline inference with the core features needed for serving at scale.
- 原文（README）: NVIDIA SM100 GPUs
- 原文（README）: Huawei Ascend 950 NPUs
- 原文（README）: Optimized kernels: FlashMLA, DeepGEMM, DeepEP, TileKernels, DeepSelect, and custom TileLang kernels.
- 原文（README）: DSpark and confidence-scheduled verification: accelerate decoding with draft tokens and use confidence estimates to schedule verification.
- 原文（README）: Asynchronous scheduling: overlap CPU batch scheduling with device execution. Enabled by default.
- 原文（README）: Batch-invariant inference: keep model results identical across different batch compositions.
- 原文（README）: Structured outputs: constrain generation to a regex, JSON schema, or EBNF grammar.

### 🔒 有料エリアの内容
- 導入提案書テンプレート（Markdown）
- 工数・見積表
- 活用・収益化の考え方
- 導入時の想定問答

> 💡 **【価格と経費精算について】**
> 本記事の価格は **980円** です。
> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
<!-- PAID_SEALED: deepinfer_note.paid.enc 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#OSS #Python #GitHub
