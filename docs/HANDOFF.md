# 引き継ぎメモ（2026-10-19 監査・修正）

次の作業者は最初にこれを読むこと。

## ビジネス上の前提（守るべき性質）
- 有料コンテンツ（提案書テンプレ・工数見積・導入手順・MCP設定）は **note の有料エリアでのみ** 提供する。購入者以外が読める場所に置かない。
- GitHub Pages は静的配信。HTML に含めたものは JS で隠しても誰でも読める。サイトには無料部分だけを載せる。
- このリポジトリは public。平文でコミットしたものは誰でも読める。

## 仕組み
| 対象 | 仕組み | ファイル |
|---|---|---|
| Web 記事 | `【Auto Tech Radar PRO限定】` 見出し以降を除去 | `scripts/utils/pro_boundary.mjs` |
| note 原稿 | 有料部分を公開鍵で暗号化（`*_note.paid.enc`、RSA-OAEP-256 + AES-256-GCM、ファイル名を AAD に結合） | `scripts/utils/note_vault.mjs`, `scripts/note_vault.mjs`, `keys/note_vault_public.pem` |
| 復号 | オーナー端末の `~/.auto-tech-radar/note_vault_private.pem` のみ。ランチャーの note 出品時に自動復号（`~/.auto-tech-radar/note_full/`、24時間で自動削除） | `scripts/launcher.mjs`, `scripts/publish_helper.mjs` |
| 送客文 | Zenn/Qiita/X の文面は 1 か所から生成 | `scripts/utils/funnel_copy.mjs` |
| 生成時の検査 | 有料ライン・末尾・ハッシュタグ・有料部分の長さ、Docker イメージ/npm/PyPI の実在確認（レジストリ照会）、README に MCP 記載が無い MCP 設定の拒否、試行上限 6 件、0 件時に Actions 警告 | `scripts/crawl_and_generate.mjs`, `scripts/utils/reference_check.mjs` |
| ノイズ判定 | 生成・X 投稿・noindex・サイトマップで同じ基準 | `scripts/utils/noise_filter.mjs` |
| 出品履歴 | git マージドライバで投稿済みフラグの和集合 | `scripts/merge_publish_history.mjs`, `.gitattributes` |
| テスト | `npm test`（CI でビルド前に実行）。性質の検査＋わざと不具合を入れて監査が止めることの検証＋生成スクリプトのモック実行 | `tests/` |

鍵の作り直し: Actions を一時停止 → `npm run vault:rotate` → `keys/` と `note_drafts/` をコミット → 再開。古い鍵で暗号化された原稿が混ざったら `npm run vault:reseal`。

## 未完了（要対応）
1. **push できない**: Claude GitHub App が auto-tech-radar に未インストール（GitHub 403）。修正はブランチ `claude/upbeat-tesla-7dei50` にコミット済み。
2. **git 履歴に有料本文が平文で残っている**: 127 コミット中 122 で note 原稿の有料部分、12 で Web の有料セクションが読める。消すには main の履歴書き換え＋force push が必要（取り消し不可・全コミットID変更・オーナー端末のクローン作り直し・PR を使わずに取り込む・GitHub キャッシュはサポートへ依頼）。この操作は権限で止められており、オーナーの明示的な許可が必要。
3. **`public/og-card.png` の再生成**: `public/og-card.svg` の「Stripe即時買い切り」は修正済みだが PNG は未更新（作業環境に日本語フォントが無かった）。日本語フォントのある環境で SVG から 1200x630 で再生成する。
4. **オーナーの判断が必要な表示**（事実確認できないため変更していない）:
   - 「想定受託単価」の決め打ち表示（OGP 画像・index/cheatsheet/weekly・Web 記事のビジネス活用アイデア）。根拠（工数×単価）を示すか、外すか。
   - 自社サービスの表現（Layout の「専任エンジニアチームが最短2週間で構築」、リードマグネットの提供ソリューション一覧、contact の予算選択肢）。
   - X 原稿のツイート2の性能値（例「ハルシネーション0％」「APIコスト90％削減」）は自動投稿されない（投稿はツイート1のみ）が未検証。
5. プライバシーポリシー（`src/pages/privacy.astro`）は事実（取得項目・FormSubmit 経由）に基づく最小限の内容。法務確認を推奨。
