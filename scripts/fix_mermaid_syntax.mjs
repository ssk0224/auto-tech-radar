import fs from 'fs';
import path from 'path';

function fixMermaidInContent(content) {
  return content.replace(/```mermaid([\s\S]*?)```/g, (match, code) => {
    const lines = code.split('\n');
    const fixedLines = lines.map(line => {
      let l = line;

      // 1. subgraph syntax: subgraph ID [Label with parens/colons/spaces] -> subgraph ID ["Label"]
      l = l.replace(/^(\s*subgraph\s+)([a-zA-Z0-9_\-]+)\s*\[([^"\]]+)\]/g, (m, prefix, id, label) => {
        return `${prefix}${id} ["${label.trim()}"]`;
      });
      // subgraph with spaces in id: subgraph magpie Local Core Gateway [127.0.0.1:3425]
      l = l.replace(/^(\s*subgraph\s+)(magpie\s+Local\s+Core\s+Gateway)\s*\[([^"\]]+)\]/g, (m, prefix, id, label) => {
        return `${prefix}magpie_gateway ["magpie Local Core Gateway (${label.trim()})"]`;
      });

      // 2. Cylinder nodes: ID[(Label with parens/slashes)] -> ID[("Label")]
      l = l.replace(/([a-zA-Z0-9_]+)\[\(([^"\)\n]+)\)\]/g, (m, id, label) => {
        if (!label.startsWith('"')) {
          return `${id}[("${label.trim()}")]`;
        }
        return m;
      });

      // 3. Stadium nodes: ID([Label with parens/slashes]) -> ID(["Label"])
      l = l.replace(/([a-zA-Z0-9_]+)\(\[([^"\]\n]+)\]\)/g, (m, id, label) => {
        if (!label.startsWith('"')) {
          return `${id}(["${label.trim()}"])`;
        }
        return m;
      });

      // 4. Square bracket nodes: ID[Label] where Label contains ( or ) or : or / but is NOT already quoted
      // Match ID[ ... ] where inside has no " and has ( or ) or : or /
      l = l.replace(/([a-zA-Z0-9_\-]+)\[([^"\]\n]*[\(\)\:\/][^"\]\n]*)\]/g, (m, id, label) => {
        // Don't match if it was already cylinder or stadium
        if (label.startsWith('(') && label.endsWith(')')) return m;
        return `${id}["${label.trim()}"]`;
      });

      // 5. Rounded nodes: ID(Label) where Label has ( or ) or : or / but not quoted
      // e.g. B(Linux Runtime - proot); or B(Laya-MLX Agent)
      l = l.replace(/([a-zA-Z0-9_\-]+)\(([^"\)\n]*[\(\)\:\/][^"\)\n]*)\)/g, (m, id, label) => {
        return `${id}("${label.trim()}")`;
      });

      return l;
    });

    return ````mermaid${fixedLines.join('\n')}````;
  });
}

const dirs = ['src/pages/radar', 'articles'];
let totalFixedFiles = 0;

for (const dirName of dirs) {
  const dir = path.resolve(dirName);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

  for (const f of files) {
    const fp = path.join(dir, f);
    const content = fs.readFileSync(fp, 'utf8');
    const updated = fixMermaidInContent(content);

    if (updated !== content) {
      fs.writeFileSync(fp, updated, 'utf8');
      totalFixedFiles++;
      console.log(`✓ Fixed Mermaid syntax in: ${dirName}/${f}`);
    }
  }
}

console.log(`\nCompleted Mermaid syntax fix. Updated ${totalFixedFiles} files.`);
