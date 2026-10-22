// 公開物（Web 記事・note の無料部分）は、上流の README で確かめられることだけを書く（leakhunt C3、2026-10-22）。
// README から「数値と単位」「URL のホスト」「コマンドの語」を取り出して data/readme_facts/<slug>.json に置き、
// 公開物にその集合に無いトークンがあれば赤にする。見出し（H2）は生成スクリプトのテンプレートの見出しの部分集合であること
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  extractQuantities, extractHosts, extractCommandWords, readmeFacts, ungroundedTokens,
  installSection, ledeText, factsFileFor, SITE_HOSTS,
} from "../scripts/utils/readme_facts.mjs";
import { WEB_TEMPLATE_H2, NOTE_FREE_TEMPLATE_H2, NOTE_FIXED_TEXT, h2Headings, webPageProblems, noteHeadProblems } from "../scripts/utils/article_template.mjs";
import { licenseStatementProblems } from "../scripts/utils/license_resolver.mjs";
import { licenseSection } from "../scripts/utils/license_section.mjs";
import { splitPaid } from "../scripts/utils/note_vault.mjs";
import { normalizeEol } from "../scripts/utils/eol.mjs";

const read = (p) => normalizeEol(fs.readFileSync(p, "utf8"));

test("数値と単位: 割合・倍率・時間・容量・金額を単位をそろえて取り出し、版数や日付は取り出さない", () => {
  assert.deepEqual(extractQuantities("クラウドAPIコストを90%削減"), ["90 %"]);
  assert.deepEqual(extractQuantities("月々のAPIコストを50〜70%削減"), ["50 %", "70 %"]);
  assert.deepEqual(extractQuantities("10〜30倍の高速化。README では 30x"), ["10 x", "30 x"]);
  assert.deepEqual(extractQuantities("p50 レイテンシ 236〜276ms → 32.8ms"), ["236 ms", "276 ms", "32.8 ms"]);
  assert.deepEqual(extractQuantities("ライセンス費用 約30万円/年、1,980円"), ["1980 円", "300000 円"]);
  assert.deepEqual(extractQuantities("Devin 月額$500〜/席、$0.042/1M tokens"), ["0.042 $", "500 $"]);
  assert.deepEqual(extractQuantities("即時（< 0.2秒）/ ~50MB"), extractQuantities("0.2 s and 50 MB"));
  assert.deepEqual(extractQuantities("Python 3.12 と 2026年10月21日、ポート 8000、v2.1"), []);
  // 中国語の README の単位も同じ単位にそろえる
  assert.deepEqual(extractQuantities("页面中位数 10 毫秒，48 小时内，3 分钟"), extractQuantities("10ms、48時間、3分"));
});

test("URL のホストを小文字・www なしで取り出す", () => {
  assert.deepEqual(extractHosts("[a](https://WWW.Example.com/x) と http://localhost:3000/admin と https://cdn.jsdelivr.net/gh/a@main/install.sh"), ["cdn.jsdelivr.net", "example.com", "localhost"]);
});

test("コマンドの語: コードブロック（言語の指定を問わず、Mermaid を除く）からコマンド・サブコマンド・フラグ・設定のキーを取り出す（URL・パス・引用符の中身は語にしない）", () => {
  const md = "```bash\n$ tokenspeed server --model Qwen/Qwen3 --port=8000\ncurl -fsSL https://x.dev/install.sh | sh\n```\n```text\nosb init\n```\n```mermaid\ngraph TD\n  A --> B\n```";
  assert.deepEqual(extractCommandWords(md), ["--model", "--port", "-fsSL", "curl", "init", "osb", "server", "sh", "tokenspeed"]);
  // README 側はすべてのコードブロックとインラインコードを許可の集合にする
  assert.ok(extractCommandWords("Run `tokenspeed serve <model>`.", { inline: true }).includes("serve"));
});

test("リポジトリの説明文（上流の作者が書いた GitHub の description）の数値も事実の集合に入れる", () => {
  const facts = readmeFacts("# t", { repo: "o/t", description: "7–14 ms short decisions" });
  assert.deepEqual(ungroundedTokens("7〜14ミリ秒で判定します。", facts), []);
});

