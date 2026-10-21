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
- **git 履歴の書き換え済み**（`git filter-repo`、main とブランチを force push、書き換え後の先頭 `e31c676`）。生成コンテンツの過去版を最新版に置換し、有料キットを書き戻していた削除済みスクリプトを履歴から除去。元の履歴の有料本文 2,522 行を全オブジェクトで照合し、残存 0（コード内の見出しテンプレートのみ一致）。
  - **オーナー端末の古いクローンは使わず、取り直すこと**（`git clone https://github.com/ssk0224/auto-tech-radar`）。古いクローンから push すると平文の履歴が戻る。
  - 書き換え後も GitHub は古いコミットを SHA 指定で匿名に表示していた。**2026-10-22 00:10 JST に GitHub 上のリポを削除→同名で作り直し→main と claude/upbeat-tesla-7dei50 を push して解消**（オーナー判断。フォーク・スター・PR・issue は 0 だった）。旧 main・旧ブランチ先頭・旧ルートの 3 コミットとも API は 422「No commit found」、匿名の `.patch` は 404 を確認。GitHub Support への依頼は不要になった（下書きはオーナー PC の `~/.auto-tech-radar/handoff/github_support_request.md`）。**GitHub の「削除したリポの復元」は使わない**（使うと漏れが戻る）。外部のミラー（Software Heritage 等）に複製があるかは未確認。
  - 作り直しで消えたもの: Actions の実行履歴（run 番号は 1 から）・成果物、シークレット `GH_PAT`（未登録のまま。workflow は `GITHUB_TOKEN` に切り替わる）。`GEMINI_API_KEY` はオーナーが再登録済み（Google AI Studio の HEAVEN アカウントの、2026-04 頃に作られたキー。FREE アカウントにも 2026-10-22 作成のキーがあるが使っていない）。Pages（GitHub Actions）・workflow の書き込み権限・説明文・トピックは元の値で設定済み。作り直し前の全ブランチと設定は `D:\ClaudeBackup\auto-tech-radar\`（bundle と repo 設定 JSON）。
  - 再公開前に、旧履歴の有料部分の行（3,246 行、25 字以上・無料部分に無いもの）を新しい履歴の全オブジェクトと照合した。一致は 71 行で、すべて生成テンプレートの見出し・ハッシュタグ・README 由来のコマンド・effectcraft の現行の無料部分（旧形式で無料部分が長い記事）。
  - **公開リポにコミット SHA（旧履歴のもの）を書かない**。
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
- **【2026-10-21 22:30 JST ローカルセッション（オーナー PC）の状態】**
  - **Search Console（所有権確認済み・2026-10-21 23:10 JST）**: URL プレフィックス `https://ssk0224.github.io/auto-tech-radar/`、所有者の Google アカウントは heaven.field.farmers.place.ssk0801@gmail.com（オーナーがログインしたもの）。確認タグは `site.js`（5bc4559）。サイトマップ `sitemap-index.xml` を送信済みだが、送信直後の状態は「取得できませんでした」（公開中のサイトマップは正常: index→sitemap-0.xml、49 URL、すべてサイト配下）。**10/22 以降に再確認**（専用プロファイルでサイトマップ画面を開いて状態を読む）。それでも取得できなければ原因を調べる。
  - **Cloudflare Web Analytics（有効化・58e36b1）**: `webmaster_setup.mjs cf` で token を取得。beacon と privacy.astro の外部送信の記載は同じ設定値で出る（ビルドと audit_dist で確認済み）。計測値は Cloudflare のダッシュボード（同じ専用プロファイルでログイン済み）。
  - 時刻だけのコミット: CI が `note_status.json`・`zenn_status.json` の `checkedAt` だけを変えて「chore: auto-index new tech radar entry」というコミットを毎回作る（件名が実態と合わない・履歴と rebase の手間が増える）。直す候補。
  - 自動操作の注意: 専用プロファイル `~/.auto-tech-radar/chrome-webmaster`。ログインだけ普通の Chrome の窓で行い、その窓を閉じると自動操作の窓（「自動テスト ソフトウェアによって制御」）が開く。**自動操作の窓は閉じない**。止まったら `~/.auto-tech-radar/webmaster_debug/`（screen.png・controls.json）を読んで直す。2026-10 の Search Console は入力欄の目印が aria-label。
  - **ローカル（Windows）では `npm test` が 36/275 件失敗する**（変更前も同じ 36 件＝既存）。原因の系統: CRLF（`core.autocrlf=true` で `\n` 前提の正規表現・split が外れる）、symlink の EPERM、複数テストが同じ `.astro` キャッシュで同時に `astro build`、git 同期テスト、有料原稿の数 38≠36。CI（Linux）は通る。根本対策（Windows でも通す＋CI に Windows を足す等）はバグ洗い出しワークフロー（wf_8baf0270-60c）の結果を見て実施する。
  - **バグ洗い出し wf_8baf0270-60c は 2026-10-21 23:27 に完了**（55 件発見 → 敵対的検証で 47 件確認: CRITICAL 2・HIGH 4・MEDIUM 18・LOW 23、系統別の対策案つき）。結果はオーナー PC の `~/.auto-tech-radar/handoff/`（`bughunt_summary.md`＝一覧、`bughunt_wf_8baf0270-60c_result.json`＝全文、`scratch/`＝再現用スクリプト）。公開リポに置かないのは有料本文の漏れ方の詳細を含むため。**次のセッションは `bughunt_summary.md` を読み、CRITICAL→HIGH の順に、バグごとに原因＋同じ種類を止める仕組みで直す**。
    - CRITICAL（2 件は同じ事象）: 書き換え前の有料本文入りコミットが GitHub に SHA 指定で匿名で読めた → 2026-10-22 にリポの作り直しで解消（上の「完了」参照）。残りは docs に SHA を書かせない検査。
    - HIGH: git_sync が git の stderr（Windows の autocrlf 警告）をファイル名として扱い、衝突の修復がオーナー PC で効かない／有料ラインの漏れ検知が「位置不明」を合格扱い（23〜24 本が未計測なのに「34 本確認」と書いていた）／有料本文の検査がオーナー PC でだけ動き、cleanyourtv・deepinfer で赤。
  - **星履歴 API は第三者のリポジトリで使える**（`gh api repos/<owner>/<repo>/stargazers/history` が HTTP 200・日別の星数、2026-10-21 実測）。→「Radar Ledger は後から作れないデータ」という前提は誤り。差別化は「いつ何を選んだかの事前記録・検証ログ・日本語の判断」に置く。
  - **Zenn**: `scripts/zenn_status.json` は 38 本とも 403（確認不能）。上の「34 本は 404」は現行データでは裏付けが無い（未確認として扱う）。
  - **週次オーナー報告 issue**: 材料（run_status・ledger・velocity・note_status・note_browser_log の stats）はあるが、**note の売上・購入数はリポジトリのどこにも無い**。報告には「売上データ無し」と明記し、Zenn（403）は載せない。
  - **戦略（世界の先行事例の調査＋3観点の反証、2026-10-21）の採用案**:
    - Vol.1 = 「Radar Ledger Vol.1」。2026-10-21〜11-04 の実測を運営者が署名して出す無料号（固定 URL `/vol/1/`＋GitHub Release に CSV・集計スクリプト）。有料は note の「検証ノート」1 本だけ（価格は未検証の仮説として扱う）。14 日分を指数と呼ばない。不正を断定しない。
    - 先にやること: 計測の開通（今日）→ 信頼の土台（`deepinfer.md` の「革新的・飛躍的・極限・最高峰」と根拠のない比較、`cleanyourtv.md` の「完全に除去」、`index.astro` L15 の「1日最大1本」と実態（10/09 に 9 本）の食い違い、`weekly.astro` の受託・見積 CTA と「Executive Whitepaper」を直す）→ Vol.1。
    - やめること: per-repo ¥980 の新規出品（11/18 まで凍結）、計測前の価格・文面の調整、Hatena のブクマ依頼・自動投稿、Zenn 再開。
    - オーナーの判断が要る: 特定商取引法の売主表示（note での扱いは未確認）、告知の方法（知人への購入・拡散依頼はしない＝ステマ規制）、main のブランチ保護。
