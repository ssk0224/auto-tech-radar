// Zenn への自動公開の停止（2026-10-21）が戻らないことを確かめる。
// Zenn の規約（機械生成の文章・宣伝目的のコンテンツの禁止、AI による大量生成への指針）に沿わないため、
// Zenn 用の原稿（articles/・zenn_drafts/）は作らず、リポにも置かない（tests/public_tree.test.mjs の止めた出力の検査）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { readText } from "./helpers/read_src.mjs";

test("どのスクリプトも Zenn 原稿を published: true で書かない", () => {
  const scripts = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(mjs|js|cjs)$/.test(e.name)) scripts.push(p);
  });
  walk("scripts");
  assert.ok(scripts.includes(path.join("scripts", "launcher.mjs")));
  for (const f of scripts) {
    const s = readText(f);
    assert.doesNotMatch(s, /^published:\s*true\b/m, f);
    // 条件しだいで true になる書き方（published: ${...}）も戻さない
    assert.doesNotMatch(s, /^published:\s*\$\{/m, f);
  }
});

test("ランチャー・投稿補助は Zenn に投稿する流れを開かず、自動公開をうたわない", () => {
  const launcher = readText("scripts/launcher.mjs");
  // [9]・[Z]→[3] は投稿の補助（runPublishHelper('zenn')）ではなく停止の案内
  assert.doesNotMatch(launcher, /runPublishHelper\('zenn'\)/);
  assert.match(launcher, /case '9':\n\s*zennFrozenNotice\(\);/);
  assert.match(launcher, /if \(mode === 'zenn'\) return zennFrozenNotice\(\);/);
  assert.doesNotMatch(launcher, /zenn\.dev\/articles\/new|0クリック自動公開|自動公開されます|ユーザーの操作不要で自動公開|「公開」を押すだけ/);
  const helper = readText("scripts/publish_helper.mjs");
  assert.doesNotMatch(helper, /zenn\.dev\/articles\/new|「公開」を押すだけ/);
  assert.match(helper, /Zenn への投稿は停止しています/);
});
