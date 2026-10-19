// 解説対象にしないリポジトリ（パッケージ辞書・求人リスト・チートシート集など）の判定。
// 生成（crawl_and_generate）と X 自動投稿（auto_tweet_x）で同じ基準を使う
export const NOISE_FILTER_REGEX = /(index$|core$|cask$|nixpkgs|mediawiki|awesome|interview|curriculum|roadmap|internship|cheatsheet|cheat-sheet|leetcode|tutorial|translation|locale|dotfiles|fonts|sample|dataset|collection)/i;

export function isNoise(name) {
  return NOISE_FILTER_REGEX.test(name);
}
