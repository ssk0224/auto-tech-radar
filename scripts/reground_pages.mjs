// 掲載中の Web 記事と note 原稿の無料部分を、生成スクリプトのテンプレート（scripts/utils/article_template.mjs）の形に作り直す（leakhunt C3・C4、2026-10-22）。
// - Web 記事: 生成モデルが書く節（概要・成熟度の目安・課題とアーキテクチャ）だけを残し、競合比較・活用アイデア・旧インストール・旧ライセンスの節を削除する。
//   リード・インストール（README のコードブロックの転記）・ライセンス（LICENSE の判定と確認先）は data/readme_facts/<slug>.json から作る。訂正の記録（corrections）を足す
// - note 原稿の無料部分: 題名・「主な機能とアーキテクチャ概要」の節（クイックスタートの小節を除く）だけを残し、リードと有料版の内容一覧（*.paid.json）と価格の案内を決まった形で入れる。
//   暗号化した有料部分と末尾（メンバーシップの案内・ハッシュタグ）は変えない
// 何度実行しても同じ結果になる（リード・決まった節は作り直す）。
//   node scripts/reground_pages.mjs [slug ...]
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { normalizeEol } from "./utils/eol.mjs";
import { factsFileFor, installSection, ledeText } from "./utils/readme_facts.mjs";
import { licenseSection } from "./utils/license_section.mjs";
import { WEB_LLM_H2, NOTE_H2, NOTE_PRICE_BOX, NOTE_PAYWALL, assembleWebArticle, assembleNoteHead } from "./utils/article_template.mjs";
import { splitPaid } from "./utils/note_vault.mjs";
import { setFrontmatterField } from "./utils/generated_content.mjs";

export const CORRECTION_DATE = "2026-10-22";
export const CORRECTION_NOTE = "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました";

const LEDE_RE = /^\S+\/\S+ は (?:\d{4}-\d{2}-\d{2} に GitHub で作成された|GitHub で公開されている)リポジトリです。/;
const field = (fm, k) => (fm.match(new RegExp(`^${k}:\\s*["']?([^"'\\n]*)["']?\\s*$`, "m")) || [])[1]?.trim() || null;

// 本文を H2（コードブロックの外）で分ける: [{ heading|null, lines }]
function sections(body) {
  const out = [{ heading: null, lines: [] }];
  let fence = null;
  for (const line of body.split("\n")) {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) fence = fence ? (f[1][0] === fence ? null : fence) : f[1][0];
    if (!fence && !f && /^## /.test(line)) out.push({ heading: line.trimEnd(), lines: [] });
    else out.at(-1).lines.push(line);
  }
  return out;
}

function withCorrection(text) {
  const fm = text.match(/^---\n([\s\S]*?)\n---/)[1];
  if (fm.includes(CORRECTION_NOTE)) return text;
  const item = [`  - date: "${CORRECTION_DATE}"`, `    note: "${CORRECTION_NOTE}"`];
  const lines = fm.split("\n");
  const at = lines.findIndex((l) => /^corrections:\s*$/.test(l));
  if (at === -1) lines.push("corrections:", ...item);
  else {
    let end = at + 1;
    while (end < lines.length && /^\s+/.test(lines[end])) end++;
    lines.splice(end, 0, ...item);
  }
  return text.replace(/^---\n[\s\S]*?\n---/, () => `---\n${lines.join("\n")}\n---`);
}

