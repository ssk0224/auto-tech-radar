import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { zennCta } from './utils/funnel_copy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const zennDir = path.join(rootDir, 'zenn_drafts');

if (!fs.existsSync(zennDir)) fs.mkdirSync(zennDir, { recursive: true });

const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
let createdCount = 0;

for (const file of files) {
  const slug = file.replace('.md', '');
  const zennFile = path.join(zennDir, `${slug}_zenn.md`);

  const content = fs.readFileSync(path.join(radarDir, file), 'utf8');
  let cleanBody = content.replace(/^---[\s\S]*?---\n*/, '').trim();

  // タイトルとタグ抽出
  let title = slug;
  let tag = 'ai';
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const titleM = fmMatch[1].match(/^title:\s*"?(.*?)"?$/m);
    if (titleM) title = titleM[1].split(' - ')[0].trim();
    const tagsM = fmMatch[1].match(/^tags:\s*\[(.*?)\]/m);
    if (tagsM) {
      const firstTag = tagsM[1].split(',')[0].replace(/["'\s]/g, '').toLowerCase();
      if (firstTag) tag = firstTag;
    }
  }

  const zennDraft = `---
title: "【徹底解剖】海外急上昇OSS「${title}」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["${tag}", "oss", "github", "architecture", "programming"]
published: true
---

${cleanBody}

---

${zennCta(slug)}`;

  fs.writeFileSync(zennFile, zennDraft, 'utf8');
  createdCount++;
}

console.log(`✓ 全 ${createdCount} 本の Zenn / Qiita 送客ドラフトを一括生成・最新化しました！`);
