// 掲載中の Web 記事と note 原稿の無料部分を、公開物の形（scripts/utils/page_shape.mjs）で作り直す（leakhunt C3・C4、2026-10-22）。
// - 本文は原文つきの文（README の文とその訳）だけ。リード・成熟度・インストール・ライセンス・README の図の転記は data/readme_facts/<slug>.json から作る
// - note の無料部分は、題名・リード・原文つきの文・有料版の内容一覧（*.paid.json）・価格の案内だけ。暗号化した有料部分と末尾は変えない
// 原文つきの文は、--statements に渡した JSON（{ slug: { overview: [{ ja, quote }], architecture: [...], note: [...] } }。note は記事ページの無い原稿用）
// から取る。渡さない slug は、記事に今ある原文つきの文をそのまま使う（README の事実の集合を作り直したあとに、決まった節だけを作り直す）。
// 作り直した結果は、テストと同じ検査（webPageProblems / noteHeadProblems）を通らなければ書き込まない。
//   node scripts/reground_pages.mjs [--statements file.json] [slug ...]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { normalizeEol } from "./utils/eol.mjs";
import { factsFileFor } from "./utils/readme_facts.mjs";
import { parseStatements } from "./utils/anchored.mjs";
import { renderWebPage, webPageProblems, renderNoteHead, noteHeadProblems, WEB_H2, NOTE_H2, NOTE_PAID_LIST_HEADING } from "./utils/page_shape.mjs";
import { splitPaid } from "./utils/note_vault.mjs";

export const CORRECTION_DATE = "2026-10-22";
export const CORRECTION_NOTE = "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました";

const field = (fm, k) => (fm.match(new RegExp(`^${k}:\\s*["']?([^"'\\n]*)["']?\\s*$`, "m")) || [])[1]?.trim() || null;
const DROP_KEYS = /^(?:title|description):/;

function withCorrection(fm) {
  if (fm.includes(CORRECTION_NOTE)) return fm;
  const item = [`  - date: "${CORRECTION_DATE}"`, `    note: "${CORRECTION_NOTE}"`];
  const lines = fm.split("\n");
  const at = lines.findIndex((l) => /^corrections:\s*$/.test(l));
  if (at === -1) return [...lines, "corrections:", ...item].join("\n");
  let end = at + 1;
  while (end < lines.length && /^\s+/.test(lines[end])) end++;
  lines.splice(end, 0, ...item);
  return lines.join("\n");
}

// タグ: 言語・OSS・GitHub と README の語だけを残す
function keptTags(fm, facts) {
  const m = fm.match(/^tags:\s*(\[.*\])\s*$/m);
  let tags = [];
  try {
    tags = m ? JSON.parse(m[1]) : [];
  } catch {
    tags = [];
  }
  const words = new Set(facts.words || []);
  const allow = (t) => ["oss", "github", String(facts.language || "").toLowerCase()].includes(t.toLowerCase()) || words.has(t.toLowerCase());
  return [...new Set(tags.map(String).filter(allow))];
}