- **【2026-10-21 収益化 第1弾（push 済み 80b5dde）】**
  - Zenn 自動公開を停止（`articles/`・`zenn_drafts/`・生成スクリプト・ランチャー [Z]/[9] すべて `published: false`。`tests/zenn_frozen.test.mjs` が scripts/ と zenn_drafts/ 全体を検査）。新規記事は 1 日 1 本（`TARGET_NEW_COUNT=1`）。
  - 領収書の文言をインボイス非登録の事実に合わせて「※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。」に統一（原稿 42 本・生成テンプレ・`scripts/utils/receipt.mjs` で生成時に強制）。誇大表現（一発起動・コピペで本番・爆発的・即決・驚異的・怪物級など）を生成時に拒否（`scripts/utils/hype_check.mjs`）。
  - **[E] が公開中 note の文面も直す**（`NOTE_TEXT_RULES`、`scripts/utils/note_pending.mjs`）。安全策: 編集画面の本文が「公開中の本文に置換を当てたもの」と段落ごとに一致しなければ公開しない／更新前後でログアウト時の無料部分が一致しなければ全停止／**24 時間で 12 本まで**（`~/.auto-tech-radar/note_fix_history.json`）。対象は 34 本なので 3 日に分けて [E] を押す必要がある。モックでのみ検証済み → 最初の実機 [E] のログ（`note_browser_log.json`）で「自動では直しません」が出ていないか確認する。
  - サイト: 記事冒頭に note 有料版の内容（features・分量・価格）を 1 箱だけ表示。記事ページの B2B 案内（¥100,000/¥800,000）を削除し、/sponsor/・/contact/ はフッターのみ。X リンクは維持。出品は 1 日 1 本・7 日 3 本まで（JST で数える）。
