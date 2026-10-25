// 上流 README で確かめられる事実の集合（leakhunt C3、2026-10-22）。
// README から「数値と単位」「URL のホスト」「コマンドの語」と導入手順のコードブロックを取り出し、data/readme_facts/<slug>.json に置く。
// 公開物（Web 記事・note の無料部分）は、この集合に無いトークンを含んではいけない（生成スクリプトが保存前に、テストが公開中の全ページに確かめる）。
// README の本文そのものはリポジトリに置かない（取り出した事実と、ページにそのまま転記する導入手順のコードブロックだけを置く）
import path from "path";
import { fileURLToPath } from "url";
import { normalizeEol } from "./eol.mjs";
import { jstDate } from "./selection.mjs";
import { readmeSentenceKeys, statusLines, readmeWords, usageLines } from "./anchored.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FACTS_DIR = path.join(rootDir, "data", "readme_facts");
export const factsFileFor = (slug) => path.join(FACTS_DIR, `${slug}.json`);

// 記事が README に無くても出してよいホスト（当サイトと、リポジトリ・LICENSE へのリンク先）
export const SITE_HOSTS = ["ssk0224.github.io", "github.com"];

const URL_RE = /https?:\/\/[^\s)\]>"'`<]+/g;
const toHalf = (s) => s.replace(/[０-９．，＄％]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
const uniqSorted = (xs) => [...new Set(xs)].sort();

// ---- 数値と単位 ----
const NUM = "[0-9０-９][0-9０-９,，]*(?:[.．][0-9０-９]+)?";
const UNIT =
  "%|％|パーセント|percent\\b|倍|[x×](?![0-9A-Za-z])|ミリ秒|毫秒|ms\\b|秒|sec(?:onds?)?\\b|s\\b|分钟|分鐘|分(?![のけ割])|min(?:utes?)?\\b|時間|小时|小時|hours?\\b|週間|[ヶか]月|GiB|MiB|KiB|TiB|GB|MB|KB|TB|円|ドル|USD\\b|tokens?\\b|トークン|fps\\b|[KMBT]\\b";
const QUANTITY_RE = new RegExp(
  `(?<![A-Za-z0-9_.\\-/])([$＄]\\s?)?(${NUM})(?:\\s*[〜~～\\-–]\\s*[$＄]?\\s?(${NUM}))?\\s*(万|億|千)?\\s*(${UNIT})?`,
  "g",
);
const MAGNITUDE = { 万: 1e4, 億: 1e8, 千: 1e3 };
function canonicalUnit(u) {
  if (/^(?:%|％|パーセント|percent)$/.test(u)) return "%";
  if (/^(?:倍|x|×)$/.test(u)) return "x";
  if (/^(?:ミリ秒|毫秒|ms)$/.test(u)) return "ms";
  if (/^(?:秒|sec|secs|second|seconds|s)$/.test(u)) return "s";
  if (/^(?:分|分钟|分鐘|min|minute|minutes)$/.test(u)) return "min";
  if (/^(?:時間|小时|小時|hour|hours)$/.test(u)) return "h";
  if (u === "週間") return "week";
  if (/^[ヶか]月$/.test(u)) return "month";
  if (/^(?:ドル|USD|\$)$/.test(u)) return "$";
  if (/^(?:tokens?|トークン)$/.test(u)) return "tokens";
  return u;
}
const numValue = (s, mag) => {
  const n = Number(toHalf(s).replace(/,/g, "")) * (mag ? MAGNITUDE[mag] : 1);
  return String(Math.round(n * 1e6) / 1e6);
};

export function extractQuantities(text) {
  const t = normalizeEol(text).replace(URL_RE, " ");
  const out = [];
  for (const m of t.matchAll(QUANTITY_RE)) {
    const [, dollar, a, b, mag, unit] = m;
    const u = dollar ? "$" : unit ? canonicalUnit(unit) : null;
    if (!u) continue;
    out.push(`${numValue(a, mag)} ${u}`);
    if (b) out.push(`${numValue(b, mag)} ${u}`);
  }
  return uniqSorted(out);
}

// ---- URL のホスト ----
export function extractHosts(text) {
  return uniqSorted(
    [...normalizeEol(text).matchAll(URL_RE)].map((m) =>
      m[0].replace(/^https?:\/\//, "").split(/[/?#]/)[0].replace(/^[^@]*@/, "").replace(/:\d+$/, "").replace(/^www\./i, "").replace(/\.$/, "").toLowerCase(),
    ).filter(Boolean),
  );
}

// ---- コードブロックとコマンドの語 ----

// フェンスで囲まれたコードブロック（言語・本文・直前までの見出しの並び）
export function codeBlocks(markdown) {
  const lines = normalizeEol(markdown).split("\n");
  const blocks = [];
  const headings = [];
  let open = null;
  for (const line of lines) {
    if (open) {
      if (new RegExp(`^\\s*${open.fence[0]}{${open.fence.length},}\\s*$`).test(line)) {
        blocks.push({ lang: open.lang, code: open.body.join("\n"), headings: open.headings });
        open = null;
      } else open.body.push(line);
      continue;
    }
    const f = line.match(/^\s*(`{3,}|~{3,})\s*([^\s`]*)/);
    if (f) {
      open = { fence: f[1], lang: f[2].toLowerCase(), body: [], headings: headings.map((h) => h.text) };
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      while (headings.length && headings.at(-1).level >= h[1].length) headings.pop();
      headings.push({ level: h[1].length, text: h[2].trim() });
    }
  }
  return blocks;
}

const WORD_RE = /^(?:--?[A-Za-z][\w-]*|[A-Za-z][\w.+-]*)$/;
function commandWordsOfLine(raw) {
  let l = raw.trim().replace(/^(?:\$|>|PS(?: [^>]*)?>)\s*/, "");
  if (!l || /^(?:#|\/\/|REM\b|::)/i.test(l)) return [];
  l = l.replace(/\s#.*$/, "").replace(URL_RE, " ").replace(/"[^"]*"|'[^']*'/g, " ");
  // コミットのハッシュなど 16 進の並びはコマンドの語にしない（公開ツリーに 40 桁の hex を置かない）
  return l.split(/[\s|&;()<>`=,{}[\]]+/).filter((w) => WORD_RE.test(w) && !/^[0-9a-f]{7,}$/i.test(w));
}
const inlineCode = (md) => [...normalizeEol(md).replace(/```[\s\S]*?```/g, "").matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);

// コードブロック（Mermaid の図を除く。言語の指定は問わない: text と書いてもコマンドや設定は検査する）の語。
// inline: README の側はインラインコードの語も許可の集合に入れる（公開物の側はコードブロックだけを見る）
export function extractCommandWords(markdown, { inline = false } = {}) {
  const blocks = codeBlocks(markdown).filter((b) => b.lang !== "mermaid");
  const lines = blocks.flatMap((b) => b.code.split("\n"));
  if (inline) lines.push(...inlineCode(markdown));
  return uniqSorted(lines.flatMap(commandWordsOfLine));
}

// ---- 略語の展開 ----
// 「MCP（Model Context Protocol）」「Model Context Protocol（MCP）」のように、頭文字が略語と一致する括弧書きを「略語=展開」として取り出す。
// 生成モデルは README に無い展開を作ることがある（MCP を Multi-tool Coordination Protocol と書いた、leakhunt #19）
const PHRASE = "[A-Z][A-Za-z-]*(?:\\s+[A-Za-z][A-Za-z-]*){1,5}";
const ACR = "[A-Z]{2,6}s?";
function initialsOf(phrase) {
  const words = phrase.trim().split(/\s+/);
  const byWord = words.map((w) => w[0]).join("");
  const byCaps = words.map((w) => (w.match(/[A-Z]/g) || [w[0]]).join("")).join("");
  const byPart = words.flatMap((w) => w.split("-").filter(Boolean)).map((w) => w[0]).join("");
  return new Set([byWord, byCaps, byPart].map((x) => x.toUpperCase()));
}
const expansionKey = (acr, phrase) => `${acr.replace(/s$/, "")}=${phrase.trim().toLowerCase().replace(/\s+/g, " ")}`;
export function extractExpansions(text) {
  const t = normalizeEol(text);
  const out = [];
  const push = (acr, phrase) => {
    if (initialsOf(phrase).has(acr.replace(/s$/, ""))) out.push(expansionKey(acr, phrase));
  };
  for (const m of t.matchAll(new RegExp(`\\b(${ACR})\\s*[（(]\\s*(${PHRASE})\\s*[）)]`, "g"))) push(m[1], m[2]);
  for (const m of t.matchAll(new RegExp(`(${PHRASE})\\s*[（(]\\s*(${ACR})\\s*[）)]`, "g"))) push(m[2], m[1]);
  return uniqSorted(out);
}
// README の側: 大文字で始まる語が続く句（"Model Context Protocol" など）を、その頭文字の略語との組として許可の集合に入れる
function readmePhrases(text) {
  const out = [];
  for (const m of normalizeEol(text).matchAll(/\b[A-Z][A-Za-z-]*(?:[ \t]+[A-Z][A-Za-z-]*){1,5}\b/g)) {
    const words = m[0].split(/[ \t]+/);
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 2; j <= words.length; j++) {
        const p = words.slice(i, j).join(" ");
        for (const a of initialsOf(p)) out.push(expansionKey(a, p));
      }
    }
  }
  return out;
}

// ---- README の事実の集合 ----
// 導入手順の節（この見出しの下にあるコードブロックだけを「インストール」の節に転記する）
const INSTALL_HEADING_RE = /install|set[ -]?up|getting started|get started|quick ?start|導入|インストール|セットアップ|クイックスタート|環境構築|安装|快速|部署|deploy/i;
// 導入手順の題材（Web 記事のインストールの節に README から転記するもの）を指す語の類。サイト・スクリプトの案内文で、
// これを有料版の売りとして書かない（tests/paid_boundary.test.mjs）。「導入」は「導入提案書」と区別するため手順・方法の語と組にする
export const INSTALL_TOPIC_RE = /install|set[ -]?up|getting started|get started|quick ?start|インストール|セットアップ|クイックスタート|環境構築|安装|部署|導入(?:手順|方法|の手順|の仕方|ガイド)/i;
const MAX_INSTALL_BLOCKS = 4;
const MAX_INSTALL_LINES = 30;
const MAX_DIAGRAMS = 2;
const MAX_DIAGRAM_LINES = 60;

// meta.description: GitHub のリポジトリの説明文（上流の作者が書いたもの）。数値・ホストは README と同じく事実の集合に入れる
export function readmeFacts(readme, meta = {}) {
  const md = normalizeEol(readme);
  const upstream = `${md}\n${meta.description || ""}`;
  const install = codeBlocks(md)
    .filter((b) => b.lang !== "mermaid" && b.code.trim() && b.code.split("\n").length <= MAX_INSTALL_LINES && b.headings.some((h) => INSTALL_HEADING_RE.test(h)))
    .slice(0, MAX_INSTALL_BLOCKS)
    .map(({ lang, code }) => ({ lang, code }));
  return {
    repo: meta.repo ?? null,
    created_at: meta.created_at ?? null,
    language: meta.language ?? null,
    license: meta.license ?? null,
    // 原文つきの文の照合に使う README の文の指紋（scripts/utils/anchored.mjs）・開発段階の記載・英字の語
    sentences: readmeSentenceKeys(md, meta.description || ""),
    status_lines: statusLines(md, String(meta.repo || "").split("/")[1] || ""),
    // 利用条件の記載（学習用途のみ・非商用など）。ライセンスの節に原文のまま示す
    usage_lines: usageLines(md, meta.description || ""),
    words: readmeWords(md, meta.description || ""),
    // README にある Mermaid の図（記事にはこれだけをそのまま転記する。生成モデルには図を描かせない）
    diagrams: codeBlocks(md).filter((b) => b.lang === "mermaid" && b.code.trim() && b.code.split("\n").length <= MAX_DIAGRAM_LINES).slice(0, MAX_DIAGRAMS).map((b) => b.code),
    quantities: extractQuantities(upstream),
    hosts: extractHosts(upstream),
    commands: extractCommandWords(md, { inline: true }),
    expansions: uniqSorted([...extractExpansions(upstream), ...readmePhrases(upstream)]),
    install_blocks: install,
  };
}

// 公開物に、README の事実の集合（と extra: 定型文の値）に無いトークンがあれば返す
export function ungroundedTokens(text, facts, extra = null) {
  const allow = (k) => new Set([...(facts?.[k] || []), ...(extra?.[k] || [])]);
  const q = allow("quantities");
  const h = new Set([...allow("hosts"), ...SITE_HOSTS]);
  const c = allow("commands");
  const e = allow("expansions");
  return [
    ...extractQuantities(text).filter((t) => !q.has(t)).map((token) => ({ kind: "quantity", token })),
    ...extractHosts(text).filter((t) => !h.has(t)).map((token) => ({ kind: "host", token })),
    ...extractCommandWords(text).filter((t) => !c.has(t)).map((token) => ({ kind: "command", token })),
    ...extractExpansions(text).filter((t) => !e.has(t)).map((token) => ({ kind: "expansion", token })),
  ];
}

// ---- 生成スクリプトが決まった形で書く節 ----
export const INSTALL_HEADING = "## インストール（README からの転記）";
// インターネットから取得したスクリプトをそのまま実行する形（curl ... | sh、irm ... | iex、Invoke-Expression、
// curl/wget でファイルに保存して続けて sh で実行する形）
export const PIPE_EXEC_RE = /\|\s*(?:sudo\s+)?(?:ba|z|da|k)?sh\b|\|\s*(?:iex|Invoke-Expression)\b|\biex\s*[($]|Invoke-Expression|\b(?:curl|wget)\b[^\n]*(?:&&|;)\s*(?:\w+=\S+\s+)*(?:sudo\s+)?(?:ba|z|da|k)?sh\s+\S/i;
const PIPE_EXEC_WARNING = "> ⚠️ 注意: インターネットから取得したスクリプトをそのまま実行する手順です。実行前にスクリプトの中身を確認し、可能であればバージョン（タグやコミット）を固定してください。";

export function installSection(facts, repoUrl) {
  const readmeLink = `[README](${repoUrl}#readme)`;
  const blocks = facts?.install_blocks || [];
  if (!blocks.length) {
    return `${INSTALL_HEADING}\n\nREADME にインストール手順のコードブロックが見つかりませんでした。導入方法は ${readmeLink} を確認してください。\n`;
  }
  const out = [INSTALL_HEADING, "", `以下は ${readmeLink} のインストール手順のコードブロックを、そのまま転記したものです。当サイトでは動作を確認していません。最新の手順は README を確認してください。`, ""];
  for (const b of blocks) {
    out.push("```" + b.lang, b.code, "```", "");
    if (PIPE_EXEC_RE.test(b.code)) out.push(PIPE_EXEC_WARNING, "");
  }
  return out.join("\n");
}

// リード: リポジトリの作成日（GitHub API の created_at）とスター数の記録（生成時の値・Radar Ledger の 7 日間の増加数）だけから作る
export function ledeText({ full_name, created_at, date, stars, gain7d = null }) {
  const created = created_at ? jstDate(created_at) : null;
  const s = [];
  s.push(created ? `${full_name} は ${created} に GitHub で作成されたリポジトリです。` : `${full_name} は GitHub で公開されているリポジトリです。`);
  if (Number.isFinite(Number(stars)) && date) s.push(`${date} 時点のスター数は ${Number(stars).toLocaleString("en-US")} です。`);
  if (gain7d !== null && gain7d !== undefined && Number.isFinite(Number(gain7d))) s.push(`Radar Ledger の記録では、直近 7 日間の増加数は ${Number(gain7d).toLocaleString("en-US")} です。`);
  return s.join("");
}

// README の図のうち、サイトと同じ版の Mermaid で描画でき、品質ゲートの検査を満たすものだけを残す（転記なので書き換えて直すことはしない）
export async function renderableDiagrams(diagrams) {
  const { mermaidProblems } = await import("./mermaid.mjs");
  const { mermaidParseErrors } = await import("./mermaid_parse.mjs");
  const ok = [];
  for (const d of diagrams || []) {
    const md = "```mermaid\n" + d + "\n```\n";
    if (!mermaidProblems(md).length && !(await mermaidParseErrors(md)).length) ok.push(d);
  }
  return ok;
}
