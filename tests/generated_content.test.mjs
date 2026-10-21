// 生成した Web 記事の整形（scripts/utils/generated_content.mjs）: frontmatter の書き換え・コードブロックの扱い・保存前の最終検査
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { parseFrontmatter } from "astro/markdown";
import {
  setFrontmatterField, quoteFrontmatterStrings, unwrapMarkdownFence, closeOpenFence,
  sanitizeMarkdownContent, frontmatterProblems, finalWebArticleProblems,
} from "../scripts/utils/generated_content.mjs";

const FM = '---\nlayout: "../../layouts/Layout.astro"\ntitle: "x"\ndescription: "Save $$ and $& and $\' on hosting"\npubDate: "2000-01-01"\nrepoUrl: "https://github.com/a/b"\nstars: 1\n---\n# x\n本文 $$ $&\n';

test("frontmatter の項目の書き換えで、ほかの行の $$ $& $' が置換パターンとして解釈されない", () => {
  const out = setFrontmatterField(FM, "pubDate", '"2026-10-21"');
  assert.equal(out, FM.replace('pubDate: "2000-01-01"', () => 'pubDate: "2026-10-21"'));
  const added = setFrontmatterField(FM, "generator_model", '"m-$&"');
  assert.match(added, /^generator_model: "m-\$&"$/m);
  assert.ok(added.includes("Save $$ and $& and $' on hosting"));
  assert.ok(added.endsWith("# x\n本文 $$ $&\n"));
  // CRLF の原稿・frontmatter の無い本文
  assert.equal(setFrontmatterField("---\r\na: 1\r\n---\r\nbody", "a", "2"), "---\r\na: 2\r\n---\r\nbody");
  assert.equal(setFrontmatterField("no frontmatter", "a", "2"), "no frontmatter");
});

test("タイトル・説明文は YAML として正しい文字列に書き直し、\\ \" $$ をそのまま残す", () => {
  const raw = String.raw`C:\Users\you "quoted" \LaTeX $$`;
  const md = `---\ntitle: "t - ${raw}"\ndescription: ${raw}\npubDate: "2026-10-21"\nrepoUrl: "u"\nstars: 1\n---\nbody`;
  assert.throws(() => parseFrontmatter(md)); // 書き直す前はサイトのビルドが止まる
  const out = quoteFrontmatterStrings(md);
  const { frontmatter } = parseFrontmatter(out);
  assert.equal(frontmatter.title, `t - ${raw}`);
  assert.equal(frontmatter.description, raw);
  assert.deepEqual(frontmatterProblems(out), []);
  // 生成モデルが正しくエスケープした \" や単引用符の文字列も元の文字列になる
  assert.equal(parseFrontmatter(quoteFrontmatterStrings('---\ntitle: "a \\"b\\""\ndescription: \'it\'\'s\'\n---\n')).frontmatter.title, 'a "b"');
  assert.equal(parseFrontmatter(quoteFrontmatterStrings('---\ntitle: "a"\ndescription: \'it\'\'s\'\n---\n')).frontmatter.description, "it's");
});

test("```markdown の包みだけを外し、記事の最後のコードブロックの閉じは残す", () => {
  const article = "---\ntitle: x\n---\n# x\n```mermaid\ngraph TD\n  A --> B\n```";
  assert.equal(unwrapMarkdownFence(article), article);
  assert.equal(unwrapMarkdownFence("```markdown\n" + article + "\n```"), article);
  assert.equal(unwrapMarkdownFence("```md\n# x\n```"), "# x");
  assert.equal(closeOpenFence("a\n```js\nx"), "a\n```js\nx\n```\n");
  assert.equal(closeOpenFence(article), article);
});

test("テーブルの整形はコードブロックの中（YAML のインデント・Python の型の |）を崩さない", () => {
  const code = "```yaml\nservices:\n  app:\n    command: |\n      echo a || echo b\n```\n```python\ndef f(x: int | None):\n        return x\n```";
  assert.equal(sanitizeMarkdownContent(code), code);
  // 暴走した連続空白は、コードブロックの中でも詰める
  assert.equal(sanitizeMarkdownContent("```\na" + " ".repeat(80) + "b\n```"), "```\na b\n```");
  // コードブロックの外のテーブルは従来どおり整える
  assert.equal(sanitizeMarkdownContent("| a  |  b |\n|" + "-".repeat(40) + "|"), "| a | b |\n|:---|");
});

test("保存前の最終検査: frontmatter をビルドと同じ方法で読めない・Mermaid 図が描画できない・コードブロックが閉じていない記事を見つける", async () => {
  const ok = '---\ntitle: "x"\ndescription: "d"\npubDate: "2026-10-21"\nrepoUrl: "https://github.com/a/b"\nstars: 1\n---\n# x\n```mermaid\ngraph TD\n  A["a"] --> B["b"]\n```\n';
  assert.deepEqual(await finalWebArticleProblems(ok), []);
  assert.ok((await finalWebArticleProblems(ok.replace('title: "x"', String.raw`title: "C:\Users"`))).some((p) => /YAML/.test(p)));
  assert.ok((await finalWebArticleProblems(ok.replace("stars: 1", 'stars: "1"'))).some((p) => /stars/.test(p)));
  assert.ok((await finalWebArticleProblems(ok.replace('A["a"]', "A[a (b)]"))).length > 0);
  assert.ok((await finalWebArticleProblems(ok + "```js\nx\n")).some((p) => /閉じていない/.test(p)));
  assert.ok((await finalWebArticleProblems(ok.replace(/```mermaid[\s\S]*```\n/, ""))).some((p) => /Mermaid/.test(p)));
  // 品質ゲート（audit_quality）の Web 記事の検査と同じ: 有料キットの見出し・異常な長大空白
  assert.ok((await finalWebArticleProblems(ok + "## 見積シミュレーション表\n")).some((p) => /有料キット/.test(p)));
  assert.ok((await finalWebArticleProblems(ok + "\n".repeat(600))).some((p) => /長大空白/.test(p)));
});

// クラス単位の再発防止: 掲載中の全記事の frontmatter が、サイトのビルド（Astro）と同じ方法で読め、必要な項目がそろっている
test("掲載中の全記事の frontmatter は、サイトのビルドと同じ方法で読め、必要な項目がそろっている", () => {
  const dir = "src/pages/radar";
  const problems = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
    for (const p of frontmatterProblems(fs.readFileSync(path.join(dir, f), "utf8"))) problems.push(`${f}: ${p}`);
  }
  assert.deepEqual(problems, []);
});
