// 記事の分類は、タグにその語が「そのまま」含まれるときだけ付ける。部分一致（"clinic" に "cli"、"agents-sdk" に "agents"）や、
// タイトル・説明文の語からの推測、当てはまらない記事を既定の分類に入れることはしない（src/utils/categories.js）
import test from "node:test";
import assert from "node:assert/strict";
import { categoryOf, TOPIC_CATEGORIES, UNCATEGORIZED } from "../src/utils/categories.js";

test("分類はタグの完全一致（大文字小文字は区別しない）で決まる", () => {
  for (const c of TOPIC_CATEGORIES) {
    for (const t of c.tags) {
      assert.equal(categoryOf([t.toUpperCase()]).key, c.key, `${t} → ${c.key}`);
    }
  }
});

test("タグの一部に分類の語を含むだけの記事は、その分類に入れない（部分一致・前後一致を使わない）", () => {
  for (const c of TOPIC_CATEGORIES) {
    for (const t of c.tags) {
      for (const near of [`${t}x`, `x${t}`, `${t}-sdk`, `my-${t}`]) {
        if (TOPIC_CATEGORIES.some((o) => o.tags.includes(near))) continue; // 定義に別のタグとしてあるものは除く
        assert.equal(categoryOf([near]).label, UNCATEGORIZED, `${near} は ${c.label} ではない`);
      }
    }
  }
  assert.equal(categoryOf(["clinic"]).label, UNCATEGORIZED);
});

test("当てはまらない記事・タグの無い記事は「未分類」", () => {
  assert.equal(categoryOf([]).label, UNCATEGORIZED);
  assert.equal(categoryOf(undefined).label, UNCATEGORIZED);
  assert.equal(categoryOf(["Rust", "OSS", "GitHub"]).label, UNCATEGORIZED);
});
