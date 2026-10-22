// 画像・リードマグネットの生成物とその生成スクリプトに、根拠のない数値や誇張が戻らないことを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";

import { FORBIDDEN } from "../scripts/utils/claims_check.mjs";
import { trackedFiles } from "./helpers/public_text.mjs";

// 対象は手で選ばず、git が追跡しているテキストのすべて（公開リポなので、どれも誰でも読める）。
// 除くのは、禁止表現を「禁止する語」として書く場所だけ: 規則の定義・テスト・内部の作業記録（docs/、CI の状態ファイル）
const RULE_QUOTING = (f) =>
  f.startsWith("tests/") || f.startsWith("docs/") || f === "scripts/utils/claims_check.mjs" || f === "scripts/utils/hype_check.mjs" || /^scripts\/[a-z_]+_(log|status)\.json$/.test(f);

test("git が追跡している公開テキスト（README・サイト・画像・原稿・投稿文・スクリプト・データ）に禁止表現が無い", () => {
  const files = trackedFiles().filter((f) => /\.(md|mdx|markdown|mjs|js|ts|astro|json|txt|svg|xml|yml|yaml|html)$/i.test(f) && !/package-lock\.json$/.test(f) && !RULE_QUOTING(f));
  for (const must of ["README.md", "src/layouts/Layout.astro", "public/og-card.svg", "public/llms.txt", "src/pages/radar/aihot.md", "scripts/launcher.mjs"]) assert.ok(files.includes(must), `検査の対象に ${must} が無い`);
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const [re, why] of FORBIDDEN) assert.ok(!re.test(s), `${f}: ${why} (${s.match(re)?.[0]})`);
  }
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