test("README に無い数値・ホスト・コマンドの語を公開物から見つける", () => {
  const facts = readmeFacts("# t\n## Install\n```bash\ntokenspeed serve model\n```\nSee https://lightseek.org/docs. p50 32.8ms.", { repo: "o/t" });
  const page = "32.8ms で動きます。コストを90%削減。\n```bash\ntokenspeed server --model model\n```\n[docs](https://lightseek.org/docs) [mirror](https://cdn.jsdelivr.net/gh/o/t@main/x)";
  assert.deepEqual(ungroundedTokens(page, facts), [
    { kind: "quantity", token: "90 %" },
    { kind: "host", token: "cdn.jsdelivr.net" },
    { kind: "command", token: "--model" },
    { kind: "command", token: "server" },
  ]);
  assert.deepEqual(ungroundedTokens(`[repo](https://github.com/o/t) [site](https://${SITE_HOSTS[0]}/x/)`, facts), []);
});

test("略語の展開: README に無い展開（MCP を Multi-tool Coordination Protocol と書く等）を見つけ、README にある展開と略語でない括弧書きは見つけない", () => {
  const facts = readmeFacts("# rea\nOne MCP for reverse engineering. Uses Sliding Window Attention (SWA) and React Router.", { repo: "o/rea" });
  assert.deepEqual(ungroundedTokens("単一のMCP（Multi-tool Coordination Protocol）を通じて解析します。", facts), [{ kind: "expansion", token: "MCP=multi-tool coordination protocol" }]);
  assert.deepEqual(ungroundedTokens("SWA (Sliding Window Attention) と React Router（SSR）と API (Sparse Protocol)", facts), []);
  const mcp = readmeFacts("Built on the Model Context Protocol.", {});
  assert.deepEqual(ungroundedTokens("Model Context Protocol（MCP）に対応", mcp), []);
});

