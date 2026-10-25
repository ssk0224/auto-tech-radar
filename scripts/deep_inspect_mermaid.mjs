import fs from 'fs';
import path from 'path';

function inspectMermaid(dirPath) {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md'));
  const issues = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const regex = /```mermaid([\s\S]*?)```/g;
    let match;
    let blockIndex = 0;

    while ((match = regex.exec(content)) !== null) {
      blockIndex++;
      const code = match[1];
      const lines = code.split('\n');

      lines.forEach((line, lineNo) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('%%')) return;

        // 1. Check unquoted parentheses inside square brackets: e.g. ID[Text (extra)]
        // But exclude cylinders: ID[(Database)]
        // Match: [ followed by anything not " then ( then anything ) then ]
        const parenInBracket = /\[([^"\]\n]*\([^\)\n]*\)[^"\]\n]*)\]/g;
        let pMatch;
        while ((pMatch = parenInBracket.exec(trimmed)) !== null) {
          // If it is [( ... )], that's a cylinder node, valid IF it starts with [( and ends with )]
          const inner = pMatch[1];
          if (trimmed.includes(`[(${inner.slice(1, -1)})]`)) {
            // It might be a cylinder
            continue;
          }
          issues.push({
            file,
            lineNo: lineNo + 1,
            type: 'UNQUOTED_PARENS_IN_BRACKET',
            line: trimmed,
            matched: pMatch[0]
          });
        }

        // 2. Check unquoted colons inside brackets: e.g. ID[Key: Value]
        // Often causes parse issues if not quoted
        const colonInBracket = /\[([^"\]\n]*:[^"\]\n]*)\]/g;
        let cMatch;
        while ((cMatch = colonInBracket.exec(trimmed)) !== null) {
          issues.push({
            file,
            lineNo: lineNo + 1,
            type: 'UNQUOTED_COLON_IN_BRACKET',
            line: trimmed,
            matched: cMatch[0]
          });
        }

        // 3. Check for illegal characters in node IDs (spaces, dots, hyphens in ID before [ or ()
        // e.g. node-1[Label] or node.1[Label]
        const idRegex = /^\s*([a-zA-Z0-9_\-\.]+)\s*(\[|\(|\{|\(\[|\(\()(?!\))/;
        const idM = trimmed.match(idRegex);
        if (idM) {
          const nodeId = idM[1];
          if (nodeId.includes('-') || nodeId.includes('.')) {
            // In Mermaid flowchart, node IDs with hyphens can cause syntax errors in some engines unless quoted
            issues.push({
              file,
              lineNo: lineNo + 1,
              type: 'HYPHEN_OR_DOT_IN_NODE_ID',
              line: trimmed,
              nodeId
            });
          }
        }
      });
    }
  }

  return issues;
}

const radarIssues = inspectMermaid('src/pages/radar');
const articleIssues = []; // Zenn 用の原稿（articles/）は置かない

console.log('=== Radar Mermaid Issues ===', radarIssues.length);
radarIssues.forEach(i => console.log(`  ${i.file}:${i.lineNo} [${i.type}]: ${i.line}`));

console.log('\n=== Article Mermaid Issues ===', articleIssues.length);
articleIssues.forEach(i => console.log(`  ${i.file}:${i.lineNo} [${i.type}]: ${i.line}`));
