// 原文つきの文（leakhunt C3、2026-10-22）。公開物（Web 記事・note の無料部分）に生成モデルが書いてよいのは、
// README の文 1 つ以上（原文）と、その日本語訳の組だけ。ページには訳の下に原文をそのまま表示する。
//   - 訳
//     - 原文（README）: README の文
// 確かめること（生成スクリプトが保存前に、tests/readme_grounding.test.mjs が掲載中の全ページに）:
//   quote  原文の各文が README の文（data/readme_facts/<slug>.json の sentences にある指紋）であること
//   token  訳の英字の語（固有名・コマンド・ホスト）と数値が、原文にあること（比較の相手・ROI・社数・インラインのコマンドを足せない）
//   topic  訳に評価・比較・利用条件・費用・評判・あいまいな量の語が無いこと（scripts/utils/hype_check.mjs の STATEMENT_TOPIC_RULES）
//   length 訳が原文より大幅に長くないこと（原文に無い説明を足していない）
// README の本文はリポジトリに置かない（文の指紋と、成熟度の節に示す開発段階の記載だけを置く）
import crypto from "crypto";
import { normalizeEol } from "./eol.mjs";
import { findStatementTopics } from "./hype_check.mjs";

export const QUOTE_LABEL = "原文（README）: ";
export const QUOTE_PREFIX = `  - ${QUOTE_LABEL}`;
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

// ---- 原文つきの文の Markdown ----
export function renderStatements(statements) {
  return statements.map(({ ja, quote }) => `- ${ja}\n${QUOTE_PREFIX}${quote}`).join("\n");
}

// 行の並びから原文つきの文を読み取る。空行以外で、原文つきの文の形になっていない行は stray（行番号）として返す
export function parseStatements(lines, offset = 0) {
  const statements = [];
  const stray = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) continue;
    const m = l.match(/^- (?!原文（README）)(\S.*)$/);
    const q = (lines[i + 1] || "").startsWith(QUOTE_PREFIX) ? lines[i + 1].slice(QUOTE_PREFIX.length) : null;
    if (m && q !== null) {
      statements.push({ ja: m[1].trim(), quote: q.trim(), line: offset + i });
      i++;
    } else stray.push(offset + i);
  }
  return { statements, stray };
}

