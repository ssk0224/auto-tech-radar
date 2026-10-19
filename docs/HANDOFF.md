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
| 旧形式の移行 | 修正前の生成物（平文の有料部分・Web の PRO セクション・旧 Zenn 送客文）を現在の形式に揃える（冪等） | `scripts/migrate_legacy_content.mjs` |
| テスト | `npm test`（CI でビルド前に実行）。性質の検査＋わざと不具合を入れて監査が止めることの検証＋生成スクリプトのモック実行 | `tests/` |

鍵の作り直し: Actions を一時停止 → `npm run vault:rotate` → `keys/` と `note_drafts/` をコミット → 再開。古い鍵で暗号化された原稿が混ざったら `npm run vault:reseal`。

## 完了（2026-10-19）
- main に反映済み・GitHub Actions 全ステップ成功（run 120）。
- **git 履歴の書き換え済み**（`git filter-repo`、main とブランチを force push、`d108153 → e31c676`）。生成コンテンツの過去版を最新版に置換し、有料キットを書き戻していた削除済みスクリプトを履歴から除去。元の履歴の有料本文 2,522 行を全オブジェクトで照合し、残存 0（コード内の見出しテンプレートのみ一致）。
  - **オーナー端末の古いクローンは使わず、取り直すこと**（`git clone https://github.com/ssk0224/auto-tech-radar`）。古いクローンから push すると平文の履歴が戻る。
  - GitHub は古いコミットを SHA 指定でしばらく表示できる。完全に消すには GitHub サポートに「Remove cached views」を依頼する（旧 main: `104d7ccf906fcbda30d8e55f6ab87d22515188fe`、旧ブランチ先頭: `d10815377edda16a0882d55cce32f5416939b960`）。
- 乱数で作っていた閲覧者数（「現在 N 名が閲覧・研究中」）を削除、「全記事読み放題」系の表現を修正、sponsor の根拠のない読者層の主張を修正。テストに禁止表現として追加。

## 未完了（要対応）
0. **【オーナー作業・最優先】note に公開済みの記事の差し替え**: 修正はリポジトリの原稿にだけ入っており、note.com 上の公開済み記事は古いまま（購入者が読む有料部分も含む）。
   - 有料部分の手順を「README 準拠／未検証」に直した記事で、**note に公開済みの 9 本**: `laya-mlx`（README に MCP/HTTP サーバーは無く macOS 専用なのに Docker 手順があった）、`jev-chat-jarvis`, `jev-ultrafast`, `lightcraft`, `pdfcraft`, `universal-modder`, `vectorcraft`, `wordcraft`, `zcode`（自作の Docker 構成）。
   - 公開済み 32 本の無料部分には「即受注」「80万〜250万円」などの表現が残っている。
   - ノイズ記事 4 本（`crates-io-index`, `homebrew-core`, `internships-2027`, `mediawiki`）は解説対象外なのに ¥980 で公開されている → 非公開にする。
   - 手順: ランチャーの **[U]**。1 本ずつ、復号した修正版の全文をクリップボードへコピーし、note の記事一覧と原稿を開く。note で差し替えて Enter を押すと `publish_history.json` の `noteUpdatedAt` に記録され、一覧から消える。対象は `scripts/note_updates.json`（テスト `tests/note_updates.test.mjs` が公開済み記事との食い違いを検出）。
   - note.com には記事を編集する公開 API が無く、クラウド環境からはログインできないため、この作業だけは自動化できない。リードマグネット（`note_drafts/LEAD_MAGNET_CHEAT_SHEET.md`）は未投稿。
1. **修正後の生成スクリプトの本番初回**: 次の定期実行（6:17 JST）。6:40 JST に確認を予約済み。
2. ~~`public/og-card.png` の再生成~~（2026-10-19 済）。
3. **単価表示**: スター数・カテゴリから機械的に決めた「想定受託単価」（OGP `scripts/generate_og_cards.mjs`、`src/pages/index.astro` / `cheatsheet.astro` / `weekly.astro`）は根拠が無いため削除する方針（未着手）。記事本文の「想定」見積もりは残す。
4. **調査で見つかった不足**（優先順）:
   - FAQ 構造化データ（Layout.astro 120-135 付近）が全 OSS に「商用利用可能」と答えている → 実際のライセンス（SPDX）から生成する。
   - Layout の「専任エンジニアチームが最短2週間で構築」、contact の適格請求書の記載 → 事実確認できるまで断定しない表現に。
   - AI 生成であることの表示、スポンサー枠の「PR/広告」表示（ステマ規制）。
   - 計測が無い（cookie を使わない解析＋ UTM）。**オーナーのアカウント作成が必要**（例: GoatCounter 無料・cookie 不使用）。導入時は `privacy.astro` の外部送信一覧に追記する。
   - メールでの読者リスト（週次まとめ）。**配信サービスのアカウントが必要**。特定電子メール法に沿って同意と配信停止を用意。
   - robots.txt は**効いていない**: サイトは `ssk0224.github.io/auto-tech-radar/` 配下のため、クローラーが読むのはホスト直下の `/robots.txt`（RFC 9309 §2.3「top-level path」）。`public/robots.txt` の AI クローラー拒否もサイトマップ指定も無効。サイトマップは Google Search Console / Bing Webmaster Tools に手動で登録する（オーナー作業）。独自ドメインにすれば robots.txt が有効になる。
5. プライバシーポリシー（`src/pages/privacy.astro`）は事実に基づく最小限の内容。法務確認を推奨。外部送信（GitHub Pages / Google Fonts / jsDelivr）は 2026-10-19 に記載済み。外部サービスを足したら必ずここに追記する。
6. **独立レビューの指摘 20 件**: 2026-10-19 にすべて修正済み（テスト `tests/x_pipeline`, `claims`, `reference_check`, `radar_map`, `contact`, `boundaries` に再発防止の検査を追加）。主な内容: X 自動投稿の 4xx でキューが止まる不具合、ツイートの weight 超過、スポンサーページの根拠のない数値と被リンク販売、FAQ 構造化データ、記事ページの目次等が表示されない不具合（ブラウザで表示確認済み）、ノイズ記事の混入、IndexNow の送信範囲、Dockerfile ステージ名の誤照会、OGP 画像とリードマグネットの単価表示。
7. **その他の対応済み（2026-10-19）**: 記事に AI 生成の表示、プライバシーポリシーに外部送信（GitHub Pages / Google Fonts / jsDelivr）、適格請求書・NDA の断定表現を削除、OGP 画像 42 枚と og-card.png を再生成。
