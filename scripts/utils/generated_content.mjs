// 生成モデルの出力（Web 記事）を保存できる形に整える処理と、保存直前の最終検査（scripts/crawl_and_generate.mjs から使う）。
// 最終検査は「保存するそのままの本文」に対して、CI の品質ゲート（npm test / npm run build）と同じ検査をかける。
// 途中の段階の本文だけを検査すると、その後の補正（コードブロックを閉じる・frontmatter の追記）で
// ゲートに落ちる記事を保存してしまい、その回の生成が丸ごと取り除かれる（2026-10-21）
import { parseFrontmatter } from "astro/markdown";
import { mermaidProblems } from "./mermaid.mjs";
import { mermaidParseErrors } from "./mermaid_parse.mjs";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const FENCE_LINE_RE = /^\s*```/;

// frontmatter（先頭の --- ～ ---）の key: を value に置き換える。無ければ末尾に足す。
// 置換文字列ではなく関数で差し込む（値やほかの行に "$&" "$$" などがあっても書き換わらない）
export function setFrontmatterField(content, key, value) {
  const m = content.match(FM_RE);
  if (!m) return content;
  const line = `${key}: ${value}`;
  const re = new RegExp(`^${key}:.*$`, "m");
  const fm = re.test(m[1]) ? m[1].replace(re, () => line) : `${m[1]}\n${line}`;
  const start = m[0].startsWith("---\r\n") ? 5 : 4; // 先頭の "---" と改行の後ろが m[1]
  return m[0].slice(0, start) + fm + m[0].slice(start + m[1].length) + content.slice(m[0].length);
}

// frontmatter の文字列の値（"..." / '...' / 引用符なし）を、YAML として正しい二重引用符の文字列に書き直す。
// 生成モデルはタイトル・説明文を "..." の中にそのまま書くため、説明文中の " や \（C:\Users など）で
// YAML の解析に失敗したり（サイトのビルドが止まる）、\L などが別の文字に化けたりする
export function quoteFrontmatterStrings(content, keys = ["title", "description"]) {
  let out = content;
  for (const key of keys) {
    const m = (out.match(FM_RE) || [])[1]?.match(new RegExp(`^${key}:[ \\t]*(.*?)\\r?$`, "m"));
    if (!m) continue;
    const raw = m[1].trim();
    let value = raw;
    if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) value = raw.slice(1, -1).replace(/\\"/g, '"');
    else if (raw.length >= 2 && raw.startsWith("'") && raw.endsWith("'")) value = raw.slice(1, -1).replace(/''/g, "'");
    // JSON の文字列は YAML の二重引用符の文字列としてもそのまま正しい
    out = setFrontmatterField(out, key, JSON.stringify(value));
  }
  return out;
}

// 出力全体を ```markdown ... ``` で包んでいる場合だけ、その包みを外す。
// （以前は末尾の ``` を無条件に外していたため、記事の最後が Mermaid 図などのコードブロックだと閉じが消え、
//   図の補正・検査が効かないまま保存されていた）
export function unwrapMarkdownFence(body) {
  const open = /^```(?:markdown|md)[ \t]*\r?\n/i;
  const t = String(body || "").trim();
  if (!open.test(t)) return t;
  return t.replace(open, "").replace(/\r?\n?```\s*$/, "").trim();
}

// ``` の数が奇数（閉じていないコードブロックがある）なら末尾で閉じる
export function closeOpenFence(md) {
  return (md.match(/```/g) || []).length % 2 === 0 ? md : `${md.trimEnd()}\n\`\`\`\n`;
}

// マークダウンのテーブル・異常空白のサニタイズ。コードブロックの中（YAML のインデント、Python の型 `str | None` など）は触らない
export function sanitizeMarkdownContent(raw) {
  let inFence = false;
  return String(raw || "").split("\n").map((line) => {
    if (FENCE_LINE_RE.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    let l = line;
    // マークダウンテーブルの区切り行で20文字以上の連続ハイフンを正規化（35k〜770k文字の破綻を抑止）
    if (l.includes("|")) {
      l = l.replace(/ {2,}/g, " ");
      l = l.replace(/:?-{20,}:?/g, ":---");
    }
    // 50文字以上の暴走連続空白のクレンジング
    return l.replace(/ {50,}/g, " ");
  }).join("\n");
}

// サイトのビルド（Astro）と同じ方法で frontmatter を読み、ページに必要な項目がそろっているか
export function frontmatterProblems(md) {
  let fm;
  try {
    fm = parseFrontmatter(String(md || "")).frontmatter;
  } catch (e) {
    return [`frontmatter を YAML として読めません（${String(e.message || e).split("\n")[0]}）`];
  }
  const problems = [];
  for (const k of ["title", "description", "pubDate", "repoUrl"]) {
    if (typeof fm[k] !== "string" || !fm[k].trim()) problems.push(`frontmatter の ${k} が文字列ではありません`);
  }
  if (typeof fm.pubDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(fm.pubDate)) problems.push(`frontmatter の pubDate が YYYY-MM-DD ではありません (${fm.pubDate})`);
  if (typeof fm.stars !== "number" || !Number.isFinite(fm.stars)) problems.push("frontmatter の stars が数値ではありません");
  return problems;
}

// 保存する直前の Web 記事の最終検査（CI の品質ゲートの Mermaid 検査・ビルドの frontmatter 解析と同じもの）
export async function finalWebArticleProblems(md) {
  const problems = [...frontmatterProblems(md)];
  if (!/```mermaid/.test(md)) problems.push("Mermaid 構成図がありません");
  problems.push(...mermaidProblems(md));
  problems.push(...(await mermaidParseErrors(md)).map((e) => `Mermaid図を描画できません: ${e}`));
  if ((md.match(/```/g) || []).length % 2 !== 0) problems.push("閉じていないコードブロックがあります");
  return problems;
}
