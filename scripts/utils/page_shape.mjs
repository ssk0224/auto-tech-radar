// 公開物の形（leakhunt C3・C4、2026-10-22）。Web 記事・note の無料部分・note の末尾は、すべてデータから決まった形で作る:
//   - data/readme_facts/<slug>.json: README の事実（文の指紋・開発段階と利用条件の記載・インストールのコードブロック・README の図）、
//     LICENSE の判定、掲載時の記録（publication: 公開日・スター数・7 日間の増加数）、GitHub のトピック（note のタグ）
//   - note_drafts/<slug>_note.paid.json: 有料版の内容一覧（有料部分の節の題から判定したもの）
//   - 生成モデルが README から選んだ原文（README の文そのもの。scripts/utils/anchored.mjs）。訳は載せない
// 検査（webPageProblems / noteHeadProblems / noteTailProblems）は語の一覧ではなく、ページから原文と訂正の記録だけを読み取り、
// 同じデータから作り直したものと 1 文字も違わないことを確かめる。どの節にどんな言い方で文を足しても赤になる
import { normalizeEol } from "./eol.mjs";
import { renderQuotes, parseQuotes, quoteProblems, maturitySection, MATURITY_HEADING, QUOTE_LINE, sentenceKey } from "./anchored.mjs";
import { installSection, ledeText, INSTALL_HEADING } from "./readme_facts.mjs";
import { licenseSection, LICENSE_HEADING } from "./license_section.mjs";
import { jstDate } from "./selection.mjs";
import { RECEIPT_LINE } from "./receipt.mjs";
import { STANDARD_FOOTER, PAID_FEATURE_RULES } from "./note_vault.mjs";
import { noteHashtags, HASHTAG_HEADING } from "./note_hashtags.mjs";

export const WEB_H2 = {
  maturity: MATURITY_HEADING,
  architecture: "## 主な機能と構成（README の原文）",
  install: INSTALL_HEADING,
  license: LICENSE_HEADING,
};
export const WEB_TEMPLATE_H2 = Object.values(WEB_H2);
export const NOTE_H2 = { intro: "## はじめに", features: "## README の要点（原文）" };
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
export const QUOTE_INTRO = "以下の箇条書きは、README の文を訳さずに原文のまま抜き出したものです（当サイトによる要約・評価ではありません）。";

// 訂正の記録に書いてよい文。新しい訂正はここに文を足して使う（ページに自由な文を書かない。訂正の記録も公開される本文のため）。
// これ以前の個別の訂正の記録は、記事ごとに data/readme_facts/<slug>.json の corrections_keys（文の指紋）に記録してある
export const CORRECTION_NOTES = {
  grounded: "README で確かめられない比較表・費用や削減率などの数値・ライセンスの結論・活用アイデアの節を削除し、インストール手順を README からの転記に、ライセンスの節を LICENSE ファイルの判定と確認先だけに改めました",
  anchored: "本文を、README の文（原文）とその訳を並べる形に改めました。原文で確かめられない記述（他製品との比較、評価や評判の語、費用や利用条件の記述、生成モデルが描いた構成図）を削除しました",
  quotesOnly: "本文の日本語の訳を削除し、README の文を原文のまま示す形に改めました。題名・説明文・タグ・リードは、リポジトリの記録から決まった形で作ります",
};

const repoName = (facts) => String(facts?.repo || "").split("/")[1] || "";
export const webTitle = (name) => `${name} - README の要点（原文）`;
export const webDescription = (repo) => `${repo} の README から、目的と主な機能を表す文を原文のまま抜き出し、インストール手順とライセンスの確認先をまとめたページです。`;
// note の題名は名前と有料版の内容一覧（*.paid.json）だけから作る（「商用化」「自社SaaS構築」など内容一覧に無い約束を書かない）
export const noteTitle = (name, features) => `# 「${name}」README の要点（原文）${features.length ? `｜有料版: ${features.join("、")}` : ""}`;

// 構成図は生成モデルに描かせない。README に Mermaid の図があれば、それだけをそのまま転記する（data/readme_facts の diagrams）
export const DIAGRAM_NOTE = "以下は README にある図を、そのまま転記したものです。";
const diagramLines = (facts) => (facts?.diagrams?.length ? [DIAGRAM_NOTE, "", ...facts.diagrams.flatMap((d) => ["```mermaid", d, "```", ""])] : []);

const ledeOf = (facts) => {
  const p = facts.publication;
  return ledeText({ full_name: facts.repo, created_at: facts.created_at, date: p.date, stars: p.stars, gain7d: p.gain7d ?? null });
};
const yamlStr = (s) => JSON.stringify(String(s));

