// 掲載中の Web 記事・note 原稿の公開部分（無料部分と末尾）を、データから決まった形（scripts/utils/page_shape.mjs）で
// 作り直す（leakhunt C3・C4、2026-10-22）。生成スクリプトが新しい記事を書くときと同じ関数を使う。
// - 本文に載せるのは、記事に今ある README の原文だけ（訳は載せない）。原文以外はすべて data/readme_facts/<slug>.json と *.paid.json から作る
// - data/readme_facts/<slug>.json に、掲載時の記録（publication: 記事の公開日・スター数）、GitHub のトピック（--topics の JSON）、
//   README の利用条件の記載（--readmes のディレクトリにある README から。README の本文はリポジトリに置かない）、
//   これまでの個別の訂正の記録の指紋（corrections_keys）を足す
// - note 原稿は、暗号化した有料部分（プレースホルダの行）を変えず、無料部分と末尾だけを書き直す
// 作り直した結果は、テストと同じ検査を通らなければ書き込まない。X の投稿文は作らない（止めた出力 x_posts/。scripts/utils/public_tree.mjs の RETIRED_OUTPUTS）
//   node scripts/reground_pages.mjs [--topics topics.json] [--readmes dir] [slug ...]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { normalizeEol } from "./utils/eol.mjs";
import { factsFileFor } from "./utils/readme_facts.mjs";
import { usageLines, sentenceKey } from "./utils/anchored.mjs";
import {
  renderWebPage, webPageProblems, renderNoteHead, noteHeadProblems, noteFooter, noteTailProblems, parseWebPage, CORRECTION_NOTES,
} from "./utils/page_shape.mjs";
import { splitPaid, SEALED_PLACEHOLDER_RE } from "./utils/note_vault.mjs";

export const CORRECTION_DATE = "2026-10-22";
const LEGACY_QUOTE_RE = /^\s*- 原文（README）: (.*)$/;
const quotesIn = (lines) => lines.map((l) => l.match(LEGACY_QUOTE_RE)).filter(Boolean).map((m) => m[1].trim());

