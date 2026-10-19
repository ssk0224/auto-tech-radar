// 受託相談フォームの label/for の対応と、スポンサー導線の判定が完全一致であることを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(path.resolve(import.meta.dirname, "../src/pages/contact.astro"), "utf8");

test("フォームの入力欄はすべて label の for で関連付けられている", () => {
  const ids = [...src.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="(form-[\w-]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 6);
  for (const id of ids) assert.ok(src.includes(`<label for="${id}"`), `label for="${id}" が無い`);
});

test("スポンサー判定は plan の完全一致で、sponsor 始まりの別スラッグを含めない", () => {
  assert.doesNotMatch(src, /plan\.startsWith\('sponsor'\)/);
  const m = src.match(/if \(\[([^\]]*)\]\.includes\(plan\)\)/);
  assert.ok(m, "完全一致の判定が無い");
  const ids = m[1].split(",").map((s) => s.trim().replace(/'/g, ""));
  assert.ok(ids.includes("sponsor-tieup") && ids.includes("sponsor-monthly"));
  assert.ok(!ids.includes("sponsor-guide-article"));
});