// ---- Web 記事 ----
// updatedDate・generatorModel・corrections だけがページごとの値（検査で形と、訂正の文が決まった文であることを確かめる）
export function renderWebPage({ facts, overview, architecture = [], updatedDate = null, corrections = [], generatorModel = null }) {
  const name = repoName(facts);
  const p = facts.publication;
  const fm = [
    'layout: "../../layouts/Layout.astro"',
    `title: ${yamlStr(webTitle(name))}`,
    `description: ${yamlStr(webDescription(facts.repo))}`,
    `pubDate: ${yamlStr(p.date)}`,
    ...(updatedDate ? [`updatedDate: ${yamlStr(updatedDate)}`] : []),
    `tags: ${JSON.stringify([...new Set([facts.language, "OSS", "GitHub"].filter(Boolean))])}`,
    `repoUrl: ${yamlStr(`https://github.com/${facts.repo}`)}`,
    ...(facts.created_at ? [`repoCreatedAt: ${yamlStr(jstDate(facts.created_at))}`] : []),
    `stars: ${Number(p.stars)}`,
    ...(generatorModel ? [`generator_model: ${yamlStr(generatorModel)}`] : []),
    ...(corrections.length ? ["corrections:", ...corrections.flatMap((c) => [`  - date: ${yamlStr(c.date)}`, `    note: ${yamlStr(c.note)}`])] : []),
  ];
  const body = [
    `# ${name}: 概要`, "", ledeOf(facts), "", QUOTE_INTRO, "", renderQuotes(overview), "",
    maturitySection(facts).trimEnd(), "",
    WEB_H2.architecture, "", ...(architecture.length ? [renderQuotes(architecture), ""] : []), ...diagramLines(facts),
    installSection(facts, `https://github.com/${facts.repo}`).trimEnd(), "",
    licenseSection(facts.license, facts.usage_lines || []).trimEnd(), "",
  ];
  return `---\n${fm.join("\n")}\n---\n\n${body.join("\n")}`;
}

