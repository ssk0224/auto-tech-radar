import fs from 'fs';
import path from 'path';

function auditDirectory(dirName) {
  const dir = path.resolve(dirName);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  console.log(`=== Auditing directory: ${dirName} (${files.length} files) ===`);
  
  let issueCount = 0;

  for (const f of files) {
    const filePath = path.join(dir, f);
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Incomplete code blocks (count occurrences of ```)
    const matches = content.match(/```/g) || [];
    if (matches.length % 2 !== 0) {
      console.error(`  ❌ [UNCLOSED CODE BLOCK] ${f}: Odd number of backticks (${matches.length})`);
      issueCount++;
    }

    // 2. Abnormal whitespace: 50+ consecutive spaces outside fenced code blocks
    const contentOutsideCode = content.replace(/```[\s\S]*?```/g, '');
    const excessiveSpace = contentOutsideCode.match(/ {50,}/g);
    if (excessiveSpace) {
      console.error(`  ❌ [EXCESSIVE SPACE] ${f}: Found ${excessiveSpace.length} instances of 50+ spaces outside code blocks`);
      issueCount++;
    }

    // 3. Corrupted long lines (> 1000 characters)
    const lines = content.split(/\r?\n/);
    lines.forEach((l, idx) => {
      if (l.length > 1000) {
        console.error(`  ❌ [CORRUPTED LONG LINE] ${f} Line ${idx + 1}: length ${l.length}`);
        issueCount++;
      }
    });

    // 4. Check for HTML unclosed tags
    const tagsToCheck = ['div', 'span', 'p', 'b', 'strong', 'em', 'i', 'a', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'details', 'summary'];
    for (const tag of tagsToCheck) {
      const openRegex = new RegExp(`<${tag}(\\s+[^>]*)?>`, 'gi');
      const closeRegex = new RegExp(`</${tag}>`, 'gi');
      const selfCloseRegex = new RegExp(`<${tag}(\\s+[^>]*)?/>`, 'gi');
      
      const openMatches = content.match(openRegex) || [];
      const closeMatches = content.match(closeRegex) || [];
      const selfCloseMatches = content.match(selfCloseRegex) || [];
      
      const netOpen = openMatches.length - selfCloseMatches.length;
      if (netOpen !== closeMatches.length) {
        console.warn(`  ⚠️ [TAG MISMATCH] ${f}: <${tag}> net open=${netOpen}, close=${closeMatches.length}`);
        issueCount++;
      }
    }
  }

  if (issueCount === 0) {
    console.log(`  ✓ All files in ${dirName} passed code block, whitespace, long line, and tag checks.\n`);
  } else {
    console.log(`  Found ${issueCount} issues in ${dirName}.\n`);
  }
  return issueCount;
}

const rIssues = auditDirectory('src/pages/radar');
const aIssues = 0; // Zenn 用の原稿（articles/）は置かない

if (rIssues === 0 && aIssues === 0) {
  console.log('🎉 Superpowers content integrity audit: 100% PERFECT PASS!');
} else {
  process.exit(1);
}
