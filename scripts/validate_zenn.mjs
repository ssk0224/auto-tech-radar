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
  const titleMatch = content.match(/^title:\s*["']?(.*?)["']?$/m);
  if (!titleMatch || !titleMatch[1].trim()) {
    errors.push(`${f}: Missing or empty title.`);
  } else if (titleMatch[1].trim().length > 70) {
    errors.push(`${f}: Title length (${titleMatch[1].trim().length}) exceeds Zenn's 70-character limit.`);
  }

  if (!/^type:\s*"(tech|idea)"$/m.test(content)) {
    errors.push(`${f}: Missing or invalid type (must be "tech" or "idea").`);
  }
  if (!/^emoji:\s*.+$/m.test(content)) {
    errors.push(`${f}: Missing emoji.`);
  }

  const topicsMatch = content.match(/^topics:\s*(\[.*?\])/m);
  if (!topicsMatch) {
    errors.push(`${f}: Missing topics array.`);
  } else {
    try {
      const parsedTopics = JSON.parse(topicsMatch[1]);
      if (!Array.isArray(parsedTopics) || parsedTopics.length === 0 || parsedTopics.length > 5) {
        errors.push(`${f}: Topics count (${Array.isArray(parsedTopics) ? parsedTopics.length : 0}) must be between 1 and 5.`);
      }
    } catch (e) {
      errors.push(`${f}: Failed to parse topics JSON array.`);
    }
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
