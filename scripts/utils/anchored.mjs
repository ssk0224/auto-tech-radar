// README の原文（leakhunt C3、2026-10-22）。公開物（Web 記事・note の無料部分）に生成モデルが選んで載せてよいのは、README の文そのもの
// （原文）だけ。訳は載せない（訳は README と機械的に照合できず、語の一覧で評価・比較・採用実績を止めても一覧に無い言い方が通るため）。
// 確かめること（生成スクリプトが保存前に、tests/readme_grounding.test.mjs が掲載中の全ページに）:
//   原文の各文が README の文（data/readme_facts/<slug>.json の sentences にある指紋）であること。ページのそれ以外の部分は
//   scripts/utils/page_shape.mjs がデータから作り直したものと一致すること
// README の本文はリポジトリに置かない（文の指紋と、成熟度・利用条件の節に示す記載だけを置く）
import crypto from "crypto";
import { normalizeEol } from "./eol.mjs";

export const QUOTE_LABEL = "原文（README）: ";
const MIN_SENTENCE = 8;

// ---- README の文 ----
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
function cleanOnce(s) {
  return String(s)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gi, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/<(https?:\/\/[^>\s]+)>/g, "$1")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (e) => ENTITIES[e])
    .replace(/`+/g, "")
    .replace(/\\([\\*_{}[\]()#+\-.!|<>~])/g, "$1") // Markdown のエスケープ（tiny\_http）は文字そのものにする
    .replace(/\*\*|__|~~/g, "")
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,!?:;]|$)/g, "$1$2")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
// 何度かけても同じになるまで整える（README の側と、ページに示した原文の側で同じ値にする）
export function cleanText(s) {
  let prev = String(s);
  for (let i = 0; i < 4; i++) {
    const next = cleanOnce(prev);
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}
const splitSentences = (p) =>
  cleanText(p).split(/(?<=[.!?])\s+(?=[^a-z\s])|(?<=[。！？])\s*/).map((x) => cleanText(x)).filter((x) => x.length >= MIN_SENTENCE);

// README（と GitHub の説明文）の平文の文。コードブロックは除き、見出し・箇条書き・表の行はそれぞれ 1 つの段落にする
export function readmeSentences(markdown, description = "") {
  const paragraphs = [];
  let cur = [];
  const flush = () => {
    if (cur.length) paragraphs.push(cur.join(" "));
    cur = [];
  };
  let fence = null;
  for (const raw of normalizeEol(markdown).split("\n")) {
    const f = raw.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length) fence = null;
      continue;
    }
    if (f) {
      flush();
      fence = f[1];
      continue;
    }
    const line = raw.replace(/^\s*(?:>\s?)+/, "");
    if (!line.trim()) flush();
    else if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line)) flush();
    else if (/^\s*\|/.test(line)) {
      flush();
      paragraphs.push(line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()).filter(Boolean).join(" / "));
    } else if (/^\s*#{1,6}\s/.test(line)) {
      flush();
      paragraphs.push(line.replace(/^\s*#{1,6}\s+/, "").replace(/\s#+\s*$/, ""));
    } else if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      cur.push(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, ""));
    } else cur.push(line);
  }
  flush();
  if (description) paragraphs.push(description);
  return [...new Set(paragraphs.flatMap(splitSentences))];
}

// 文の指紋（base64url。16 進の並びにしない）
export const sentenceKey = (s) => crypto.createHash("sha256").update(cleanText(s)).digest("base64url").slice(0, 12);
export const readmeSentenceKeys = (markdown, description = "") => [...new Set(readmeSentences(markdown, description).map(sentenceKey))].sort();

// ---- 開発段階の記載（成熟度の節） ----
// 主語がこのプロジェクト（名前・it・this project など）で、開発段階を述べている文だけを取る（「preview 画面」「experimental なオプション」は取らない）
const STATUS = "pre-?alpha|alpha|beta|experimental|early[- ](?:stage|development|access|alpha|beta)|work[- ]in[- ]progress|WIP|unstable|not (?:yet )?(?:ready|production[- ]ready|stable)|production[- ]ready|deprecated|archived|unmaintained|no longer maintained|proof[- ]of[- ]concept|prototype|under (?:active |heavy )?development|in (?:active |early )?development";
const ZH_STATUS_RE = /(?:本?项目|目前|当前|仍)[^。，,]{0,20}(?:测试版|内测|实验性|开发中|预览版|早期)/;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function statusRes(name) {
  const subject = `(?:${name ? `${escRe(name)}|` : ""}it|this(?: project| repo(?:sitory)?| tool| library| app| template)?|the (?:project|template|app|tool|library|software|repo(?:sitory)?|code ?base))`;
  return [
    new RegExp(`\\b${subject}\\s+(?:is|are|remains?|currently|still)\\b[^.!?]{0,40}?\\b(?:${STATUS})\\b`, "i"),
    new RegExp(`^(?:status|stage|where (?:we are|it stands)[^:]*)\\s*:?[^.!?]{0,30}?\\b(?:${STATUS})\\b`, "i"),
    ZH_STATUS_RE,
  ];
}
const MAX_STATUS_LINES = 3;
const MAX_STATUS_CHARS = 300;
// name: リポジトリ名（「GridCraft is in alpha」の主語）
export function statusLines(markdown, name = "") {
  const res = statusRes(name);
  return readmeSentences(markdown).filter((s) => s.length <= MAX_STATUS_CHARS && res.some((re) => re.test(s))).slice(0, MAX_STATUS_LINES);
}

export const MATURITY_HEADING = "## 🎯 成熟度の目安（README の記載）";
export function maturitySection(facts) {
  const lines = facts?.status_lines || [];
  const body = lines.length
    ? ["README にある開発段階の記載を、原文のまま示します（当サイトによる評価ではありません）。", "", ...lines.map((l) => `- ${QUOTE_LABEL}${l}`)]
    : ["README に開発段階（alpha・beta・experimental など）の記載は見つかりませんでした。作成日とスター数は冒頭の記載のとおりです。"];
  return [MATURITY_HEADING, "", ...body, ""].join("\n");
}

// ---- README の利用条件の記載（学習用途のみ・非商用など） ----
// ライセンスの節に原文のまま示し、活用・収益化を有料版の売りにしない判定に使う（leakhunt #57、2026-10-22）
const USAGE_RE = [
  /\bnon-?commercial\b|\bnot (?:be )?(?:used )?for commercial\b|\bno commercial use\b|\bcommercial use (?:is )?(?:not permitted|prohibited|forbidden)\b/i,
  /\bfor (?:educational|study|learning|research|personal)(?: (?:and|or) (?:educational|study|learning|research|personal))* (?:purposes? |use )?only\b/i,
  /仅供学习|仅供研究|仅供个人|请勿用于商业|禁止(?:用于)?商用|不得用于商业|非商用|商用禁止|商用利用(?:は|を)?禁止|学習目的(?:のみ|に限)/,
];
export function usageLines(markdown, description = "") {
  return readmeSentences(markdown, description).filter((s) => s.length <= MAX_STATUS_CHARS && USAGE_RE.some((re) => re.test(s))).slice(0, MAX_STATUS_LINES);
}

// ---- 原文（README の文そのもの）の Markdown ----
// 生成モデルが公開物に載せてよいのは、README の文を選んだものだけ。訳は README と機械的に照合できないので載せない（leakhunt C3、2026-10-22）
export const QUOTE_LINE = `- ${QUOTE_LABEL}`;
export const renderQuotes = (quotes) => quotes.map((q) => `${QUOTE_LINE}${q}`).join("\n");

// 行の並びから原文を読み取る。空行以外で原文の行でないもの（訳・段落・表・見出し）は stray（行番号）として返す
export function parseQuotes(lines, offset = 0) {
  const quotes = [];
  const stray = [];
  lines.forEach((l, i) => {
    if (!l.trim()) return;
    if (l.startsWith(QUOTE_LINE) && l.slice(QUOTE_LINE.length).trim()) quotes.push(l.slice(QUOTE_LINE.length).trim());
    else stray.push(offset + i);
  });
  return { quotes, stray };
}

// 原文の各文が README の文（data/readme_facts/<slug>.json の sentences にある指紋）であること
export function quoteProblems(quote, facts) {
  const keys = new Set(facts?.sentences || []);
  const parts = quote ? splitSentences(quote) : [];
  if (!parts.length || parts.some((p) => !keys.has(sentenceKey(p)))) return [{ kind: "quote", detail: "原文が README の文ではありません" }];
  return [];
}

const LATIN_RE = /[A-Za-z][A-Za-z0-9]*(?:[._+#'’/-][A-Za-z0-9]+)*/g;
// README の英字の語（コードブロックも含む。小文字・区切りで分けた部分も含む）。図のラベルとタグの照合に使う
export function readmeWords(markdown, description = "") {
  const words = new Set();
  for (const m of cleanText(`${normalizeEol(markdown).replace(/^\s*(`{3,}|~{3,}).*$/gm, " ")}\n${description}`).matchAll(LATIN_RE)) {
    const w = m[0].toLowerCase().replace(/[’]/g, "'");
    if (/^[0-9a-f]{7,}$/.test(w)) continue; // コミットのハッシュなど 16 進の並びは置かない
    if (!w.includes("/")) words.add(w.replace(/'s$/, "")); // パスの形（a/b）は部分だけを置く
    for (const part of w.split(/[._+#'/-]+/)) if (part && !/^[0-9a-f]{7,}$/.test(part)) words.add(part);
  }
  return [...words].sort();
}
