import fs from 'fs';
import path from 'path';

function auditDirectory(dirName) {
  const dir = path.resolve(dirName);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  console.log(`=== Checking directory: ${dirName} (${files.length} files) ===`);
  
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

    // 2. Abnormal whitespace: 50+ consecutive spaces
    const excessiveSpace = content.match(/ {50,}/g);
    if (excessiveSpace) {
      console.error(`  ❌ [EXCESSIVE SPACE] ${f}: Found ${excessiveSpace.length} instances of 50+ spaces`);
      issueCount++;
    }

    // 3. Check for HTML unclosed tags
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
    console.log(`  ✓ All files in ${dirName} passed basic code block, whitespace, and tag checks.\n`);
  } else {
    console.log(`  Found ${issueCount} potential issues in ${dirName}.\n`);
  }
}

auditDirectory('src/pages/radar');
auditDirectory('articles');