const FM_RE = /^---\n([\s\S]*?)\n---\n?/;
const parseScalar = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return raw.replace(/^["']|["']$/g, "");
  }
};
const fmValue = (fm, key) => {
  const raw = (fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m")) || [])[1];
  return raw === undefined ? undefined : parseScalar(raw);
};
function correctionsOf(fm) {
  const out = [];
  const lines = fm.split("\n");
  const at = lines.findIndex((l) => /^corrections:\s*$/.test(l));
  if (at === -1) return out;
  for (let i = at + 1; i < lines.length && /^\s/.test(lines[i]); i++) {
    const d = lines[i].match(/^\s+-\s+date:\s*(.*)$/);
    const n = (lines[i + 1] || "").match(/^\s+note:\s*(.*)$/);
    if (d && n) {
      out.push({ date: parseScalar(d[1]), note: parseScalar(n[1]) });
      i++;
    }
  }
  return out;
}
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODEL_RE = /^[A-Za-z0-9._-]{1,64}$/;

// ページからページごとの値（原文・訂正の記録・更新日・モデル名）を読み取る。作り直しと検査に使う
export function parseWebPage(md) {
  const text = normalizeEol(md);
  const m = text.match(FM_RE);
  const fm = m ? m[1] : "";
  const body = text.slice(m ? m[0].length : 0).split("\n");
  const archAt = body.indexOf(WEB_H2.architecture);
  const firstH2 = body.findIndex((l) => /^## /.test(l));
  const archEnd = body.findIndex((l, i) => i > archAt && /^## /.test(l));
  const quotesIn = (lines) => lines.filter((l) => l.startsWith(QUOTE_LINE)).map((l) => l.slice(QUOTE_LINE.length).trim());
  return {
    overview: quotesIn(body.slice(0, firstH2 === -1 ? body.length : firstH2)),
    architecture: archAt === -1 ? [] : quotesIn(body.slice(archAt + 1, archEnd === -1 ? body.length : archEnd)),
    updatedDate: fmValue(fm, "updatedDate") ?? null,
    generatorModel: fmValue(fm, "generator_model") ?? null,
    corrections: correctionsOf(fm),
    pubDate: fmValue(fm, "pubDate"),
    stars: fmValue(fm, "stars"),
  };
}

const firstDiff = (a, b) => {
  const x = a.split("\n");
  const y = b.split("\n");
  const i = x.findIndex((l, k) => l !== y[k]);
  return i === -1 ? Math.min(x.length, y.length) + 1 : i + 1;
};
const correctionAllowed = (note, facts) => Object.values(CORRECTION_NOTES).includes(note) || (facts?.corrections_keys || []).includes(sentenceKey(note));

export function webPageProblems(md, facts) {
  const text = normalizeEol(md).replace(/\n+$/, "\n");
  const problems = [];
  const add = (kind, detail) => problems.push({ kind, detail });
  if (!FM_RE.test(text)) return [{ kind: "shape", detail: "frontmatter がありません" }];
  const p = facts?.publication;
  if (!p || !DATE_RE.test(String(p.date)) || !Number.isFinite(Number(p.stars))) return [{ kind: "publication", detail: "掲載時の記録（publication）がありません" }];
  const page = parseWebPage(text);
  if (page.pubDate !== p.date || Number(page.stars) !== Number(p.stars)) add("publication", "公開日・スター数が掲載時の記録と違います");
  if (!page.overview.length) add("shape", "概要に README の原文がありません");
  for (const q of [...page.overview, ...page.architecture]) for (const pr of quoteProblems(q, facts)) add(pr.kind, pr.detail);
  for (const c of page.corrections) if (!DATE_RE.test(String(c.date)) || !correctionAllowed(c.note, facts)) add("corrections", `訂正の記録（${c.date}）が決まった文ではありません`);
  if (page.updatedDate !== null && !DATE_RE.test(String(page.updatedDate))) add("frontmatter", "updatedDate が日付ではありません");
  if (page.generatorModel !== null && !MODEL_RE.test(String(page.generatorModel))) add("frontmatter", "generator_model がモデル名の形ではありません");
  if (page.overview.length) {
    const want = renderWebPage({ facts, ...page }).replace(/\n+$/, "\n");
    if (want !== text) add("render", `データから作り直したページと違います（${firstDiff(text, want)} 行目）`);
  }
  return problems;
}

// ---- note の無料部分（有料ラインの行まで） ----
export function renderNoteHead({ facts, quotes, features }) {
  return [
    noteTitle(repoName(facts), features), "", NOTE_H2.intro, "", ledeOf(facts), "", NOTE_H2.features, "", QUOTE_INTRO, "", renderQuotes(quotes), "",
    ...(features.length ? [NOTE_PAID_LIST_HEADING, ...features.map((f) => `- ${f}`), ""] : []),
    NOTE_PRICE_BOX, "", NOTE_HEAD_END,
  ].join("\n");
}

// 利用を学習用途・非商用に限る README の記事では、活用・収益化を有料版の売りにしない（leakhunt #57）
const MONETIZE_LABEL = PAID_FEATURE_RULES.find(([re]) => re.test("収益化"))[1];
export function paidFeatureProblems(features, facts) {
  return (facts?.usage_lines || []).length && features.includes(MONETIZE_LABEL) ? [{ kind: "usage", detail: "README が利用を限っているのに、活用・収益化を有料版の売りにしています" }] : [];
}

export function noteHeadProblems(head, facts, features) {
  const text = normalizeEol(head).replace(/\n+$/, "");
  const problems = [];
  const add = (kind, detail) => problems.push({ kind, detail });
  if (!facts?.publication) return [{ kind: "publication", detail: "掲載時の記録（publication）がありません" }];
  const { quotes } = parseQuotes(text.split("\n").filter((l) => l.startsWith(QUOTE_LINE)));
  if (!quotes.length) add("shape", "README の原文がありません");
  for (const q of quotes) for (const pr of quoteProblems(q, facts)) add(pr.kind, pr.detail);
  problems.push(...paidFeatureProblems(features, facts));
  const want = renderNoteHead({ facts, quotes, features });
  if (want !== text) add("render", `データから作り直した無料部分と違います（${firstDiff(text, want)} 行目）`);
  return problems;
}

// ---- note の末尾（有料部分の後ろの、公開されたまま暗号化しない部分） ----
// メンバーシップの案内（定型文）と、GitHub の言語・トピックから作ったタグだけ。生成モデルの出力は 1 行も入れない
export function noteFooter(facts) {
  const tags = noteHashtags({ language: facts?.language, topics: facts?.topics || [] }).join(" ");
  const lines = STANDARD_FOOTER.trim().split("\n");
  const h = lines.findIndex((l) => l.startsWith("**【note出品時用 推奨ハッシュタグ】**"));
  return [...lines.slice(0, h), HASHTAG_HEADING, tags].join("\n");
}
// note 原稿全体: データから作った無料部分 + 生成モデルが書いた有料部分（末尾の案内・タグに見える行も含めて全部） + データから作った末尾。
// 生成モデルの出力はどんな形でも有料ラインと末尾の間（暗号化される側）に入る（leakhunt #81、2026-10-22）
export function renderNoteDraft({ facts, quotes, features, paid }) {
  return [renderNoteHead({ facts, quotes, features }), NOTE_PAYWALL.split("\n")[2], paid.trim(), "", noteFooter(facts), ""].join("\n");
}
export function noteTailProblems(tail, facts) {
  const text = normalizeEol(Array.isArray(tail) ? tail.join("\n") : tail).trim();
  const want = noteFooter(facts);
  return text === want ? [] : [{ kind: "render", detail: `末尾がデータから作った形と違います（${firstDiff(text, want)} 行目）` }];
}
