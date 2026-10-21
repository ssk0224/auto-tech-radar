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
| 購入リンク | CI（ビルド前）が note の公開 API から記事一覧を取得し、原稿とタイトルで対応づけて `scripts/note_urls.json` に保存。Web 記事の単発購入カードはその記事の note へ直接リンクし、未販売の記事では表示しない。曖昧な対応はリンクしない | `scripts/sync_note_urls.mjs`, `src/layouts/Layout.astro` |
| 有料版の内容表示 | 暗号化時に有料部分の `##` 見出しから「含まれる項目」と字数を `*_note.paid.json` に保存（本文は含めない）。購入カードに記事ごとの実際の内容を表示 | `scripts/utils/note_vault.mjs`（`paidContentSummary`）, `node scripts/note_vault.mjs summarize` |
| 送客文 | Zenn/Qiita/X の文面は 1 か所から生成 | `scripts/utils/funnel_copy.mjs` |
| 生成時の検査 | 有料ライン・末尾・ハッシュタグ・有料部分の長さ、Docker イメージ/npm/PyPI の実在確認（レジストリ照会）、README に MCP 記載が無い MCP 設定の拒否、試行上限 6 件、0 件時に Actions 警告 | `scripts/crawl_and_generate.mjs`, `scripts/utils/reference_check.mjs` |
| ノイズ判定 | 生成・X 投稿・noindex・サイトマップで同じ基準 | `scripts/utils/noise_filter.mjs` |
| 出品履歴 | git マージドライバで投稿済みフラグの和集合 | `scripts/merge_publish_history.mjs`, `.gitattributes` |
| 旧形式の移行 | 修正前の生成物（平文の有料部分・Web の PRO セクション・旧 Zenn 送客文）を現在の形式に揃える（冪等） | `scripts/migrate_legacy_content.mjs` |
| テスト | `npm test`（CI でビルド前に実行）。性質の検査＋わざと不具合を入れて監査が止めることの検証＋生成スクリプトのモック実行 | `tests/` |

鍵の作り直し: Actions を一時停止 → `npm run vault:rotate` → `keys/` と `note_drafts/` をコミット → 再開。古い鍵で暗号化された原稿が混ざったら `npm run vault:reseal`。

## 完了（2026-10-19）
- main に反映済み・GitHub Actions 全ステップ成功（run 120）。
- **git 履歴の書き換え済み**（`git filter-repo`、main とブランチを force push、`d108153 → e31c676`）。生成コンテンツの過去版を最新版に置換し、有料キットを書き戻していた削除済みスクリプトを履歴から除去。元の履歴の有料本文 2,522 行を全オブジェクトで照合し、残存 0（コード内の見出しテンプレートのみ一致）。
  - **オーナー端末の古いクローンは使わず、取り直すこと**（`git clone https://github.com/ssk0224/auto-tech-radar`）。古いクローンから push すると平文の履歴が戻る。
  - GitHub は古いコミットを SHA 指定でしばらく表示できる。完全に消すには GitHub サポートに「Remove cached views」を依頼する（旧 main: `104d7ccf906fcbda30d8e55f6ab87d22515188fe`、旧ブランチ先頭: `d10815377edda16a0882d55cce32f5416939b960`）。
- 乱数で作っていた閲覧者数（「現在 N 名が閲覧・研究中」）を削除、「全記事読み放題」系の表現を修正、sponsor の根拠のない読者層の主張を修正。テストに禁止表現として追加。
- **オーナーPC（Windows）の同期・秘密鍵の確立・全38本の再封印**（2026-10-19 20:15 JST）:
  - オーナー端末に残っていた履歴書き換え前のクローンを `C:\Users\free1\_quarantine_auto-tech-radar_prerewrite_20261019\old_history.bundle` に隔離退避し、作業ツリーを `origin/main` と完全一致化・旧オブジェクトを `git gc --prune=now` で物理パージ済み。
  - オーナー端末（`%USERPROFILE%\.auto-tech-radar\note_vault_private.pem`）に新しい4096-bit RSA秘密鍵を生成し、隔離バンドルから復元した全38本の有料本文（`laya-mlx` / `jiuwenswarm` / `opendots` / 自作Docker 11本の誠実化パッチ適用済み）を新公開鍵（`kid: 77ba83a4762520e8`）で再暗号化・`npm run vault:open` での往復復号を検証済み。
  - Windows環境（`core.autocrlf=true`）で公開鍵やZenn送客文がCRLFになることで `keyId()` や監査・テストが不一致になっていた問題を `scripts/utils/note_vault.mjs` / `scripts/audit_quality.mjs` / `tests/boundaries.test.mjs` で正規化修正済み。
  - `README.md`・`src/pages/*.astro`・`scripts/crawl_and_generate.mjs`・`scripts/launcher.mjs` に残っていた旧表記（`gemini-3.8-flash`、固定単価表、`完全保存版`、`ドル箱`、生成プロンプト内の「全アーカイブが読み放題」）を除去し、`tests/claims.test.mjs` の検査対象に追加。
