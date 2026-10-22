// 公開物の形（leakhunt C3、2026-10-22）。Web 記事と note の無料部分は、次のものだけでできている:
//   - データから決まった形で作る節: リード（作成日・スター数）、成熟度（README の開発段階の記載）、インストール（README のコードブロック）、
//     ライセンス（LICENSE の判定）、note の価格の案内・有料版の内容一覧（有料部分の節の題）
//   - 生成モデルが書く、原文つきの文（scripts/utils/anchored.mjs）。構成図は README にある図の転記だけ
// 生成スクリプトはこの関数で作り（renderWebPage / renderNoteHead）、保存前とテスト（tests/readme_grounding.test.mjs）で
// 同じ関数で確かめる（webPageProblems / noteHeadProblems）。それ以外の行（比較表・小節・自由な段落）があれば赤
import { normalizeEol } from "./eol.mjs";
import { renderStatements, parseStatements, statementProblems, maturitySection, MATURITY_HEADING } from "./anchored.mjs";
import { installSection, ledeText, INSTALL_HEADING } from "./readme_facts.mjs";
import { licenseSection, LICENSE_HEADING } from "./license_section.mjs";
import { setFrontmatterField } from "./generated_content.mjs";
import { jstDate } from "./selection.mjs";
import { RECEIPT_LINE } from "./receipt.mjs";

export const WEB_H2 = {
  maturity: MATURITY_HEADING,
  architecture: "## 主な機能と構成（README の要約）",
  install: INSTALL_HEADING,
  license: LICENSE_HEADING,
};
export const WEB_TEMPLATE_H2 = Object.values(WEB_H2);
export const NOTE_H2 = { intro: "## はじめに", features: "## 主な機能とアーキテクチャ概要" };
export const NOTE_FREE_TEMPLATE_H2 = Object.values(NOTE_H2);
export const NOTE_PAID_LIST_HEADING = "### 🔒 有料エリアの内容";
export const NOTE_PRICE = 980;
export const MEMBERSHIP_PRICE = 1980;
export const NOTE_PRICE_BOX = ["> 💡 **【価格と経費精算について】**", `> 本記事の価格は **${NOTE_PRICE}円** です。`, RECEIPT_LINE].join("\n");
export const NOTE_PAYWALL = [
  "--------------------------------------------------",
  `【有料ライン（推奨販売価格: ${NOTE_PRICE}円 / 月額${MEMBERSHIP_PRICE.toLocaleString("en-US")}円メンバーシップ特典）ここから先は有料会員限定】`,
  "--------------------------------------------------",
].join("\n");
// 無料部分の終わり（公開側は有料ラインの行まで。その後ろの区切り線から先が有料部分）
const NOTE_HEAD_END = NOTE_PAYWALL.split("\n").slice(0, 2).join("\n");

const repoName = (facts) => String(facts?.repo || "").split("/")[1] || "";
// 題名は「名前 - 概要の最初の文（句点を除く）」、説明文は概要の最初の文
export const titleFor = (name, first) => `${name} - ${first.replace(/。$/, "")}`;
const FM_RE = /^---\n([\s\S]*?)\n---\n?/;

// 構成図は生成モデルに描かせない（ラベルも矢印も README で確かめられない主張になる。leakhunt C3、2026-10-22）。
// README に Mermaid の図があれば、それだけをそのまま転記する（data/readme_facts の diagrams）
export const DIAGRAM_NOTE = "以下は README にある図を、そのまま転記したものです。";
const diagramLines = (facts) => (facts?.diagrams?.length ? [DIAGRAM_NOTE, "", ...facts.diagrams.flatMap((d) => ["```mermaid", d, "```", ""])] : []);

// ---- 本文を H1・H2 の見出し（コードブロックの外）で分ける。H3 以下の見出しは節の中の行（原文つきの文でないので stray）----
function sectionsOf(body) {
  const out = [{ heading: null, lines: [], start: 0 }];
  let fence = null;
  body.split("\n").forEach((line, i) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      out.at(-1).lines.push(line);
      return;
    }
    if (f) fence = f[1];
    if (!f && /^#{1,2} /.test(line)) out.push({ heading: line.trimEnd(), lines: [], start: i + 1 });
    else out.at(-1).lines.push(line);
  });
  return out;
}
// Mermaid のコードブロックを取り出し、残りの行（原文つきの文として読む）と分ける
function splitDiagrams(lines) {
  const rest = [];
  const diagrams = [];
  let notes = 0;
  for (let i = 0; i < lines.length; i++) {
    if (/^```mermaid\s*$/.test(lines[i])) {
      const j = lines.findIndex((l, k) => k > i && /^```\s*$/.test(l));
      if (j !== -1) {
        diagrams.push(lines.slice(i + 1, j).join("\n"));
        rest.push(...Array(j - i + 1).fill(""));
        i = j;
        continue;
      }
    }
    if (lines[i] === DIAGRAM_NOTE) {
      notes++;
      rest.push("");
      continue;
    }
    rest.push(lines[i]);
  }
  return { rest, diagrams, notes };
}
const sectionText = (s) => [s.heading, ...s.lines].join("\n").trim();
const ledeRe = (facts) => {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const created = facts?.created_at ? `${esc(facts.repo)} は ${jstDate(facts.created_at)} に GitHub で作成されたリポジトリです。` : `${esc(facts?.repo || "")} は GitHub で公開されているリポジトリです。`;
  return new RegExp(`^${created}(?:\\d{4}-\\d{2}-\\d{2} 時点のスター数は [\\d,]+ です。)?(?:Radar Ledger の記録では、直近 7 日間の増加数は [\\d,]+ です。)?$`);
};