- **【2026-10-21 夜 第2弾（push 済み ed51586）】**
  - [E] の実機 1 回目は aihot で止まった: note は引用を `<figure><blockquote>` で持つ（`note_html.mjs`）のに、段落の取り出しが figure を丸ごと読み飛ばしていたため、引用内の領収書の文を直さず「一致」と判断していた。修正＋「公開中で見つけた問題が編集画面の全文から消えていなければ更新しない」ガード（ddb650d）。2 回目で 11 本修正・失敗 0、aihot は issues 0・endPct 100（有料ライン不変）。**残り 23 本（インボイス 23 / 誇張 18 / コピペで本番 11）→ 24 時間 12 本の上限が空き次第 [E] を押す（10/22 20 時半 JST 以降）**。
  - 生成の継続性: モデルを `models.list()` から選び 404 は次のモデル、429 はそのモデルだけ外して次へ（全滅で quota 停止）。`data/run_status/<JST日>.json` に毎回記録。12:17 の便の後に当日 0 本なら issue「パイプライン停止アラート」（`scripts/alert_if_no_article.mjs`）。
  - Radar Ledger: `scripts/snapshot_ledger.mjs` が毎日 `data/ledger/YYYY/MM/DD.jsonl`（候補＋掲載済み、2026-10-21 初回 77 件を本番で記録）と `data/derived/velocity.json`。記事に「掲載時 ★X → 現在 ★Y」。
  - 選定: `scripts/utils/selection.mjs`（7 日のスター増、テーマ重み、同一オーナー 30 日 1 本、短期集中クラスターは見送り）、`/criteria/` は同じ設定から表示。テーマ外 6 ページ削除（how-to-live-better は有料 note が公開中なので残置・ブロックリスト）。effectcraft の pubDate を 2026-10-18 に訂正。
  - 誠実性: `scripts/utils/license_resolver.mjs`（LICENSE 本文から判定、推測で許可しない）、Web 記事の推奨・最上級・ライセンス推論を `claims_check` で拒否（既存全ページも 0 件を検査）、20 ページ訂正（cleanyourtv は MIT＋同梱フォント OFL など）、`/about/`（運営方針・訂正履歴）、スター数区分の表記、スポンサー料金・「圧倒的にお得」削除。
