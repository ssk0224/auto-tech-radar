// note 原稿の推奨ハッシュタグ: 記事の対象（言語・トピック）から 3〜5 個作り、#副業 #受託開発 のような
// 記事の内容と関係のない集客用タグを付けないこと。末尾フッターの判定（note_vault）を崩さないことも確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { noteHashtags, applyNoteHashtags } from "../scripts/utils/note_hashtags.mjs";
import { renderNoteDraft } from "../scripts/utils/page_shape.mjs";
import { splitPaid, noteDraftProblems, withStandardFooter, isFooterOnly, STANDARD_FOOTER } from "../scripts/utils/note_vault.mjs";

const UNRELATED = ["#副業", "#受託開発"];

test("言語とトピックから 3〜5 個のタグを作り、#OSS を必ず含める", () => {
  assert.deepEqual(noteHashtags({ language: "Go" }), ["#OSS", "#Go", "#GitHub"]);
  assert.deepEqual(noteHashtags({ language: "Python", topics: ["llm", "rag", "python", "agent", "mcp", "vllm"] }), ["#OSS", "#Python", "#llm", "#rag", "#agent"]);
  // ハイフン入りのトピックは単語のトピックの後。記号は _ に
  assert.deepEqual(noteHashtags({ language: "TypeScript", topics: ["self-hosted", "ai"] }), ["#OSS", "#TypeScript", "#ai", "#self_hosted"]);
  // 記号・空白を含む言語名、内容と無関係なトピック、数字だけのトピック
  assert.deepEqual(noteHashtags({ language: "C++", topics: ["hacktoberfest", "hacktoberfest2025", "github", "oss", "2025"] }), ["#OSS", "#Cpp", "#GitHub"]);
  assert.deepEqual(noteHashtags({ language: "Jupyter Notebook" }), ["#OSS", "#JupyterNotebook", "#GitHub"]);
  assert.deepEqual(noteHashtags({}), ["#OSS", "#GitHub", "#プログラミング"]);
  for (const repo of [{ language: "Rust", topics: ["副業", "受託開発", "cad"] }, { language: "Go" }]) {
    const tags = noteHashtags(repo);
    assert.ok(tags.length >= 3 && tags.length <= 5, tags.join(" "));
    for (const t of tags) assert.match(t, /^#[^\s#]+$/);
    for (const u of UNRELATED) assert.ok(!tags.includes(u), tags.join(" "));
  }
});

const PAID = "## 有料の中身\n" + "SECRET_PAID_BODY ".repeat(120);
const doc = (footer) => [
  "# タイトル", "無料の導入。領収書は購入・チップ履歴から発行できます。", "---",
  "【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】", "---", PAID, ...footer,
].join("\n") + "\n";

// 生成モデルが書いた末尾（タグ・案内のどんな形でも）は有料部分に入り、公開側の末尾はデータ（言語・トピック）から作った決まった形になる。
// 以前は生成モデルの末尾のタグ行を置き換えて公開側に残していたため、タグや案内の形をした有料本文が公開された（leakhunt #81、2026-10-22）
test("生成モデルが書いた末尾は有料部分に入り、公開側の末尾はデータから作ったタグと定型の案内だけになる", () => {
  const facts = { repo: "o/cadtool", language: "Rust", topics: ["cad"], created_at: null, publication: { date: "2026-10-22", stars: 1, gain7d: null } };
  const tags = noteHashtags({ language: "Rust", topics: ["cad"] });
  const cases = [
    // 生成モデルの出力（固定タグ）
    ["---", "### 🎁 【メンバーシップのご案内】", "メンバーシップの案内", "", "---", "**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）", "#AI #OSS #副業 #受託開発"],
    // 見出しと同じ行にタグ・空行を挟んで複数行のタグ
    ["---", "**【note出品時用 推奨ハッシュタグ】** #副業", "", "#受託開発 #AI", "#OSS"],
    // ハッシュタグの見出しが無い
    ["---", "### 🎁 【メンバーシップのご案内】", "メンバーシップの案内"],
    // タグの形をした短い有料本文
    ["---", "### 🎁 【メンバーシップのご案内】", "#受託単価は人日8万円", "#本番はポート8080", "---", "**【note出品時用 推奨ハッシュタグ】**", "#AI #OSS"],
  ];
  for (const footer of cases) {
    const out = renderNoteDraft({ facts, quotes: [], features: [], paid: [PAID, ...footer].join("\n") });
    const parts = splitPaid(out);
    assert.ok(parts.hasTail, out);
    assert.ok(isFooterOnly(parts.tail), out);
    assert.deepEqual(parts.tail.filter((l) => /^(#[^\s#]\S*\s*)+$/.test(l)), [tags.join(" ")], out);
    // 生成モデルが書いた行（区切り線以外）は、すべて有料部分にある
    for (const l of footer.filter((x) => x.trim() && !/^-{3,}$/.test(x))) assert.ok(parts.paid.includes(l), "生成モデルの末尾の行が有料部分に無い: " + l);
    for (const u of UNRELATED) assert.ok(!parts.tail.join("\n").includes(u), out);
    assert.ok(!parts.tail.join("\n").includes("SECRET_PAID_BODY"));
    assert.ok(out.endsWith("\n"));
  }
});

test("末尾が崩れた生成物に補う標準の末尾にも #副業 #受託開発 が無く、置き換え後も出品要件を満たす", () => {
  for (const u of UNRELATED) assert.ok(!STANDARD_FOOTER.includes(u));
  const broken = doc([]);
  const out = applyNoteHashtags(withStandardFooter(broken), noteHashtags({ language: "Go" }));
  assert.match(out, /^#OSS #Go #GitHub$/m);
  assert.deepEqual(noteDraftProblems(out), []);
});

test("既存の note 原稿・リードマグネットのハッシュタグ行に #副業 #受託開発 が無い（他のタグは残す）", () => {
  const files = fs.readdirSync("note_drafts").filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const s = fs.readFileSync(path.join("note_drafts", f), "utf8");
    const tagLines = s.split(/\r?\n/).filter((l) => /^(#\S+\s*)+$/.test(l));
    assert.ok(tagLines.length > 0, `${f}: ハッシュタグ行が無い`);
    for (const l of tagLines) {
      for (const u of UNRELATED) assert.ok(!l.split(/\s+/).includes(u), `${f}: ${l}`);
      assert.match(l, /#OSS/, f);
    }
  }
  const gen = fs.readFileSync("scripts/generate_lead_magnet_note.mjs", "utf8");
  for (const u of UNRELATED) assert.ok(!gen.includes(u), `generate_lead_magnet_note.mjs: ${u}`);
  const crawl = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  for (const u of UNRELATED) assert.ok(!crawl.includes(u), `crawl_and_generate.mjs: ${u}`);
  // 生成スクリプトは原稿の末尾を、記事の対象（言語・トピック）から作った決まった形（renderNoteDraft → noteFooter）で書く（leakhunt #81、2026-10-22）
  assert.match(crawl, /renderNoteDraft\(\{/);
});
