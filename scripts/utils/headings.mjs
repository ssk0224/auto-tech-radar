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
