// 公開物の「どのファイルを検査するか」を手書きの一覧でなく、git が追跡しているファイルから導く。
// 新しいページ・画像・テキストを足しても、検査の対象から漏れない（ファイル名の一覧を足し忘れる、という失敗の型を無くす）
import { execFileSync } from "child_process";
import path from "path";
import { readText } from "./read_src.mjs";

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");

export function trackedFiles(cwd = repoRoot) {
  return execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8" }).split("\0").filter(Boolean);
}

const TEXT_EXT = /\.(astro|md|mdx|markdown|js|mjs|ts|json|txt|svg|xml|webmanifest|html|css)$/i;

// サイトの「運営者自身についての文言」を持つソース: src/（記事本文 src/pages/radar/ を除く）・public/ のテキスト・README。
// 記事本文は取り上げた OSS についての文で、運営者の更新頻度などを述べる場所ではないため対象外
export function siteChromeSources(files = trackedFiles()) {
  return files.filter(
    (f) => TEXT_EXT.test(f) && (f === "README.md" || ((f.startsWith("src/") || f.startsWith("public/")) && !f.startsWith("src/pages/radar/"))),
  );
}

// スクリプト（コード）のファイル。データ（.json）は除く
export function scriptCodeFiles(files = trackedFiles()) {
  return files.filter((f) => (f.startsWith("scripts/") || f.startsWith("src/")) && /\.(mjs|js|ts|astro)$/.test(f));
}

export const readRepo = (f) => readText(path.join(repoRoot, f));
