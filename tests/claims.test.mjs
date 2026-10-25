// 公開リポの全テキスト（README・サイト・画像・原稿・投稿文・スクリプト・データ・docs）に、根拠のない数値や誇張が戻らないことを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

import { FORBIDDEN } from "../scripts/utils/claims_check.mjs";
import { trackedFiles, textFiles, readRepo, textViews, RULE_QUOTING } from "./helpers/public_text.mjs";

// 対象は手で選ばず、git が見ているテキストのすべて（まだ add していない新しいファイルを含む。公開リポなので、どれも誰でも読める）。
// テキストかどうかは拡張子ではなく中身で決める（.css・.csv も対象）。除くのは、禁止表現を「禁止する語」として書く場所だけ:
// 規則の定義・テスト・機械が書く実行記録（note の画面から読んだ記事名など）。docs/ は対象で、`…`・「…」で囲んだ引用（過去に消した語の記録）だけを除く
export function claimScope(files = trackedFiles(), cwd) {
  return textFiles(files, cwd).filter((f) => !RULE_QUOTING(f));
}
export function forbiddenHits(f, text) {
  const body = f.startsWith("docs/") ? text.replace(/`[^`\n]*`|「[^」\n]*」/g, "") : text;
  const hits = new Set();
  for (const view of textViews(body)) for (const [re, why] of FORBIDDEN) if (re.test(view)) hits.add(`${f}: ${why} (${view.match(re)[0]})`);
  return [...hits];
}

test("git が見ている公開テキスト（README・サイト・画像・原稿・投稿文・スクリプト・データ・docs）に禁止表現が無い。タグで分けた語も画面に出る形で読む", () => {
  const files = claimScope();
  for (const must of ["README.md", "src/layouts/Layout.astro", "public/og-card.svg", "public/llms.txt", "src/pages/radar/aihot.md", "scripts/launcher.mjs"]) assert.ok(files.includes(must), `検査の対象に ${must} が無い`);
  assert.deepEqual(files.flatMap((f) => forbiddenHits(f, readRepo(f))), []);
});

test("禁止表現の検査の対象は、まだ add していないファイル・拡張子の一覧に無い形式（css・csv）も含み、タグで分けた語・文字参照も拾う", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-claims-scope-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    for (const f of ["public/zz.css", "public/zz.csv", "x_posts/zz.txt", "docs/zz.md"]) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), "probe\n");
    }
    const scope = claimScope(trackedFiles(dir), dir);
    for (const f of ["public/zz.css", "public/zz.csv", "x_posts/zz.txt", "docs/zz.md"]) assert.ok(scope.includes(f), f);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10 });
  }
  assert.ok(forbiddenHits("src/pages/index.astro", "<p><strong>即</strong>受注のチャンス</p>").length > 0, "タグで分けた語");
  assert.ok(forbiddenHits("public/a.html", "<p>&#x5373;受注</p>").length > 0, "文字参照");
  assert.ok(forbiddenHits("public/a.css", '.x::after { content: "即受注"; }').length > 0, "css");
  assert.deepEqual(forbiddenHits("docs/a.md", "旧表記（`完全保存版`・「全記事読み放題」）を消した"), [], "docs の `…`・「…」は過去の記録の引用");
  assert.ok(forbiddenHits("docs/a.md", "【完全保存版】の記事").length > 0, "docs でも引用でなければ拾う");
});

test("収益の誇張の検査は、技術的な数量（リクエスト数・ダウンロード数）を誤検出しない", async () => {
  const { findForbiddenClaims } = await import("../scripts/utils/claims_check.mjs");
  for (const ok of ["月100万リクエストを処理", "毎月5万ダウンロード", "月間10万PV"]) assert.deepEqual(findForbiddenClaims(ok), [], ok);
  for (const ng of ["月収100万", "月100万円稼げる", "月50万円の収入"]) assert.ok(findForbiddenClaims(ng).length > 0, ng);
});

test("成果を保証する「〜に直結します」は、生成時の検査（claims_check）でも有料本文の検査（boundaries）と同じく検出する", async () => {
  const { findForbiddenClaims } = await import("../scripts/utils/claims_check.mjs");
  for (const ng of ["この提案は成約に直結します", "即受注", "受注に直結する導入例"]) assert.ok(findForbiddenClaims(ng).length > 0, ng);
  assert.deepEqual(findForbiddenClaims("ユーザー体験の向上に直結するコンサルティング"), []);
});