export function regroundWeb(md, facts) {
  const text = normalizeEol(md);
  const fmBlock = text.match(/^---\n[\s\S]*?\n---\n?/)[0];
  const fm = fmBlock.slice(4, -4);
  const repoUrl = field(fm, "repoUrl");
  const secs = sections(text.slice(fmBlock.length));
  const intro = secs[0].lines
    .map((l) => l.replace(/^(# .*?):\s*概要と革新性\s*$/, "$1: 概要"))
    .filter((l) => !LEDE_RE.test(l));
  const kept = [];
  for (const s of secs.slice(1)) {
    if (/^## (?:概要と革新性|概要)\s*$/.test(s.heading)) intro.push(...s.lines); // 概要の節は題名の下の本文にまとめる
    else if (WEB_LLM_H2.includes(s.heading)) kept.push(s.heading, ...s.lines);
    // それ以外（競合比較・活用アイデア・旧インストール・旧ライセンス・決まった節）は捨てる（決まった節は下で作り直す）
  }
  const llm = `${fmBlock}\n${[...intro, ...kept].join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
  const lede = ledeText({ full_name: facts.repo, created_at: facts.created_at, date: field(fm, "pubDate"), stars: field(fm, "stars") });
  let out = assembleWebArticle(llm, { lede, install: installSection(facts, repoUrl), license: licenseSection(facts.license) });
  out = setFrontmatterField(out, "updatedDate", `"${CORRECTION_DATE}"`);
  return withCorrection(out);
}

// 「主な機能」の節の中で、無料部分に置かない小節（クイックスタート・受託の早見表・提案材料の宣伝・有料の案内）
const DROP_SUB_RE = /クイックスタート|クイックインストール|動作確認|インストール|環境構築|ビルドと実行|早見表|提案材料|受託案件|有料エリア|商用化/;
const SHELL_FENCE_RE = /^(?:|bash|sh|shell|zsh|console|terminal|powershell|ps1|pwsh|cmd|bat)$/i;
const FEATURES_H2_RE = /^## (?:主な機能とアーキテクチャ(?:概要)?|解決する主要な課題とアーキテクチャ)\s*$/;

export function regroundNoteHead(head, { facts, stars, date, features }) {
  const lines = normalizeEol(head).split("\n");
  const title = lines.find((l) => /^# \S/.test(l));
  const paywallAt = lines.findIndex((l) => /有料ライン|ここから先は有料/.test(l));
  let i = lines.findIndex((l) => FEATURES_H2_RE.test(l.trimEnd()));
  const body = [];
  if (i !== -1) {
    let skipping = false;
    let fence = null;
    for (i = i + 1; i < paywallAt; i++) {
      const l = lines[i];
      const f = l.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)/);
      if (fence) {
        if (!skipping && !fence.drop) body.push(l);
        if (f && f[1][0] === fence.ch) fence = null;
        continue;
      }
      if (f) {
        // シェルのコードブロック（導入コマンド）は無料部分に置かない（Web 記事に README から転記している）
        fence = { ch: f[1][0], drop: SHELL_FENCE_RE.test(f[2]) };
        if (!skipping && !fence.drop) body.push(l);
        continue;
      }
      if (/^## /.test(l) || /^> 💡/.test(l) || /^-{10,}$/.test(l.trim())) break;
      // 小節の始まり: H3・H4 の見出しか、太字だけの行（「**クイックスタート手順:**」など）
      if (/^#{3,4} /.test(l) || /^\*\*[^*]+\*\*\s*$/.test(l.trim())) skipping = DROP_SUB_RE.test(l);
      if (!skipping) body.push(l);
    }
  }
  // 有料ラインの行は定型文（価格は note の販売価格）にそろえる。公開側は区切り線と有料ラインの行まで（その後ろは暗号化した有料部分のプレースホルダ）
  const rebuilt = [title, "", NOTE_H2.features, ...body, "", NOTE_PRICE_BOX, "", ...NOTE_PAYWALL.split("\n").slice(0, 2)].join("\n");
  const lede = ledeText({ full_name: facts.repo, created_at: facts.created_at, date, stars });
  return assembleNoteHead(rebuilt, { lede, features });
}

export function regroundNote(md, ctx) {
  const parts = splitPaid(normalizeEol(md));
  const head = regroundNoteHead(parts.head.join("\n"), ctx);
  // 公開側の有料部分は暗号化のプレースホルダの行だけにする（区切り線は有料ラインの行の前に置く）
  const paid = parts.paid.filter((l) => !/^-{3,}\s*$/.test(l));
  return [head, ...paid, ...parts.tail].join("\n");
}

function main(only) {
  const radar = "src/pages/radar";
  const slugs = new Set(only.length ? only : [
    ...fs.readdirSync(radar).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")),
    ...fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md")).map((f) => f.replace(/_note\.md$/, "")),
  ]);
  for (const slug of slugs) {
    const facts = JSON.parse(fs.readFileSync(factsFileFor(slug), "utf8"));
    const page = path.join(radar, `${slug}.md`);
    let fm = "";
    if (fs.existsSync(page)) {
      const src = fs.readFileSync(page, "utf8");
      fm = normalizeEol(src).match(/^---\n([\s\S]*?)\n---/)[1];
      fs.writeFileSync(page, regroundWeb(src, facts), "utf8");
    }
    const note = path.join("note_drafts", `${slug}_note.md`);
    if (fs.existsSync(note)) {
      const summary = note.replace(/\.md$/, ".paid.json");
      const features = fs.existsSync(summary) ? JSON.parse(fs.readFileSync(summary, "utf8")).features : [];
      // スター数と日付は記事の記録（記事ページの frontmatter）。記事ページの無い原稿は作成日だけを書く
      const ctx = { facts, features, stars: fm ? field(fm, "stars") : null, date: fm ? field(fm, "pubDate") : null };
      fs.writeFileSync(note, regroundNote(fs.readFileSync(note, "utf8"), ctx), "utf8");
    }
    console.log(`✓ ${slug}`);
  }
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv.slice(2));
