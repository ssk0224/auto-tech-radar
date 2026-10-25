// 配信物（dist）のテキストの読み方。画面に出る文・運営者の文（記事本文を除いた部分）・データから作った要素（data-derived）を分ける
import { renderedText, stripComments } from "./public_text.mjs";

// テキストかどうかは中身で決める（拡張子の一覧ではない）
export const isTextBuffer = (buf) => !buf.subarray(0, 8000).includes(0);

// 開きタグの位置から、同じ名前の閉じタグ（入れ子を数える）までの範囲
function elementEnd(html, start, tag) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, "gi");
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[2] === "/") continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return re.lastIndex;
  }
  return html.length;
}

// data-derived を持つ要素（掲載データ・定数から作った表示）
export function derivedElements(html) {
  const out = [];
  const re = /<([a-zA-Z][\w-]*)\b([^>]*\bdata-derived="([^"]*)"[^>]*)>/g;
  for (const m of html.matchAll(re)) {
    const end = elementEnd(html, m.index, m[1]);
    const value = m[2].match(/\bdata-derived-value="([^"]*)"/)?.[1];
    out.push({ kind: m[3], value, text: renderedText(html.slice(m.index, end)).replace(/\s+/g, " ").trim(), start: m.index, end });
  }
  return out;
}

export function removeDerived(html) {
  let out = html;
  for (const el of derivedElements(html).sort((a, b) => b.start - a.start)) out = out.slice(0, el.start) + out.slice(el.end);
  return out;
}

// 運営者の文: 記事本文（取り上げた OSS についての文）を除き、本文の中の有料版の案内（運営者の文）は残す。
// <script> は画面に出す文字列を含むので残し、コメントだけ除く。RSS は記事ごとの <item> を除いたチャンネルの部分
export function operatorView(rel, raw) {
  let s = raw;
  if (/\.html$/i.test(rel)) {
    s = s.replace(/<article id="article-body">([\s\S]*?)<\/article>/g, (_, inner) => (inner.match(/<aside class="note-offer[\s\S]*?<\/aside>/) || [""])[0]);
    s = s.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, a, js, b) => (/application\/ld\+json/.test(a) ? a + js + b : a + stripComments(js) + b));
  }
  if (/\.xml$/i.test(rel)) s = s.replace(/<item>[\s\S]*?<\/item>/g, "");
  return s;
}

// 画面に出る行（タグで分けた語をつなぎ、URL・パスを除く）
export const visibleLines = (markup) =>
  renderedText(markup)
    .split("\n")
    .map((l) => l.replace(/(?:https?:)?\/\/[^\s)"'<>`]+/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