// ---- 訳と原文の照合 ----
const LATIN_RE = /[A-Za-z][A-Za-z0-9]*(?:[._+#'’/-][A-Za-z0-9]+)*/g;
const NUM_RE = /(?<![A-Za-z0-9_.])\d+(?:,\d{3})*(?:\.\d+)?/g;
const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNIT = { 十: 10, 百: 100, 千: 1000 };
const KANJI_BIG = { 万: 1e4, 億: 1e8, 亿: 1e8 };
function kanjiNumber(s) {
  let total = 0;
  let section = 0;
  let digit = null;
  for (const c of s) {
    if (c in KANJI_DIGIT) digit = KANJI_DIGIT[c];
    else if (c in KANJI_UNIT) {
      section += (digit ?? 1) * KANJI_UNIT[c];
      digit = null;
    } else if (c in KANJI_BIG) {
      total += (section + (digit ?? 0) || 1) * KANJI_BIG[c];
      section = 0;
      digit = null;
    }
  }
  return total + section + (digit ?? 0);
}
const KANJI_RUN = "[〇零一二两三四五六七八九十百千万億亿]+";
// 訳の側: 助数詞の付いた漢数字（「三十種類」「五百十三個」）を数として読む。「一部」「一般」などの語は数にしない
const JA_KANJI_RE = new RegExp(`${KANJI_RUN}(?=\\s*(?:つ|個|件|倍|割|社|人|名|種|台|回|年|か月|ヶ月|ヵ月|カ月|日|時間|分|秒|週|段階|層|言語|カ国|か国|%|％|パーセント|行|ファイル|ステップ))`, "g");
const QUOTE_KANJI_RE = new RegExp(KANJI_RUN, "g");
const NUMBER_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, dozen: 12, single: 1, double: 2, twice: 2, triple: 3, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }; // 月の名前は日付の訳（October → 10 月）のため。may は語と区別できないので入れない
const numStr = (n) => String(Math.round(Number(n) * 1e6) / 1e6);

function tokensOf(text, { quote = false } = {}) {
  const t = cleanText(text);
  const words = new Set();
  for (const m of t.matchAll(LATIN_RE)) {
    const w = m[0].toLowerCase().replace(/[’]/g, "'");
    words.add(w);
    if (quote) {
      words.add(w.replace(/'s$/, ""));
      words.add(w.replace(/s$/, "")); // 原文の複数形（TVs）に対する訳の単数形（TV）
      words.add(w.replace(/es$/, ""));
      for (const part of w.split(/[._+#'/-]+/)) if (part) words.add(part);
    }
  }
  const numbers = new Set([...t.matchAll(NUM_RE)].map((m) => numStr(m[0].replace(/,/g, ""))));
  for (const m of t.matchAll(quote ? QUOTE_KANJI_RE : JA_KANJI_RE)) numbers.add(numStr(kanjiNumber(m[0])));
  if (quote) for (const w of words) if (w in NUMBER_WORDS) numbers.add(numStr(NUMBER_WORDS[w]));
  return { words, numbers };
}
const singular = (w) => [w, w.replace(/'s$/, ""), w.replace(/es$/, ""), w.replace(/s$/, "")];

// 訳の長さの上限: 原文の文字ごとの重み（CJK の文字は日本語訳とほぼ同じ長さ、英字は日本語訳で短くなる）の和 + 余裕
const LEN_WEIGHT = { cjk: 1.6, other: 1.0 };
const LEN_SLACK = 15;
const maxLength = (quote) => Math.ceil([...quote].reduce((n, c) => n + (/[぀-ヿ㐀-鿿]/.test(c) ? LEN_WEIGHT.cjk : LEN_WEIGHT.other), 0)) + LEN_SLACK;

// facts: { repo, sentences }。返り値: [{ kind: "quote" | "token" | "topic" | "length", detail }]
export function statementProblems({ ja, quote }, facts) {
  const problems = [];
  const keys = new Set(facts?.sentences || []);
  const parts = quote ? splitSentences(quote) : [];
  if (!parts.length || parts.some((p) => !keys.has(sentenceKey(p)))) problems.push({ kind: "quote", detail: "原文が README の文ではありません" });
  const q = tokensOf(quote || "", { quote: true });
  const nameWords = String(facts?.repo || "").toLowerCase().split(/[/._-]+/).filter(Boolean);
  const own = tokensOf(ja);
  const extraWords = [...own.words].filter((w) => !singular(w).some((v) => q.words.has(v) || nameWords.includes(v)) && !q.words.has(w.replace(/[^a-z0-9]/g, "")));
  const extraNumbers = [...own.numbers].filter((n) => !q.numbers.has(n));
  if (extraWords.length || extraNumbers.length) problems.push({ kind: "token", detail: [...extraWords, ...extraNumbers].join(", ") });
  const topics = findStatementTopics(ja);
  if (topics.length) problems.push({ kind: "topic", detail: topics.join(" / ") });
  if ([...ja].length > maxLength(quote || "")) problems.push({ kind: "length", detail: `${[...ja].length} > ${maxLength(quote || "")}` });
  return problems;
}

// 図（Mermaid）やタグのように原文を伴えない部分は、そのページの原文の語と数値だけを使う
export function quoteVocabulary(statements) {
  const words = new Set();
  const numbers = new Set();
  for (const s of statements) {
    const t = tokensOf(s.quote, { quote: true });
    t.words.forEach((w) => words.add(w));
    t.numbers.forEach((n) => numbers.add(n));
  }
  return { words, numbers };
}
export function extraTokens(text, vocab, allowWords = []) {
  const own = tokensOf(text);
  const allow = new Set(allowWords.map((w) => w.toLowerCase()));
  return [
    ...[...own.words].filter((w) => !allow.has(w) && !singular(w).some((v) => vocab.words.has(v))),
    ...[...own.numbers].filter((n) => !vocab.numbers.has(n)),
  ];
}

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
