// note 原稿の末尾に載せる推奨ハッシュタグ（2026-10-21）。
// 以前は全記事共通の固定タグ（#副業 #受託開発 など記事の内容と関係のない集客用タグを含む）だったため、
// 記事の対象（リポジトリの言語・GitHub トピック）から 3〜5 個を作る
export const HASHTAG_HEADING = "**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）";
const HEADING_RE = /^\*\*【note出品時用 推奨ハッシュタグ】\*\*/;
const TAGS_LINE_RE = /^(#\S+\s*)+$/;
const MIN_TAGS = 3;
const MAX_TAGS = 5;
// 記事の内容と関係のない集客用のタグ・GitHub でよく付く内容と無関係なトピックは使わない
const EXCLUDED = new Set(["副業", "受託開発", "awesome", "opensource", "oss", "github"]);
const EXCLUDED_RE = /hacktoberfest/i;
// タグ欄で区切られてしまう記号を含む言語名の言い換え
const LANGUAGE_ALIASES = { "c++": "Cpp", "c#": "CSharp", "f#": "FSharp", "objective-c++": "ObjectiveCpp" };

// タグとして使える形にする（ハイフンは _ に、空白・その他の記号は除く）。使えなければ空文字
function toTag(raw) {
  const s = String(raw || "").trim();
  const alias = LANGUAGE_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  return s.replace(/-/g, "_").replace(/[^\p{L}\p{N}_]/gu, "").replace(/^_+|_+$/g, "");
}

// リポジトリ情報から推奨ハッシュタグ（# 付き）を 3〜5 個作る。#OSS を必ず含める（note_vault の要件）
export function noteHashtags(repo = {}) {
  const tags = ["OSS"];
  const seen = new Set(["oss"]);
  const add = (raw) => {
    const t = toTag(raw);
    const key = t.toLowerCase();
    if (!t || /^\d+$/.test(t) || t.length > 24 || seen.has(key) || EXCLUDED.has(key) || EXCLUDED_RE.test(key) || tags.length >= MAX_TAGS) return;
    seen.add(key);
    tags.push(t);
  };
  add(repo.language);
  // GitHub トピックは英小文字とハイフンだけなので、ハイフンの無いもの（単語）を優先する
  const topics = Array.isArray(repo.topics) ? repo.topics.filter((t) => typeof t === "string") : [];
  topics.filter((t) => !t.includes("-")).forEach(add);
  topics.filter((t) => t.includes("-")).forEach(add);
  // 言語・トピックが足りなければ、どの記事にも当てはまるタグで 3 個にする
  for (const fallback of ["GitHub", "プログラミング"]) {
    if (tags.length >= MIN_TAGS) break;
    if (!seen.has(fallback.toLowerCase())) {
      seen.add(fallback.toLowerCase());
      tags.push(fallback);
    }
  }
  return tags.map((t) => `#${t}`);
}

// 原稿末尾の推奨ハッシュタグ行を tags に置き換える（見出しが無ければ末尾に足す）
export function applyNoteHashtags(content, tags) {
  const lines = content.split("\n");
  let h = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (HEADING_RE.test(lines[i].replace(/\r$/, ""))) {
      h = i;
      break;
    }
  }
  const tagLine = tags.join(" ");
  if (h === -1) return `${content.trimEnd()}\n\n---\n${HASHTAG_HEADING}\n${tagLine}\n`;
  // 見出しの直後にあるタグ行（空行を挟む場合も含む）を取り除いてから差し込む
  let end = h + 1;
  for (let j = h + 1; j < lines.length; j++) {
    const l = lines[j].replace(/\r$/, "");
    if (TAGS_LINE_RE.test(l)) end = j + 1;
    else if (l.trim() !== "") break;
  }
  const eol = lines[h].endsWith("\r") ? "\r" : "";
  return [...lines.slice(0, h), HASHTAG_HEADING + eol, tagLine + (end < lines.length ? eol : ""), ...lines.slice(end)].join("\n");
}
