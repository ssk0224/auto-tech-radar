import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeAndAttachUrlToTweet, calcTwitterWeight } from './utils/twitter_formatter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const xDir = path.join(rootDir, 'x_posts');

if (!fs.existsSync(xDir)) {
  console.log('x_posts directory not found.');
  process.exit(1);
}

const files = fs.readdirSync(xDir).filter(f => f.endsWith('_x.txt'));
console.log(`Auditing and updating ${files.length} X post files...`);

let updatedCount = 0;

for (const file of files) {
  const filePath = path.join(xDir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const slug = file.replace(/_x\.txt$/, '');

  // Extract Tweet 1
  const t1Regex = /--------------------------------------------------\r?\n【ツイート 1】\r?\n([\s\S]*?)\r?\n\r?\n👉 ワンクリックで投稿画面を開く:\r?\n(https:\/\/twitter\.com\/intent\/tweet\?text=[^\r\n]+)\r?\n--------------------------------------------------/;
  const match = content.match(t1Regex);

  if (!match) {
    continue;
  }

  const rawTweet1 = match[1].trim();
  const safeData = sanitizeAndAttachUrlToTweet(rawTweet1, slug);

  // Replace Tweet 1 and its intent URL in the file
  const newTweet1Block = `--------------------------------------------------\n【ツイート 1】\n${safeData.tweet}\n\n👉 ワンクリックで投稿画面を開く:\n${safeData.intentUrl}\n--------------------------------------------------`;

  const updatedContent = content.replace(match[0], newTweet1Block);

  fs.writeFileSync(filePath, updatedContent, 'utf8');
  updatedCount++;
  console.log(`✓ ${file}: Weight ${safeData.weight}/280 (${safeData.charsJp}文字) [リンク付き・100%安全]`);
}

console.log(`\n🎉 Completed! Updated ${updatedCount} X post files.`);