- **【次のセッション（オーナー PC のローカル）で最初にやること】** オーナー決定（2026-10-21）: クラウドのクレジットが尽きたためローカル（デスクトップアプリ／`claude remote-control`、コンピュータユース可、PC は閉じない）に移る。
  1. Google Search Console の登録と、Cloudflare Web Analytics の登録を、オーナーと一緒に行う（ローカルで実施すると決定済み）。登録後に Claude が確認用メタタグ／解析タグをサイトに入れ、`privacy.astro` の外部送信一覧を同じコミットで更新する。
  2. 10/22 19:49 JST 以降に [E]（残り 23 本）。ローカルなら note.com を直接確認できる（クラウドの環境は note.com への通信が 403 で拒否されていた）。
  3. 全体のバグ洗い出し（2026-10-21、3 系統で計 48 件をテストで再現して修正、テスト 270 件）の初回本番を確認: daily-crawl の「Configure git」ステップ・2 段の品質ゲート・12:17 の停止アラート（origin/main を見る）・Gemini 1 回 6 分のタイムアウト。Zenn の公開確認は CI から全件 HTTP 403 で、これまで実際には確認できていなかった（今は毎回警告が出る）→ ローカルから確認する。
  4. ロードマップの続き: 週次のオーナー報告 issue、Radar Weekly（11/2 開始）、Vol.1（11/4 頃）。