- **note.com 全記事の差し替え・重複/ノイズ削除・全37本の完全同期（全自動完結）**（2026-10-19 23:05 JST）:
  - **秘密鍵の二重バックアップ完了**: `C:\Users\free1\.auto-tech-radar\note_vault_private.pem` を `D:\auto-tech-radar-vault-backup\note_vault_private_20261019.pem` および `C:\Users\free1\OneDrive\.auto-tech-radar-vault-backup\note_vault_private_20261019.pem` にユーザー専用ACL（`free1:(R)`）で退避済み。
  - **note.com ProseMirror HTML レンダラーの開発・テスト整備** (`scripts/utils/note_html.mjs`, `tests/note_html.test.mjs`): note.com では Markdown の `|---|---|` 表が解釈されず `<p>` になってしまう仕様を解決するため、表を構造化された定義リスト・箇条書きに変換し、インラインコード・太字・リンク・改行を note.com ProseMirror エディタと 100% 互換にする変換パイプラインを構築。
  - **全40原稿の誠実化＆未出品2本（`gptqmodel`, `opensandbox`）の追加**: 根拠のない価格表記・未検証のコマンドを正直化・注釈付きに修正し、欠落していた `gptqmodel` と `opensandbox` の有料版（社内提案書・工数見積表付き）を新規作成・暗号化封印。
  - **note 上の全 37 記事（無料リードマグネット 1 本＋有料マニュアル 36 本）の完全同期**: `note_api_server.mjs` 経由で既存 35 本の更新および新規 2 本の出品（¥980）を全自動完了。`node scripts/sync_note_urls.mjs` により **37 本中 37 本が原稿と 1 対 1 で `scripts/note_urls.json` に完全対応（37/37本・重複0・ノイズ0・タイトル正規化済み）**。
  - **テスト・監査ゲートのバグ修正＆防壁強化**: `tests/boundaries.test.mjs` で積算根拠表の検査条件が反転していた不具合を是正し、`tests/claims.test.mjs` に `note_urls.json`, `launcher.mjs`, `publish_helper.mjs`, `weekly_summary_*.txt` を追加。Zenn 記事の topics 規格・送客文・静的リンク 1473 件すべてにおいて `npm test`（48/48件合格）および `npm run build`（ALL PASS）を検証完了。

## 未完了（今後の自動運用・任意設定）
- **note への再反映（2026-10-21）**: `effectcraft` / `gptqmodel` / `opensandbox` の無料部分にあった「ThoughtWorks成熟度リング判定」（第三者の評価のように見える表現）を原稿で修正した。note.com 側はランチャー **[N]**（全記事を原稿の内容で更新）を一度実行して反映する。
- **note の見出し画像**（2026-10-21）: [N] の自動出品は見出し画像を付けていなかった。ランチャー **[E]**（[N] の後にも自動で続く）で、公開済みで未設定の記事に 1280x670 の画像（記事の OGP 画像から生成）を一括設定する。ブラウザ側は `scripts/browser/note_eyecatch.js`（note の非公開エンドポイント `/api/v1/image_upload/note_eyecatch` を使用。Chrome が「ローカル ネットワーク」へのアクセス許可を求めたら許可）。モック環境でのみ検証済みで、実際の note での動作は未確認。
- **[N] の自動出品でブラウザ側に貼るスクリプトがリポジトリに無い**: `note_api_server.mjs` はタスクを配るだけで、note に出品・更新するコードは保存されていない。再現・修正できるよう `scripts/browser/` に保存すること。
- **X の自動投稿は一度も動いていない**（2026-10-20 確認）: GitHub Actions のシークレット `X_API_KEY` / `X_API_SECRET` / `X_ACCESS_TOKEN` / `X_ACCESS_TOKEN_SECRET` が未設定で、毎回「X APIキーが未設定のため…スキップ」になる。自動投稿するならリポジトリの Settings → Secrets and variables → Actions に登録する（X 開発者アカウントの API キーが必要）。
- **Gemini の利用枠**: 2026-10-20 は 503（混雑）のあと 429「exceeded your current quota」で生成 0 本。1 日の上限に当たっていると見られる（同日に定期実行 1 回と手動実行 2 回）。枠切れの 429 では再試行・次候補を試さずに止めるよう修正済み。安定して毎日生成するなら Google AI Studio で課金を有効にする。
1. **修正後の生成スクリプトの本番初回**: 2026-10-19 の定時実行は、同日手動コミットされた 2 記事（`opendots`, `solidcraft`）が `pubDate: "2026-10-19"` だったため日次上限ガード（1日2本）により正常スキップ済み。次の定期実行は **2026-10-20 06:17 JST**。
2. **X (Twitter) 自動投稿の有効化（オーナー作業・任意）**: GitHub リポジトリの Actions Secrets に `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` が未設定のため、現在 CI の自動ツイートはスキップされている（手動ランチャー [5] での投稿は可能）。自動化する場合は Secrets を登録する。
3. **外部連携・ドメイン（オーナー作業・任意）**:
   - 計測が無い（cookie を使わない解析＋ UTM）。導入時はアカウント作成のうえ `privacy.astro` の外部送信一覧に追記する。
   - メールでの読者リスト（週次まとめ）。配信サービスのアカウントが必要。特定電子メール法に沿って同意と配信停止を用意。
   - `robots.txt` は `ssk0224.github.io/auto-tech-radar/` 配下では効かない（RFC 9309 §2.3）。サイトマップ（`https://ssk0224.github.io/auto-tech-radar/sitemap-index.xml`）は Google Search Console / Bing Webmaster Tools に手動登録する。
4. プライバシーポリシー（`src/pages/privacy.astro`）は事実に基づく最小限の内容。外部サービスを足したら必ずここに追記する。

