// Mermaid 図の補正と検査。生成（crawl_and_generate）・テスト・監査（audit_quality）で同じ定義を使う。
// 生成時に補正したあとで検査し、問題が残れば採用しない（定期実行の最後のテストで初めて落ちて、その日の公開が丸ごと止まるのを防ぐ）

const NODE_RE = /\b([A-Za-z0-9_-]+)\s*\[([^"\[\(\]\n\r][^\]\n\r]*)\]/;
// 引用符なしだと Mermaid が構文として解釈しうる文字（括弧・コロン・セミコロン・& ・カンマ・山括弧・スラッシュ）と <br>
const NEEDS_QUOTE = /[()\:;&,<>\/]|<br\s*\/?>/;

// 引用符の外側だけを変換する（引用済みラベルの中身を二重に書き換えない）
function outsideQuotes(line, fn) {
  return line.split(/("[^"]*")/).map((part, i) => (i % 2 === 1 ? part : fn(part))).join('');
}

export function fixMermaidInContent(content) {
  return content.replace(/```mermaid([\s\S]*?)```/g, (match, code) => {
    // 1. HTML実体参照のエスケープ解除
    code = code.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    // 2. <formula> などのHTMLタグ風プレースホルダーを formula_name 等に置換（<br>や<br/>は保持）
    // （英字で始まるものだけ。<--> などの矢印を壊さない）
    code = code.replace(/<(?!\/?br\s*\/?)([a-zA-Z][a-zA-Z0-9_-]*)>/g, '$1_name');
    const fixedLines = code.split('\n').map((line) => {
      let l = line;
      // subgraph id [label] → subgraph id ["label"]
      l = l.replace(/^(\s*subgraph\s+)([a-zA-Z0-9_\-]+)\s*\[([^"\]]+)\]/g, (m, prefix, id, label) => `${prefix}${id} ["${label.trim()}"]`);
      // subgraph Label with spaces (IDなし) → subgraph ID ["Label with spaces"]
      l = l.replace(/^(\s*subgraph\s+)([^"\[\n\r]+)$/g, (m, prefix, label) => {
        const trimmed = label.trim();
        if (!trimmed || trimmed.startsWith('"')) return m;
        const safeId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '_');
        return `${prefix}${safeId} ["${trimmed}"]`;
      });
      // シリンダー [(label)] とスタジアム ([label])
      l = l.replace(/([a-zA-Z0-9_]+)\[\(([^"\)\n]+)\)\]/g, (m, id, label) => (label.startsWith('"') ? m : `${id}[("${label.trim()}")]`));
      l = l.replace(/([a-zA-Z0-9_]+)\(\[([^"\]\n]+)\]\)/g, (m, id, label) => (label.startsWith('"') ? m : `${id}(["${label.trim()}"])`));
      // 角括弧ノード: 記号を含むラベルは引用符で囲む（行内の全ノード）
      l = outsideQuotes(l, (seg) => seg.replace(/\b([A-Za-z0-9_-]+)\s*\[([^"\[\(\]\n\r][^\]\n\r]*)\]/g, (m, id, label) => (NEEDS_QUOTE.test(label) ? `${id}["${label.trim().replace(/"/g, "'")}"]` : m)));
      // 引用符付きラベルの中の引用符（["a ("b")"] の内側）は単引用符にする
      l = l.replace(/\["((?:[^"\n]|"(?!\]))*)"\]/g, (m, inner) => `["${inner.replace(/"/g, "'")}"]`);
      // 辺ラベル -->|...| に記号があれば引用符で囲む
      l = outsideQuotes(l, (seg) => seg.replace(/\|([^|"\n]*[()&:,;\/<>][^|"\n]*)\|/g, (m, label) => `|"${label.trim()}"|`));
      // 丸括弧ノード
      l = outsideQuotes(l, (seg) => seg.replace(/([a-zA-Z0-9_\-]+)\(([^"\(\)\[\n]*[:\/<>,;&][^"\(\)\n]*)\)/g, (m, id, label) => `${id}("${label.trim()}")`));
      return l;
    });
    return '```mermaid' + fixedLines.join('\n') + '```';
  });
}

// 問題の一覧（空なら合格）。各要素は人が読める説明
export function mermaidProblems(content) {
  const problems = [];
  for (const block of content.match(/```mermaid[\s\S]*?```/g) || []) {
    const entities = block.match(/&(?:gt|lt|amp|quot|#\d+|#x[0-9a-fA-F]+);/g);
    if (entities) problems.push(`HTML実体参照 (${[...new Set(entities)].join(', ')})`);
    const badTags = block.match(/<(?!\/?br\s*\/?)(?!b>)(?!i>)[a-zA-Z][a-zA-Z0-9_-]*[^>]*>/g);
    if (badTags) problems.push(`不正なHTMLタグ (${[...new Set(badTags)].join(', ')})`);
    block.split('\n').forEach((line, i) => {
      const sub = line.match(/^\s*subgraph\s+([^\[\n]+)$/);
      if (sub) {
        const raw = sub[1].trim();
        if (!raw.startsWith('"') && !raw.endsWith('"') && /[()\/&+\s]/.test(raw)) problems.push(`${i + 1}行目: 引用符なしの subgraph "${raw}"`);
      }
      for (const m of line.matchAll(new RegExp(NODE_RE.source, 'g'))) {
        if (m[2].includes('<br>') || /[():;&,]/.test(m[2])) problems.push(`${i + 1}行目: 特殊文字を含む未クォートノードラベル ${m[1]}[${m[2]}]`);
      }
    });
  }
  return problems;
}
