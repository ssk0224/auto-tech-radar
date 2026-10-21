// Zenn への自動公開の停止（2026-10-21）が戻らないことを確かめる。
// Zenn の規約（機械生成の文章・宣伝目的のコンテンツの禁止、AI による大量生成への指針）に沿わないため、
// articles/*.md はすべて published: false（下書き）にし、生成スクリプトも published: false でしか書かない
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { zennSummary, zennWarnings } from "../scripts/check_zenn.mjs";

const frontmatter = (s) => s.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";

test("articles/*.md に published: true の記事が無い（すべて published: false）", () => {
  const files = fs.readdirSync("articles").filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const s = fs.readFileSync(path.join("articles", f), "utf8");
    assert.doesNotMatch(s, /^published:\s*true\b/m, f);
    assert.match(frontmatter(s), /^published:\s*false\s*$/m, `${f}: front matter に published: false が無い`);
  }
});

test("生成スクリプトは Zenn 原稿を published: false でしか書かない", () => {
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  assert.doesNotMatch(src, /^published:\s*true\b/m);
  // 条件しだいで true になる書き方（published: ${...}）も戻さない
  assert.doesNotMatch(src, /^published:\s*\$\{/m);
  assert.match(src, /^published: false$/m);
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
