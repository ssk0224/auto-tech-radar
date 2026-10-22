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

// 問い合わせ先に個人のメールアドレスを出さない（公開ページ・HTML のソース・送信先の URL のどこにも）。
// 送信先は FormSubmit が発行するランダムな文字列（エイリアス。メールアドレスではない）だけで決める
test("問い合わせはメールアドレスを出さず、FormSubmit のエイリアス（siteConfig.contactFormAlias）に送る", async () => {
  const { siteConfig } = await import("../src/config/site.js");
  const emailShape = /[^\s@"'`]+@[^\s@"'`]+\.[a-z]{2,}/i;
  for (const [k, v] of Object.entries(siteConfig)) if (typeof v === "string") assert.doesNotMatch(v, emailShape, `siteConfig.${k} がメールアドレスの形`);
  assert.equal(typeof siteConfig.contactFormAlias, "string", "siteConfig.contactFormAlias（FormSubmit のエイリアス）が無い");
  assert.doesNotMatch(siteConfig.contactFormAlias, /@/);
  assert.doesNotMatch(src, /mailto:|mail\.google\.com|contactEmail/);
  // FormSubmit への送信先は、エイリアスの値からだけ作る（formsubmit.co/ の後ろに直接アドレスを書かない）
  const targets = [...src.matchAll(/formsubmit\.co\/(?:ajax\/)?([^"'`\s)]*)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 2, "フォームの送信先が無い");
  for (const t of targets) assert.ok(/^\$\{\s*(?:siteConfig\.contactFormAlias|formAlias)\s*\}$/.test(t), `送信先がエイリアスの値ではない: ${t}`);
});
