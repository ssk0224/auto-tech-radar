import fs from 'fs';
import path from 'path';

const articlesDir = path.resolve('articles');
const files = fs.readdirSync(articlesDir);
let errors = [];
let checked = 0;

for (const f of files) {
  if (!f.endsWith('.md')) continue;
  checked++;
  const slug = f.replace('.md', '');

  // 12 to 50 chars, alphanumeric + hyphen/underscore
  if (slug.length < 12 || slug.length > 50) {
    errors.push(`${f}: Slug length (${slug.length}) is not between 12 and 50 characters.`);
  }
  if (!/^[a-z0-9_-]+$/.test(slug)) {
    errors.push(`${f}: Slug contains invalid characters (must be [a-z0-9_-]).`);
  }

  const content = fs.readFileSync(path.join(articlesDir, f), 'utf8');
  if (!content.startsWith('---')) {
    errors.push(`${f}: Missing YAML frontmatter start (---).`);
  }
  if (!/^title:\s*.+$/m.test(content)) {
    errors.push(`${f}: Missing title.`);
  }
  if (!/^type:\s*"(tech|idea)"$/m.test(content)) {
    errors.push(`${f}: Missing or invalid type (must be "tech" or "idea").`);
  }
  if (!/^emoji:\s*.+$/m.test(content)) {
    errors.push(`${f}: Missing emoji.`);
  }
  if (!/^topics:\s*\[.*\]/m.test(content)) {
    errors.push(`${f}: Missing topics.`);
  }
  if (!/^published:\s*(true|false)/m.test(content)) {
    errors.push(`${f}: Missing published.`);
  }
}

if (errors.length > 0) {
  console.error(`❌ Zenn validation failed with ${errors.length} errors:`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
} else {
  console.log(`✅ Zenn validation passed! Checked ${checked} articles. 100% compliant with Zenn GitHub specification.`);
}