function statementChecks(statements, facts, where) {
  const out = [];
  for (const st of statements) for (const p of statementProblems(st, facts)) out.push({ kind: p.kind, detail: `${where}「${st.ja.slice(0, 24)}」: ${p.detail}` });
  return out;
}
const strayChecks = (lines, stray, where) => stray.map((i) => ({ kind: "stray", detail: `${where}: 原文を伴わない行「${lines[i].trim().slice(0, 40)}」` }));

// ---- Web 記事 ----
export function renderWebPage({ frontmatter, name, stars, date, gain7d = null, overview, architecture = [], facts }) {
  const repoUrl = (frontmatter.match(/^repoUrl:\s*["']?([^"'\n]+)/m) || [])[1] || `https://github.com/${facts.repo}`;
  const lede = ledeText({ full_name: facts.repo, created_at: facts.created_at, date, stars, gain7d });
  const body = [
    `# ${name}: 概要`, "", lede, "", renderStatements(overview), "",
    maturitySection(facts).trimEnd(), "",
    WEB_H2.architecture, "", ...(architecture.length ? [renderStatements(architecture), ""] : []), ...diagramLines(facts),
    installSection(facts, repoUrl).trimEnd(), "",
    licenseSection(facts.license).trimEnd(), "",
  ].join("\n");
  let out = `---\n${frontmatter.trim()}\n---\n\n${body}`;
  out = setFrontmatterField(out, "title", JSON.stringify(titleFor(name, overview[0].ja)));
  out = setFrontmatterField(out, "description", JSON.stringify(overview[0].ja));
  return out; // 題名・説明文は JSON の文字列（YAML の二重引用符の文字列としてそのまま正しい）で書いている
}

const fmValue = (fm, key) => {
  const raw = (fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m")) || [])[1];
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^["']|["']$/g, "");
  }
};

export function webPageProblems(md, facts) {
  const text = normalizeEol(md);
  const fmm = text.match(FM_RE);
  const problems = [];
  const add = (kind, detail) => problems.push({ kind, detail });
  if (!fmm) return [{ kind: "shape", detail: "frontmatter がありません" }];
  const fm = fmm[1];
  const secs = sectionsOf(text.slice(fmm[0].length));
  const name = repoName(facts);
  if (secs[0].lines.some((l) => l.trim())) add("stray", "題名より前に本文があります");
  const headings = secs.slice(1).map((s) => s.heading);
  const expected = [`# ${name}: 概要`, ...WEB_TEMPLATE_H2];
  if (headings.join("\n") !== expected.join("\n")) add("shape", `見出しがテンプレートと違います（${headings.filter((h) => !expected.includes(h)).join(" / ") || "順序・欠落"}）`);
  const sec = (h) => secs.find((s) => s.heading === h);
  for (const s of secs.slice(1).filter((s) => !expected.includes(s.heading))) {
    problems.push(...strayChecks([s.heading, ...s.lines], [s.heading, ...s.lines].flatMap((l, i) => (l.trim() ? [i] : [])), "テンプレート外の節"));
  }
  const all = [];
  // 概要（題名の下）: リード + 原文つきの文
  const top = sec(`# ${name}: 概要`);
  if (top) {
    const lines = top.lines;
    const first = lines.findIndex((l) => l.trim());
    if (first === -1 || !ledeRe(facts).test(lines[first])) add("lede", "リードが作成日・スター数の記録の形ではありません");
    const rest = lines.map((l, i) => (i === first ? "" : l));
    const { statements, stray } = parseStatements(rest);
    problems.push(...strayChecks(rest, stray, "概要"));
    if (!statements.length) add("shape", "概要に原文つきの文がありません");
    problems.push(...statementChecks(statements, facts, "概要"));
    all.push(...statements);
    // 題名・説明文は概要の最初の文から作る
    if (statements.length) {
      if (fmValue(fm, "description") !== statements[0].ja) add("frontmatter", "description が概要の最初の文と違います");
      if (fmValue(fm, "title") !== titleFor(name, statements[0].ja)) add("frontmatter", "title が「名前 - 概要の最初の文」と違います");
    }
  }
  const arch = sec(WEB_H2.architecture);
  if (arch) {
    const { rest, diagrams, notes } = splitDiagrams(arch.lines);
    const { statements, stray } = parseStatements(rest);
    problems.push(...strayChecks(rest, stray, "主な機能と構成"));
    problems.push(...statementChecks(statements, facts, "主な機能と構成"));
    all.push(...statements);
    // 図は README の図の転記だけ（生成モデルが描いた図・README と違う図は赤）
    if (JSON.stringify(diagrams) !== JSON.stringify(facts?.diagrams || []) || notes !== (diagrams.length ? 1 : 0)) add("diagram", "図が README の図の転記と違います");
  }
  // データから決まった形で作る節は、作り直したものと同じであること
  const repoUrl = fmValue(fm, "repoUrl") || `https://github.com/${facts?.repo}`;
  for (const [h, want] of [[WEB_H2.maturity, maturitySection(facts)], [WEB_H2.install, installSection(facts, repoUrl)], [WEB_H2.license, licenseSection(facts?.license)]]) {
    const s = sec(h);
    if (s && sectionText(s) !== want.trim()) add("section", `${h} がデータから作った節と違います`);
  }
  // タグ: 言語・OSS・GitHub と、README の語だけ
  const tags = fmValue(fm, "tags");
  const words = new Set(facts?.words || []);
  const allowTags = new Set(["oss", "github", String(facts?.language || "").toLowerCase()]);
  for (const t of Array.isArray(tags) ? tags : []) {
    const k = String(t).toLowerCase();
    if (!allowTags.has(k) && !words.has(k)) add("frontmatter", `タグ「${t}」が README の語ではありません`);
  }
  return problems;
}

// ---- note の無料部分（有料ラインの行まで） ----
export function renderNoteHead({ title, stars, date, gain7d = null, statements, features, facts }) {
  const lede = ledeText({ full_name: facts.repo, created_at: facts.created_at, date, stars, gain7d });
  return [
    title, "", NOTE_H2.intro, "", lede, "", NOTE_H2.features, "", renderStatements(statements), "",
    ...(features.length ? [NOTE_PAID_LIST_HEADING, ...features.map((f) => `- ${f}`), ""] : []),
    NOTE_PRICE_BOX, "", NOTE_HEAD_END,
  ].join("\n");
}

export function noteHeadProblems(head, facts, features) {
  const text = normalizeEol(head).replace(/\n+$/, "");
  const problems = [];
  const add = (kind, detail) => problems.push({ kind, detail });
  const secs = sectionsOf(text);
  if (secs[0].lines.some((l) => l.trim())) add("stray", "題名より前に本文があります");
  const headings = secs.slice(1).map((s) => s.heading);
  const h1 = headings[0] || "";
  const expected = [h1, ...NOTE_FREE_TEMPLATE_H2];
  if (!/^# \S/.test(h1) || headings.join("\n") !== expected.join("\n")) add("shape", `見出しがテンプレートと違います（${headings.filter((h) => !expected.includes(h)).join(" / ") || "順序・欠落"}）`);
  if (secs[1]?.lines.some((l) => l.trim())) add("stray", "題名の下に本文があります");
  for (const s of secs.slice(2).filter((s) => !expected.includes(s.heading))) {
    problems.push(...strayChecks([s.heading, ...s.lines], [s.heading, ...s.lines].flatMap((l, i) => (l.trim() ? [i] : [])), "テンプレート外の節"));
  }
  const intro = secs.find((s) => s.heading === NOTE_H2.intro);
  if (intro) {
    const body = intro.lines.filter((l) => l.trim());
    if (body.length !== 1 || !ledeRe(facts).test(body[0])) add("lede", "はじめにが作成日・スター数の記録だけになっていません");
  }
  // 主な機能: 原文つきの文のあとに、有料版の内容一覧（あれば）・価格の案内・有料ラインが決まった形で続く
  const feat = secs.find((s) => s.heading === NOTE_H2.features);
  const tailWant = [...(features.length ? [NOTE_PAID_LIST_HEADING, ...features.map((f) => `- ${f}`), ""] : []), NOTE_PRICE_BOX, "", NOTE_HEAD_END].join("\n").trim();
  let tailHave = "";
  if (feat) {
    const at = feat.lines.findIndex((l) => l === NOTE_PAID_LIST_HEADING || l.startsWith("> 💡"));
    const lines = at === -1 ? feat.lines : feat.lines.slice(0, at);
    tailHave = at === -1 ? "" : feat.lines.slice(at).join("\n").trim();
    const { statements, stray } = parseStatements(lines);
    problems.push(...strayChecks(lines, stray, "主な機能"));
    if (!statements.length) add("shape", "主な機能に原文つきの文がありません");
    problems.push(...statementChecks(statements, facts, "主な機能"));
  }
  if (tailHave !== tailWant) add("section", "有料版の内容一覧・価格の案内・有料ラインが決まった形と違います");
  return problems;
}