// 記事に今ある原文つきの文（概要・主な機能と構成）
export function pageStatements(md) {
  const body = normalizeEol(md).replace(/^---\n[\s\S]*?\n---\n?/, "");
  const lines = body.split("\n");
  const h1 = lines.findIndex((l) => /^# /.test(l));
  const firstH2 = lines.findIndex((l, i) => i > h1 && /^## /.test(l));
  const arch = lines.findIndex((l) => l === WEB_H2.architecture);
  const archEnd = lines.findIndex((l, i) => i > arch && /^## /.test(l));
  const strip = (ss) => ss.map(({ ja, quote }) => ({ ja, quote }));
  return {
    overview: strip(parseStatements(lines.slice(h1 + 1, firstH2)).statements),
    architecture: arch === -1 ? [] : strip(parseStatements(lines.slice(arch + 1, archEnd === -1 ? lines.length : archEnd)).statements),
  };
}

export function regroundWeb(md, facts, statements) {
  const text = normalizeEol(md);
  let fm = text.match(/^---\n([\s\S]*?)\n---/)[1];
  fm = fm.split("\n").filter((l) => !DROP_KEYS.test(l)).join("\n");
  fm = fm.replace(/^tags:.*$/m, `tags: ${JSON.stringify(keptTags(fm, facts))}`);
  fm = /^updatedDate:/m.test(fm) ? fm.replace(/^updatedDate:.*$/m, `updatedDate: "${CORRECTION_DATE}"`) : `${fm}\nupdatedDate: "${CORRECTION_DATE}"`;
  fm = withCorrection(fm);
  const name = String(facts.repo).split("/")[1];
  return renderWebPage({ frontmatter: fm, name, stars: field(fm, "stars"), date: field(fm, "pubDate"), overview: statements.overview, architecture: statements.architecture, facts });
}

// note 原稿の無料部分に今ある原文つきの文（記事ページの無い原稿用）
export function noteStatements(md) {
  const head = splitPaid(normalizeEol(md)).head;
  const at = head.findIndex((l) => l === NOTE_H2.features);
  if (at === -1) return [];
  const end = head.findIndex((l, i) => i > at && (l === NOTE_PAID_LIST_HEADING || l.startsWith("> 💡")));
  return parseStatements(head.slice(at + 1, end === -1 ? head.length : end)).statements.map(({ ja, quote }) => ({ ja, quote }));
}

export function regroundNote(md, { facts, features, stars, date, statements }) {
  const parts = splitPaid(normalizeEol(md));
  const title = parts.head.find((l) => /^# \S/.test(l));
  const head = renderNoteHead({ title, stars, date, statements, features, facts });
  return [head, ...parts.paid, ...parts.tail].join("\n");
}

function main(argv) {
  const at = argv.indexOf("--statements");
  const given = at === -1 ? {} : JSON.parse(fs.readFileSync(argv[at + 1], "utf8"));
  const only = argv.filter((a, i) => a !== "--statements" && i !== at + 1);
  const radar = "src/pages/radar";
  const slugs = new Set(only.length ? only : [
    ...fs.readdirSync(radar).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")),
    ...fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md")).map((f) => f.replace(/_note\.md$/, "")),
  ]);
  let failed = 0;
  for (const slug of slugs) {
    const facts = JSON.parse(fs.readFileSync(factsFileFor(slug), "utf8"));
    const page = path.join(radar, `${slug}.md`);
    const note = path.join("note_drafts", `${slug}_note.md`);
    const problems = [];
    let fm = "";
    let st = given[slug] || null;
    let web = null;
    if (fs.existsSync(page)) {
      const src = fs.readFileSync(page, "utf8");
      fm = normalizeEol(src).match(/^---\n([\s\S]*?)\n---/)[1];
      st = st || pageStatements(src);
      web = regroundWeb(src, facts, st);
      problems.push(...webPageProblems(web, facts).map((p) => `web ${p.kind}: ${p.detail}`));
    }
    let noteText = null;
    if (fs.existsSync(note)) {
      const summary = note.replace(/\.md$/, ".paid.json");
      const features = fs.existsSync(summary) ? JSON.parse(fs.readFileSync(summary, "utf8")).features : [];
      const src = fs.readFileSync(note, "utf8");
      const statements = st?.note || (st ? [...st.overview, ...st.architecture] : noteStatements(src));
      // スター数と日付は記事の記録（記事ページの frontmatter）。記事ページの無い原稿は作成日だけを書く
      noteText = regroundNote(src, { facts, features, statements, stars: fm ? field(fm, "stars") : null, date: fm ? field(fm, "pubDate") : null });
      problems.push(...noteHeadProblems(splitPaid(noteText).head.join("\n"), facts, features).map((p) => `note ${p.kind}: ${p.detail}`));
    }
    if (problems.length) {
      failed++;
      console.error(`✖ ${slug}\n  ${problems.join("\n  ")}`);
      continue;
    }
    if (web) fs.writeFileSync(page, web, "utf8");
    if (noteText) fs.writeFileSync(note, noteText, "utf8");
    console.log(`✓ ${slug}`);
  }
  if (failed) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
