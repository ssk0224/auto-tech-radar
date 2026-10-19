import fs from 'fs';
import path from 'path';

const articlesDir = path.resolve('articles');
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));
let fixedCount = 0;

for (const f of files) {
  const filePath = path.join(articlesDir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace Japanese topic "プログラミング" with "programming"
  if (content.includes('"プログラミング"')) {
    content = content.replace('"プログラミング"', '"programming"');
    modified = true;
  }

  // Replace "c++" with "cpp"
  if (content.includes('"c++"')) {
    content = content.replace('"c++"', '"cpp"');
    modified = true;
  }

  // Ensure newline after frontmatter if "---#" is present
  if (content.includes('---\n#') === false && content.includes('---#')) {
    content = content.replace(/---#/, '---\n\n#');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    fixedCount++;
  }
}

console.log(`✓ Updated Zenn topics in ${fixedCount} articles to English alphanumeric standard.`);
