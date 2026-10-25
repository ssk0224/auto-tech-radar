// 公開物の「どのファイルを検査するか」を手書きの一覧でなく、git が見ているファイルから導く。
// 新しいページ・画像・テキストを足しても、検査の対象から漏れない（ファイル名の一覧を足し忘れる、という失敗の型を無くす）。
// 対象は追跡中のファイルと、まだ add していない新しいファイル（.gitignore で除外したものを除く）。生成した直後の投稿文・画像も、commit 前に止める
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { readText } from "./read_src.mjs";

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");

export function trackedFiles(cwd = repoRoot) {
  const list = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd, encoding: "utf8" }).split("\0").filter(Boolean);
  // 作業ツリーで消したファイル（まだ commit していない削除）は検査しない
  return [...new Set(list)].filter((f) => fs.existsSync(path.join(cwd, f)));
}

// テキストかどうかは拡張子の一覧ではなく中身で決める（git と同じ: 先頭 8000 バイトに NUL が無ければテキスト）。
// 拡張子の一覧だと .css・.csv・.cjs のような「一覧に無い形式」が素通りする
export function isTextFile(abs) {
  const fd = fs.openSync(abs, "r");
  try {
    const buf = Buffer.alloc(8000);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return !buf.subarray(0, n).includes(0);
  } finally {
    fs.closeSync(fd);
  }
}

export function textFiles(files = trackedFiles(), cwd = repoRoot) {
  return files.filter((f) => !/(^|\/)package-lock\.json$/.test(f) && isTextFile(path.join(cwd, f)));
}

export const readRepo = (f) => readText(path.join(repoRoot, f));

// 掲載中の記事の slug（src/pages/radar/<slug>.md）
// 記事の slug: サイトの記事ページと、README の事実の集合（data/readme_facts/<slug>.json。記事ページの無い note 原稿の分も scripts/build_readme_facts.mjs が作る）
export function articleSlugs(files = trackedFiles()) {
  const article = (f) => /^src\/pages\/radar\/[^/]+\.md$/.test(f) || /^data\/readme_facts\/[^/]+\.json$/.test(f);
  return new Set(files.filter(article).map((f) => path.basename(f).replace(/\.(md|json)$/, "")));
}

// 記事の本文（取り上げた OSS についての文）。記事の slug を名前に持つ Markdown（サイトの記事・note 原稿 <slug>_note・Zenn 原稿 <slug>_zenn・元原稿 <slug>-…）。
// 運営者自身についての文（更新頻度など）を述べる場所ではない。どのファイルが本文かは、記事の slug（データ）から決める
export function isArticleBody(f, slugs) {
  // README の事実の集合は、取り上げた OSS の README から原文のまま抜いた文（運営者の文ではない）
  if (/^data\/readme_facts\/[^/]+\.json$/.test(f)) return slugs.has(path.basename(f, ".json"));
  if (!/\.(md|markdown)$/i.test(f)) return false;
  const stem = path.basename(f).replace(/\.(md|markdown)$/i, "").replace(/(_note|_zenn)$/, "");
  return [...slugs].some((slug) => stem === slug || stem.startsWith(`${slug}-`));
}

// 規則そのものを書く場所（禁止する語を「禁止する語」として引用する）と、機械が書く実行記録
export const RULE_QUOTING = (f) =>
  f.startsWith("tests/") ||
  f === "scripts/utils/claims_check.mjs" ||
  f === "scripts/utils/hype_check.mjs" ||
  // 出品前の検査（owner_checks）の規則と、その規則の語の読み（rule_readings）。禁止表現を「禁止する語」として書く規則の定義
  f === "scripts/utils/owner_checks.mjs" ||
  f === "scripts/utils/rule_readings.mjs" ||
  // 公開中のプロフィール・会員プランの文の検査（live_profile_check）の規則（頻度・全記事読み放題の言い方を「禁止する語」として持つ）
  f === "scripts/live_profile_check.mjs" ||
  /^scripts\/[a-z_]+_(log|status)\.json$/.test(f);

// 運営者が自分について述べる公開テキスト（README・サイト・画像・投稿文・生成スクリプトが出す文・データ）。
// 記事の本文、規則の定義・テスト、内部の作業記録（docs/）、.github/（スケジュールの定義そのもの）は除く
export function operatorTexts(files = trackedFiles(), cwd = repoRoot) {
  const slugs = articleSlugs(files);
  return textFiles(files, cwd).filter((f) => !isArticleBody(f, slugs) && !RULE_QUOTING(f) && !f.startsWith("docs/") && !f.startsWith(".github/"));
}

export const isCodeFile = (f) => /\.(m?[jt]s|cjs|astro|jsx|tsx)$/i.test(f);

// コードのコメント（// …・/* … */・<!-- … -->）を除く。コメントは公開物に出ない作業メモで、頻度などの語を説明に使ってよい。
// 文字列の中の "//"（URL）は残す
export function stripComments(src) {
  return src
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => {
      let quote = "";
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quote) {
          if (c === "\\") i++;
          else if (c === quote) quote = "";
        } else if (c === '"' || c === "'" || c === "`") quote = c;
        else if (c === "/" && line[i + 1] === "/" && line[i - 1] !== ":") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

// 画面に出る文（レンダリング後の文字）。タグで分けた語（<strong>即</strong>受注・毎<tspan>日</tspan>更新）がつながった形で読めるように、
// 行内の要素（a・strong・span・tspan など）のタグは消し、それ以外の要素の境目は改行にする。文字参照は戻す
const INLINE_TAGS = "a|abbr|b|bdi|bdo|cite|code|data|dfn|em|font|i|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|tspan|u|var|textPath";
export const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[n]);
export function renderedText(markup) {
  return decodeEntities(
    markup
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(new RegExp(`</?(?:${INLINE_TAGS})\\b[^>]*>`, "gi"), "")
      .replace(/<[^>]+>/g, "\n"),
  );
}

// 検査に使う読み方: 生の文字列・文字参照を戻した文・画面に出る文
export function textViews(text) {
  return /[<&]/.test(text) ? [text, decodeEntities(text), renderedText(text)] : [text];
}

// サイトの「運営者自身についての文言」を持つソース（README・src/（記事本文を除く）・public/）
export function siteChromeSources(files = trackedFiles(), cwd = repoRoot) {
  return operatorTexts(files, cwd).filter((f) => f === "README.md" || ((f.startsWith("src/") || f.startsWith("public/")) && !f.startsWith("src/pages/radar/")));
}

// scripts/ の全テキスト（コード・データ・拡張子を問わない）と src/ のコード
export function scriptFiles(files = trackedFiles(), cwd = repoRoot) {
  return textFiles(files, cwd).filter((f) => f.startsWith("scripts/") || (f.startsWith("src/") && isCodeFile(f)));
}