// 記事に今ある README の原文（概要 = 題名と最初の H2 の間、主な機能と構成 = その節）
export function pageQuotes(md) {
  const body = normalizeEol(md).replace(/^---\n[\s\S]*?\n---\n?/, "").split("\n");
  const firstH2 = body.findIndex((l) => /^## /.test(l));
  const arch = body.findIndex((l) => /^## 主な機能と構成/.test(l));
  const archEnd = body.findIndex((l, i) => i > arch && /^## /.test(l));
  return {
    overview: quotesIn(body.slice(0, firstH2 === -1 ? body.length : firstH2)),
    architecture: arch === -1 ? [] : quotesIn(body.slice(arch + 1, archEnd === -1 ? body.length : archEnd)),
  };
}

// note 原稿の無料部分に今ある README の原文（有料版の内容一覧・価格の案内より前）
export function noteQuotes(md) {
  const head = splitPaid(normalizeEol(md)).head;
  const end = head.findIndex((l) => l.startsWith("### 🔒") || l.startsWith("> 💡"));
  return quotesIn(head.slice(0, end === -1 ? head.length : end));
}

// 記事ページの無い原稿の掲載時の記録は、原稿のリードから読む
function publicationFromNote(md) {
  const m = normalizeEol(md).match(/(\d{4}-\d{2}-\d{2}) 時点のスター数は ([\d,]+) です。/);
  return { date: m ? m[1] : null, stars: m ? Number(m[2].replace(/,/g, "")) : null, gain7d: null };
}

export function enrichFacts(facts, { page, noteMd, topics, readme }) {
  const out = { ...facts };
  if (!out.publication) out.publication = page ? { date: page.pubDate, stars: Number(page.stars), gain7d: null } : publicationFromNote(noteMd || "");
  if (topics) out.topics = topics;
  if (!out.topics) out.topics = [];
  const keys = new Set(out.sentences || []);
  // README の利用条件の記載は、事実の集合を作った時点の README にもあった文だけ（指紋が一致するもの）
  if (readme !== undefined) out.usage_lines = usageLines(readme).filter((u) => keys.has(sentenceKey(u)));
  if (!out.usage_lines) out.usage_lines = [];
  const legacy = (page?.corrections || []).map((c) => c.note).filter((n) => !Object.values(CORRECTION_NOTES).includes(n));
  out.corrections_keys = [...new Set([...(out.corrections_keys || []), ...legacy.map(sentenceKey)])].sort();
  return out;
}

export function regroundWeb(md, facts) {
  const page = parseWebPage(md);
  const quotes = pageQuotes(md);
  const corrections = page.corrections.some((c) => c.note === CORRECTION_NOTES.quotesOnly) ? page.corrections : [...page.corrections, { date: CORRECTION_DATE, note: CORRECTION_NOTES.quotesOnly }];
  return renderWebPage({ facts, ...quotes, updatedDate: CORRECTION_DATE, corrections, generatorModel: page.generatorModel });
}

export function regroundNote(md, facts, features, quotes) {
  const lines = normalizeEol(md).split("\n");
  const placeholder = lines.find((l) => SEALED_PLACEHOLDER_RE.test(l));
  if (!placeholder) throw new Error("暗号化済みの原稿ではありません");
  return `${[renderNoteHead({ facts, quotes, features }), placeholder, noteFooter(facts)].join("\n")}\n`;
}

function args(argv) {
  const opt = (k) => {
    const i = argv.indexOf(k);
    return i === -1 ? null : argv[i + 1];
  };
  const skip = new Set(["--topics", "--readmes"].flatMap((k) => (argv.includes(k) ? [argv.indexOf(k), argv.indexOf(k) + 1] : [])));
  return { topics: opt("--topics"), readmes: opt("--readmes"), only: argv.filter((_, i) => !skip.has(i)) };
}

function main(argv) {
  const { topics: topicsFile, readmes, only } = args(argv);
  const topics = topicsFile ? JSON.parse(fs.readFileSync(topicsFile, "utf8")) : {};
  const radar = "src/pages/radar";
  const slugs = new Set(only.length ? only : [
    ...fs.readdirSync(radar).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")),
    ...fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md")).map((f) => f.replace(/_note\.md$/, "")),
  ]);
  let failed = 0;
  for (const slug of slugs) {
    const pageFile = path.join(radar, `${slug}.md`);
    const noteFile = path.join("note_drafts", `${slug}_note.md`);
    const pageMd = fs.existsSync(pageFile) ? fs.readFileSync(pageFile, "utf8") : null;
    const noteMd = fs.existsSync(noteFile) ? fs.readFileSync(noteFile, "utf8") : null;
    const readmeFile = readmes ? path.join(readmes, `${slug}.md`) : null;
    const facts = enrichFacts(JSON.parse(fs.readFileSync(factsFileFor(slug), "utf8")), {
      page: pageMd ? parseWebPage(pageMd) : null,
      noteMd,
      topics: topics[slug]?.topics,
      readme: readmeFile && fs.existsSync(readmeFile) ? fs.readFileSync(readmeFile, "utf8") : undefined,
    });
    const problems = [];
    const summary = noteFile.replace(/\.md$/, ".paid.json");
    const features = fs.existsSync(summary) ? JSON.parse(fs.readFileSync(summary, "utf8")).features : [];
    let web = null;
    if (pageMd) {
      web = regroundWeb(pageMd, facts);
      problems.push(...webPageProblems(web, facts).map((p) => `web ${p.kind}: ${p.detail}`));
    }
    let noteText = null;
    if (noteMd) {
      const quotes = pageMd ? [...pageQuotes(pageMd).overview, ...pageQuotes(pageMd).architecture] : noteQuotes(noteMd);
      try {
        noteText = regroundNote(noteMd, facts, features, quotes);
        const parts = splitPaid(noteText);
        problems.push(...noteHeadProblems(parts.head.join("\n"), facts, features).map((p) => `note ${p.kind}: ${p.detail}`));
        problems.push(...noteTailProblems(parts.tail, facts).map((p) => `note tail ${p.kind}: ${p.detail}`));
      } catch (e) {
        problems.push(`note: ${e.message}`);
      }
    }
    if (problems.length) {
      failed++;
      console.error(`✖ ${slug}\n  ${problems.join("\n  ")}`);
      continue;
    }
    fs.writeFileSync(factsFileFor(slug), JSON.stringify(facts, null, 2) + "\n", "utf8");
    if (web) fs.writeFileSync(pageFile, web, "utf8");
    if (noteText) fs.writeFileSync(noteFile, noteText, "utf8");
    console.log(`✓ ${slug}${facts.usage_lines.length ? `（利用条件の記載 ${facts.usage_lines.length} 件）` : ""}`);
  }
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
