// 解説対象から外したリポジトリ（スラグ）の一覧（2026-10-21）。
// パッケージ辞書・求人リスト・書籍の閲覧ページなど、ツールとして解説する対象ではないもの。
// 生成（crawl_and_generate → selection.mjs）はここに載ったスラグを二度と候補にしない。

// サイトから記事ページを取り下げたスラグ。note 原稿（非公開化済み）にはこのページへのリンクが残るため、
// 監査はこれらの原稿に限って取り下げ済みページへのリンクを許す
export const REMOVED_SLUGS = Object.freeze([
  "homebrew-core",
  "homebrew-cask",
  "crates-io-index",
  "mediawiki",
  "internships-2027",
  "nixpkgs",
]);

// 記事ページは残すが、新しく選ばないスラグ。
// how-to-live-better は note の有料版が公開中（scripts/note_urls.json）のため、ページは取り下げない
export const KEPT_BUT_BLOCKED_SLUGS = Object.freeze(["how-to-live-better"]);

export const BLOCKED_SLUGS = Object.freeze([...REMOVED_SLUGS, ...KEPT_BUT_BLOCKED_SLUGS]);

// リポジトリ名から記事のスラグを作る。記事ページ・note / X / Zenn の原稿のファイル名と、X 投稿文の記事リンクは
// すべてこの 1 つの関数で作る（以前は生成スクリプトの中に先頭・末尾の - を落とす版と落とさない版があり、
// 「.claude」のように . で始まる名前では X 投稿文のリンク先 /radar/claude/ と記事ページ /radar/-claude/ が食い違っていた）
export function slugForRepoName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
}

export function isBlockedSlug(slug) {
  return BLOCKED_SLUGS.includes(String(slug || "").toLowerCase());
}
