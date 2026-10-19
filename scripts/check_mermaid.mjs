import fs from 'fs';
import path from 'path';

const dirs = ['src/pages/radar', 'articles'];

for (const dirName of dirs) {
  const dir = path.resolve(dirName);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  console.log(`\n==================================================`);
  console.log(`Auditing Mermaid diagrams in: ${dirName} (${files.length} files)`);
  console.log(`==================================================`);

  for (const f of files) {
    const filePath = path.join(dir, f);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = /```mermaid([\s\S]*?)```/g;
    let match;
    let index = 0;

    while ((match = regex.exec(content)) !== null) {
      index++;
      const mermaidCode = match[1].trim();
      const lines = mermaidCode.split('\n');

      let subgraphCount = 0;
      let endCount = 0;

      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('%%')) return;

        // Check subgraphs
        if (/^subgraph\b/.test(trimmed)) subgraphCount++;
        if (trimmed === 'end') endCount++;

        // Check for unquoted brackets inside node labels
        // e.g. [ ... ( ... ) ... ] where the label is NOT wrapped in quotes ["..."]
        // Pattern: [ followed by not-" then ( then not-" then ]
        const unquotedParenInBracket = /\[([^"\]]*\([^\)]*\)[^"\]]*)\]/;
        const m1 = trimmed.match(unquotedParenInBracket);
        if (m1) {
          console.warn(`  ⚠️ [UNQUOTED PAREN IN BRACKET] ${f} (diag ${index}, line ${lineIdx + 1}):`);
          console.warn(`     Line: ${trimmed}`);
        }

        // Check for unquoted curly braces inside brackets: [{ ... }]
        const unquotedCurlyInBracket = /\[([^"\]]*\{[^\}]*\}[^"\]]*)\]/;
        const m2 = trimmed.match(unquotedCurlyInBracket);
        if (m2) {
          console.warn(`  ⚠️ [UNQUOTED CURLY IN BRACKET] ${f} (diag ${index}, line ${lineIdx + 1}):`);
          console.warn(`     Line: ${trimmed}`);
        }

        // Check for invalid single arrow in flowchart (-> instead of -->)
        if (/(graph|flowchart)/.test(mermaidCode) && /\s->\s/.test(trimmed) && !/-->/.test(trimmed)) {
          console.warn(`  ⚠️ [INVALID ARROW ->] ${f} (diag ${index}, line ${lineIdx + 1}):`);
          console.warn(`     Line: ${trimmed}`);
        }

        // Check for unbalanced quotes
        const quoteMatches = trimmed.match(/"/g) || [];
        if (quoteMatches.length % 2 !== 0) {
          console.warn(`  ⚠️ [UNBALANCED QUOTES] ${f} (diag ${index}, line ${lineIdx + 1}):`);
          console.warn(`     Line: ${trimmed}`);
        }
      });

      if (subgraphCount !== endCount) {
        console.warn(`  ❌ [SUBGRAPH MISMATCH] ${f} (diag ${index}): subgraph=${subgraphCount}, end=${endCount}`);
      }
    }
  }
}