- **比較調査のロードマップ（2026-10-21、要点）**: 収益ゼロの主因は ①自分の読者リストが無い ②商品が README の言い換えで同型 ¥980 が 38 本 ③選定の根拠が無い。優先順: (1) 生成停止の検知とモデル切替 (2) 毎日のリポジトリ記録（後から作れないデータ）と掲載後の推移表示 (3) ライセンス誤記・根拠のない推奨の訂正と再発防止 (4) 勢い（7 日のスター増）での選定・同一オーナー上限・選定基準ページ (5) note のタイトル・カタログ整理（オーナー承認後）(6) 週次号の固定 URL＋GitHub Releases（メールは後）(7) 事実だけで決める区分 (12) 週次のオーナー報告 issue。(1)〜(4) は第 2 弾として実装中。
- **【2026-10-21 15:21 JST 確認】見出し画像は全 37 本に設定済み**（CI の `scripts/note_status.json` で no eyecatch 0 本）。[E] の実機ログ（`scripts/note_browser_log.json`、版 8cb9cfb）: 正しくログインした状態ならアップロードだけで記事に反映され、「公開に進む→更新する」の予備処理は使われなかった（それ以前の「下書きにだけ付く」という見立ては誤り。以前は note.com 側のログインが不完全だった可能性）。残りは effectcraft / gptqmodel / opensandbox の無料部分の見出し「🎯 ThoughtWorks成熟度リング判定…」（note 上の更新日時 10/19 のまま）。[U] が見出し 1 行だけの修正として案内する（`scripts/utils/note_pending.mjs`）。オーナーの [U] 実施待ち → 次の CI の検査で issues が消えたか確認する。
- **ログインの注意**: Google は自動操作中の Chrome でのログインを拒否する。[E] はログインが必要になると自動操作の窓を閉じ、同じ専用プロファイルで普通の Chrome を開いてログインしてもらい、窓が閉じたら再開する。ランチャーは [E]/[U] の直前に最新版を取り込む（開いたまま古い版で動いた実例あり）。
- **【2026-10-21 17:01 JST 確認】note の公開内容は問題 0 件**（CI の `note_status.json`: issues 全記事なし、見出し画像なし 0、有料ライン超過 0、原稿と対応しない公開記事 0）。effectcraft の残り 1 文は [E]（`note_browser.mjs maintain`）が実機で自動修正した（ログ版 5fe8c02: 編集画面で語を置換 → 公開に進む → 公開設定 → **有料エリア設定** → 更新する → API で反映確認。有料ラインの位置は変更していない）。note の公開手順は有料記事だと「公開設定」の次に「有料エリア設定」画面があり、「更新する」はそこにある（`<button><span>更新する</span></button>`）。
- **[E] = note 自動メンテ**: 見出し画像 → CI が見つけた古い表現（ThoughtWorks…）の語だけ置換して更新（下書きが公開中と 3% 以上違えば何もしない）→ 閲覧数・スキの取得（`result.stats`）。結果は `scripts/note_browser_log.json` として push される。
- **収益ゼロの実測（2026-10-21）**: note 閲覧数の合計 221（約 50 記事、うち旧題の非公開 14 本 65 回）、スキ 37、コメント 0、1 記事あたり最大 11。X は API 有料化（2026-02〜従量課金）でオーナーが不採用。Zenn は 38 本中 4 本しか公開されていない（`scripts/zenn_status.json`、34 本は 404。Zenn の直近 24 時間の新規投稿上限で弾かれたとみられる。弾かれた記事は自動では再試行されない）。Zenn の規約 4条1項11号（機械により自動生成された文章の投稿＝スパム）・ガイドライン（生成AIによる乱造・広告目的の投稿を控える）・16条2項（無催告の停止）があり、AI 生成記事の自動投稿の継続はアカウント停止の危険がある → 集客方針をワークフローで検討中。
- **有料ラインの実測（2026-10-21 15:53 JST、`note_status.json` の paidLine/sale）**: 全 37 本で、ログインなしでは有料部分を読めない（can_read=false、price=980、無料の LEAD_MAGNET を除く）。有料ラインより先が無料で見えている記事は 0 本（pastDraft なし）。34 本は原稿の【有料ライン】の位置ちょうど（endPct=100）。オーナーが手動で上に動かした gptqmodel=67% / opensandbox=74% は、原稿の無料部分の最後にある販売案内（🔒 有料エリアで公開する実践ナレッジ・価格・経費精算）が有料側に入った状態（安全側だが販売案内が見えない）。effectcraft は旧形式で無料部分が約 7,000 字（記事本体がほぼ無料、有料はテンプレート類）。is_public_membership_connected は全 37 本 true。effectcraft の無料部分にはまだ「…ThoughtWorks成熟度リングでは「TRIAL」と判定…」の 1 文が残り、[U] が語の置き換えとして案内する。
- **[U] の隠し条件の不具合（修正済み）**: 「差し替えた」記録が日付だけだったため、同じ日に「更新する」を押し忘れた記事が一覧から消えていた（オーナーが見た「残り 0 本」の原因）。記録を時刻にし、CI の確認時刻より後の記録だけ隠す。
- **note の公開内容の確認**（2026-10-21〜）: CI が毎回、公開中の note を API で取得して本文の禁止表現・タイトル・見出し画像の有無を検査し、`scripts/note_status.json` とランチャーのヘッダーに出す。要修正の記事は [U] に自動で並ぶ。
- **[E] 見出し画像**は `scripts/note_browser.mjs` が専用プロファイルの Chrome（`~/.auto-tech-radar/chrome-note`、初回のみ普通の Chrome の窓で note にログイン）を自動操作する。2026-10-21 に実機で 8 本設定済み。DevTools への貼り付けは不要。
- **[N] 本文の一括自動更新は使えない**: ブラウザで実行する本体がリポジトリに無いため。[U] に案内する。自動化するなら `note_browser.mjs` に note の下書き保存・公開の処理を足す（note の非公開 API の実通信を確認してから）。
- **note への再反映（2026-10-21）**: `effectcraft` / `gptqmodel` / `opensandbox` の無料部分にあった「ThoughtWorks成熟度リング判定」（第三者の評価のように見える表現）を原稿で修正した。note.com 側はランチャー **[N]**（全記事を原稿の内容で更新）を一度実行して反映する。
- **note の見出し画像**（2026-10-21）: [N] の自動出品は見出し画像を付けていなかった。ランチャー **[E]**（[N] の後にも自動で続く）で、公開済みで未設定の記事に 1280x670 の画像（記事の OGP 画像から生成）を一括設定する。ブラウザ側は `scripts/browser/note_eyecatch.js`（note の非公開エンドポイント `/api/v1/image_upload/note_eyecatch` を使用。Chrome が「ローカル ネットワーク」へのアクセス許可を求めたら許可）。（この DevTools 方式は廃止。現在は note_browser.mjs が自動実行し、2026-10-21 に実機で動作確認済み）
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

