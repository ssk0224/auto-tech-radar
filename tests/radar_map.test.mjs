// レーダーマップの 4 リングはスター数の区分で、すべての表示箇所で同じ定義（src/utils/articles.js）を使い、基準を明記している
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/radar-map.astro"), "utf8");

test("4 リング（★1,000未満を含む）がバッジ・キャンバスのリング・ブリップ色・詳細カードに定義されている", () => {
  assert.match(src, /RING_NAMES = STAR_TIERS\.map/);
  assert.equal((src.match(/RING_BADGE_STYLES = \[/g) || []).length, 1);
  assert.match(src, /label: '★1,000未満'/);
  assert.match(src, /item\.ring === 3\) color = /);
  assert.match(src, /ringLabels = \[[^\]]*'★1,000未満'[^\]]*\]/);
  assert.match(src, /ringColors = \[[^\]]*,[^\]]*,[^\]]*,[^\]]*\]/);
});

test("リングの基準（スター数のみ・評価や推奨ではない）をページに明記し、第三者の評価のように見せない", () => {
  assert.match(src, /\{STAR_TIER_NOTE\}/);
  assert.doesNotMatch(src, /ThoughtWorks|THOUGHTWORKS|本番採用推奨/);
});
