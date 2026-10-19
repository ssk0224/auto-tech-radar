// レーダーマップの 4 リング (ADOPT/TRIAL/ASSESS/HOLD) がすべての表示箇所で定義されていることを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/radar-map.astro"), "utf8");

test("HOLD(ring 3) がバッジ・キャンバスのリング・ブリップ色・詳細カードに定義されている", () => {
  assert.match(src, /RING_NAMES = \["ADOPT", "TRIAL", "ASSESS", "HOLD"\]/);
  assert.equal((src.match(/RING_BADGE_STYLES = \[/g) || []).length, 1);
  assert.match(src, /label: 'HOLD'/);
  assert.match(src, /item\.ring === 3\) color = /);
  assert.match(src, /ringLabels = \[[^\]]*'HOLD[^\]]*\]/);
  assert.match(src, /ringColors = \[[^\]]*,[^\]]*,[^\]]*,[^\]]*\]/);
});

test("リング名の三項演算子による ASSESS 決め打ちが残っていない", () => {
  assert.doesNotMatch(src, /item\.ring === 1 \? 'TRIAL' : 'ASSESS'/);
});