test("導入手順は README のコードブロックをそのまま出典つきで転記し、取得したスクリプトをそのまま実行する形には注意を付ける", () => {
  const readme = "# t\n\n## Installation\n\n```bash\npip install t\n```\n\nWindows:\n\n```powershell\nirm https://t.dev/i.ps1 | iex\n```\n\n## Other\n\n```bash\nnot-install\n```\n";
  const facts = readmeFacts(readme, { repo: "o/t" });
  const sec = installSection(facts, "https://github.com/o/t");
  assert.ok(sec.includes("```bash\npip install t\n```"), sec);
  assert.ok(sec.includes("```powershell\nirm https://t.dev/i.ps1 | iex\n```"), sec);
  assert.ok(!sec.includes("not-install"), sec);
  assert.match(sec, /\[README\]\(https:\/\/github\.com\/o\/t#readme\)/);
  assert.match(sec, /スクリプトをそのまま実行/);
  const plain = installSection(readmeFacts("# t\n## Install\n```bash\npip install t\n```\n", { repo: "o/t" }), "https://github.com/o/t");
  assert.doesNotMatch(plain, /スクリプトをそのまま実行/);
  // 取得したスクリプトをファイルに保存してすぐ実行する形も同じ注意を付ける
  const saved = installSection(readmeFacts("# t\n## Install\n```sh\ncurl -fsSL 'https://t.dev/i.sh' -o /tmp/i.sh && HOST=cli sh /tmp/i.sh\n```\n", { repo: "o/t" }), "https://github.com/o/t");
  assert.match(saved, /スクリプトをそのまま実行/);
  // 転記した手順は、それ自体が README の事実の集合に収まる
  assert.deepEqual(ungroundedTokens(sec, facts), []);
});

test("ライセンスの節は SPDX・確認先のリンク・法的助言でない旨の定型文だけで、ライセンス表記の検査を満たす", () => {
  for (const info of [
    { status: "resolved", spdx: "MIT", name: "MIT License", url: "https://github.com/o/t/blob/main/LICENSE", sourceAvailable: false, extraNotices: [] },
    { status: "resolved", spdx: "BUSL-1.1", name: "Business Source License 1.1", url: "https://github.com/o/t/blob/main/LICENSE", sourceAvailable: true, extraNotices: ["本番利用の条件は LICENSE ファイル参照"] },
    { status: "none", spdx: null, name: null, url: "https://github.com/o/t", sourceAvailable: false, extraNotices: [] },
    { status: "unknown", spdx: null, name: null, url: "https://github.com/o/t", sourceAvailable: false, extraNotices: [] },
  ]) {
    const sec = licenseSection(info);
    assert.deepEqual(licenseStatementProblems(`# t\n${sec}`, info), [], sec);
    assert.match(sec, /法的な助言ではありません/);
    assert.ok(sec.includes(`](${info.url})`), sec);
    assert.doesNotMatch(sec, /商用利用(?:は|が|も)?(?:可能|でき)|完全に許可|安心して/);
  }
});

test("リードは作成日とスター数の記録だけから作る", () => {
  const lede = ledeText({ full_name: "o/t", created_at: "2026-09-24T16:17:19Z", date: "2026-10-13", stars: 12071 });
  assert.match(lede, /2026-09-25/); // 作成日は日本時間
  assert.match(lede, /12,071/);
  assert.doesNotMatch(lede, /数ヶ月|シリコンバレー|注目|急上昇|1位/);
});

// ---- 公開中のすべてのページに遡って適用する ----
const radarDir = "src/pages/radar";
const pages = fs.readdirSync(radarDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
const notes = fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md")).map((f) => f.replace(/_note\.md$/, ""));
const factsOf = (slug) => JSON.parse(read(factsFileFor(slug)));
const fixedTokens = readmeFacts(NOTE_FIXED_TEXT, {});

test("公開中のすべての Web 記事と note 原稿に、README の事実の集合（data/readme_facts）がある", () => {
  assert.ok(pages.length > 30 && notes.length > 30);
  const missing = [...new Set([...pages, ...notes])].filter((s) => !fs.existsSync(factsFileFor(s)));
  assert.deepEqual(missing, []);
});

test("Web 記事（frontmatter の題名・説明文を含む）に、README で確かめられない数値・ホスト・コマンドの語が無い", () => {
  const bad = [];
  for (const slug of pages) {
    // frontmatter の title・description も公開される（検索結果・SNS のカードに出る）ので、ページ全体を見る
    const hits = ungroundedTokens(read(path.join(radarDir, `${slug}.md`)), factsOf(slug));
    if (hits.length) bad.push(`${slug}: ${hits.map((h) => `${h.kind}:${h.token}`).join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

test("note の無料部分に、README で確かめられない数値・ホスト・コマンドの語が無い（価格など定型文の値は除く）", () => {
  const bad = [];
  for (const slug of notes) {
    const parts = splitPaid(read(path.join("note_drafts", `${slug}_note.md`)));
    assert.ok(parts, slug);
    const hits = ungroundedTokens(parts.head.join("\n"), factsOf(slug), fixedTokens);
    if (hits.length) bad.push(`${slug}: ${hits.map((h) => `${h.kind}:${h.token}`).join(", ")}`);
  }
  assert.deepEqual(bad, []);
});

test("Web 記事と note の無料部分の H2 見出しは、生成スクリプトのテンプレートの見出しの部分集合", () => {
  const bad = [];
  for (const slug of pages) {
    for (const h of h2Headings(read(path.join(radarDir, `${slug}.md`)))) if (!WEB_TEMPLATE_H2.includes(h)) bad.push(`${slug}.md: ${h}`);
  }
  for (const slug of notes) {
    const head = splitPaid(read(path.join("note_drafts", `${slug}_note.md`))).head.join("\n");
    for (const h of h2Headings(head)) if (!NOTE_FREE_TEMPLATE_H2.includes(h)) bad.push(`${slug}_note.md: ${h}`);
  }
  assert.deepEqual(bad, []);
});

// ---- 公開物の形: 決まった節と原文つきの文だけ（scripts/utils/page_shape.mjs、leakhunt C3 の再発防止） ----
// 原文を伴わない行（比較表・H3 の小節・自由な段落・インラインのコマンド・素のホスト名）や、訳が原文を超える文
// （原文に無い固有名・数値、評価・比較・利用条件・費用・評判の語）は、どの節に入れても赤になる
const fmtProblems = (slug, ps) => ps.map((p) => `${slug}: ${p.kind}: ${p.detail}`);
const paidFeatures = (slug) => {
  const f = path.join("note_drafts", `${slug}_note.paid.json`);
  return fs.existsSync(f) ? JSON.parse(read(f)).features : [];
};

test("掲載中のすべての Web 記事は、決まった節と原文つきの文（README の文とその訳）と構成図だけでできている", () => {
  const bad = [];
  for (const slug of pages) bad.push(...fmtProblems(slug, webPageProblems(read(path.join(radarDir, `${slug}.md`)), factsOf(slug))));
  assert.deepEqual(bad, []);
});

test("すべての note 原稿の無料部分は、題名・リード・原文つきの文・有料版の内容一覧・価格の案内だけでできている", () => {
  const bad = [];
  for (const slug of notes) {
    const head = splitPaid(read(path.join("note_drafts", `${slug}_note.md`))).head.join("\n");
    bad.push(...fmtProblems(slug, noteHeadProblems(head, factsOf(slug), paidFeatures(slug))));
  }
  assert.deepEqual(bad, []);
});
