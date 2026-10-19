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
1. **修正後の生成スクリプトの本番初回**: 次の定期実行（6:17 JST）。6:40 JST に確認を予約済み。
2. **`public/og-card.png` の再生成**: `og-card.svg` は修正済み。日本語フォントのある環境で 1200x630 に再生成する。
3. **単価表示**: スター数・カテゴリから機械的に決めた「想定受託単価」（OGP `scripts/generate_og_cards.mjs`、`src/pages/index.astro` / `cheatsheet.astro` / `weekly.astro`）は根拠が無いため削除する方針（未着手）。記事本文の「想定」見積もりは残す。
4. **調査で見つかった不足**（優先順）:
   - FAQ 構造化データ（Layout.astro 120-135 付近）が全 OSS に「商用利用可能」と答えている → 実際のライセンス（SPDX）から生成する。
   - Layout の「専任エンジニアチームが最短2週間で構築」、contact の適格請求書の記載 → 事実確認できるまで断定しない表現に。
   - AI 生成であることの表示、スポンサー枠の「PR/広告」表示（ステマ規制）。
   - 計測が無い（cookie を使わない解析＋ UTM）。導入時はプライバシーポリシーに外部送信規律の記載を追加。
   - メールでの読者リスト（週次まとめ）。特定電子メール法に沿って同意と配信停止を用意。
   - robots.txt で AI クローラーを拒否している点を、方針として決める。
5. プライバシーポリシー（`src/pages/privacy.astro`）は事実に基づく最小限の内容。法務確認を推奨。
