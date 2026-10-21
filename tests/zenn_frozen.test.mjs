// Zenn への自動公開の停止（2026-10-21）が戻らないことを確かめる。
// Zenn の規約（機械生成の文章・宣伝目的のコンテンツの禁止、AI による大量生成への指針）に沿わないため、
// articles/*.md はすべて published: false（下書き）にし、生成スクリプトも published: false でしか書かない
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { zennSummary, zennWarnings } from "../scripts/check_zenn.mjs";
import { readText } from "./helpers/read_src.mjs";

const frontmatter = (s) => s.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

test("articles/*.md に published: true の記事が無い（すべて published: false）", () => {
  const files = fs.readdirSync("articles").filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const s = readText(path.join("articles", f));
    assert.doesNotMatch(s, /^published:\s*true\b/m, f);
    assert.match(frontmatter(s), /^published:\s*false\s*$/m, `${f}: front matter に published: false が無い`);
  }
});

test("生成スクリプトは Zenn 原稿を published: false でしか書かない", () => {
  const src = readText("scripts/crawl_and_generate.mjs");
  assert.doesNotMatch(src, /^published:\s*true\b/m);
  // 条件しだいで true になる書き方（published: ${...}）も戻さない
  assert.doesNotMatch(src, /^published:\s*\$\{/m);
  assert.match(src, /^published: false$/m);
});

test("どのスクリプトも Zenn 原稿を published: true で書かず、zenn_drafts/ もすべて下書き", () => {
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
    assert.doesNotMatch(s, /^published:\s*\$\{/m, f);
  }
  const drafts = fs.readdirSync("zenn_drafts").filter((f) => f.endsWith(".md"));
  assert.ok(drafts.length > 0);
  for (const f of drafts) {
    const s = readText(path.join("zenn_drafts", f));
    assert.doesNotMatch(s, /^published:\s*true\b/m, f);
    assert.match(frontmatter(s), /^published:\s*false\s*$/m, `${f}: front matter に published: false が無い`);
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

test("Zenn の確認: 非公開にした記事が公開中のままなら警告し、自動公開の停止中は「連携が未設定」と言わない", () => {
  const frozen = [
    { slug: "aaa-tech-radar", published: false, live: false },
    { slug: "bbb-tech-radar", published: false, live: false },
  ];
  assert.deepEqual(zennWarnings(frozen), []);
  const stuck = [...frozen, { slug: "ccc-tech-radar", published: false, live: true, likes: 1, user: "u" }];
  assert.deepEqual(zennSummary(stuck).stillLive, ["ccc-tech-radar"]);
  const w = zennWarnings(stuck);
  assert.equal(w.length, 1);
  assert.match(w[0], /ccc-tech-radar/);
  // 公開するはずの記事が 1 本も公開されていない場合は、従来どおり連携の未設定を疑う警告
  assert.match(zennWarnings([{ slug: "ddd-tech-radar", published: true, live: false }]).join(), /GitHub 連携が未設定/);
});

test("Zenn の確認: 1 本も確認できない（API が 403 を返すなど）ときは黙らず、「確認できない」と警告する", () => {
  // 2026-10-21 時点の scripts/zenn_status.json は全記事 HTTP 403（CI からは公開状態を確かめられていない）
  const blocked = [
    { slug: "aaa-tech-radar", published: false, live: null, status: 403 },
    { slug: "bbb-tech-radar", published: false, live: null, error: "fetch failed" },
  ];
  const w = zennWarnings(blocked);
  assert.equal(w.length, 1, w.join("\n"));
  assert.match(w[0], /1 本も確認できませんでした（2 本すべて HTTP 403, fetch failed）/);
  // 確認できないことを「公開されていない（連携が未設定）」とは言わない
  assert.doesNotMatch(zennWarnings([{ slug: "ddd-tech-radar", published: true, live: null, status: 403 }]).join(), /GitHub 連携が未設定/);
  // 一部でも確認できていれば、この警告は出さない
  assert.deepEqual(zennWarnings([...blocked, { slug: "ccc-tech-radar", published: false, live: false }]), []);
});
