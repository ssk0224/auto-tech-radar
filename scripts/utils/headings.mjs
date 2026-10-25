// 記事の見出しレベルを整える: ページ内の h1 は記事タイトルの 1 つだけ（2 つ目以降の # は ## に下げる）。
// h1 が無ければ title を h1 として本文の先頭に入れる。コードブロック内の # は見出しではないので触らない
export function normalizeHeadings(md, title) {
  const fm = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const head = fm ? fm[0] : "";
  let inFence = false;
  let seenH1 = false;
  const body = md.slice(head.length).split("\n").map((line) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (inFence || !/^# \S/.test(line)) return line;
    if (!seenH1) {
      seenH1 = true;
      return line;
    }
    return `#${line}`;
  });
  if (!seenH1 && title) body.unshift(`# ${title}`, "");
  return head + body.join("\n");
}

const lf = (s) => String(s ?? "").replace(/\r\n?/g, "\n");

// コードブロックの外の行（[行, 行番号]）
export function outsideFences(md) {
  const out = [];
  let fence = null;
  lf(md).split("\n").forEach((line, i) => {
    const f = line.match(/^\s*(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (!fence) out.push([line, i]);
  });
  return out;
}

// note の有料部分の見出し（leakhunt C4、2026-10-22）: note.com の目次は有料ラインより後の見出しまで匿名の読者に表示するため、
// 有料部分では Markdown の見出しを使わず、節の題を太字の行にする。コードブロックの中の # は見出しではない
export const paidHeadingLines = (md) => outsideFences(md).map(([l]) => l.trimEnd()).filter((l) => /^#{1,6}\s/.test(l));
export function paidHeadingsToBold(md) {
  const lines = lf(md).split("\n");
  for (const [l, i] of outsideFences(md)) {
    const m = l.match(/^#{1,6}\s+(.*?)\s*#*\s*$/);
    if (m && m[1]) lines[i] = `**${m[1].replace(/\*\*/g, "")}**`;
  }
  return lines.join("\n");
}
