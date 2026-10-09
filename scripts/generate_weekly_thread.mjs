import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const xDir = path.join(rootDir, 'x_posts');

if (!fs.existsSync(xDir)) fs.mkdirSync(xDir, { recursive: true });

function getTopPosts() {
  if (!fs.existsSync(radarDir)) return [];
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  
  const posts = files.map(f => {
    const content = fs.readFileSync(path.join(radarDir, f), 'utf8');
    const slug = f.replace('.md', '');
    
    // frontmatter抽出
    let title = slug;
    let desc = '';
    let tags = [];
    let stars = 0;
    let pubDate = '2026-01-01';

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];
      const titleM = fm.match(/^title:\s*"?(.*?)"?$/m);
      if (titleM) title = titleM[1];
      const descM = fm.match(/^description:\s*"?(.*?)"?$/m);
      if (descM) desc = descM[1];
      const starsM = fm.match(/^stars:\s*(\d+)/m);
      if (starsM) stars = parseInt(starsM[1], 10);
      const dateM = fm.match(/^pubDate:\s*"?(.*?)"?$/m);
      if (dateM) pubDate = dateM[1];
      const tagsM = fm.match(/^tags:\s*\[(.*?)\]/m);
      if (tagsM) {
        tags = tagsM[1].split(',').map(s => s.replace(/["'\s]/g, ''));
      }
    }

    return { slug, title, desc, tags, stars, pubDate };
  });

  return posts.sort((a, b) => b.stars - a.stars);
}

const topPosts = getTopPosts().slice(0, 7);

if (topPosts.length === 0) {
  console.log('記事が見つかりません。');
  process.exit(1);
}

const today = new Date().toISOString().split('T')[0];
const outputFile = path.join(xDir, `weekly_summary_${today}.txt`);

let threadText = `【完全保存版】GitHubで急上昇した最新AI＆テックOSS 7選\n\n`;
threadText += `世界のエンジニアが注目する最新OSSを「技術アーキテクチャ」「受託開発・SaaS化の狙い目」で徹底比較しました。\n`;
threadText += `新規事業のネタ帳・社内DX提案資料として役立ちます（ブックマーク推奨 📌）👇🧵\n\n`;

topPosts.forEach((p, idx) => {
  const shortTitle = p.title.split(' - ')[0].split(':')[0].trim();
  const starStr = p.stars > 0 ? `★ ${p.stars.toLocaleString()}` : '急上昇中';
  const tagStr = p.tags.slice(0, 2).map(t => `#${t}`).join(' ');

  threadText += `--------------------------------------------------\n`;
  threadText += `【${idx + 1}/7】${shortTitle} (${starStr})\n`;
  threadText += `--------------------------------------------------\n`;
  threadText += `・概要: ${p.desc}\n`;
  threadText += `・商用化の狙い目: 業務自動化 / 自社DX基盤 / 独自SaaS化\n`;
  threadText += `・詳細解説: https://ssk0224.github.io/auto-tech-radar/radar/${p.slug}/\n\n`;
});

threadText += `--------------------------------------------------\n`;
threadText += `【全OSS横断チートシート ＆ 比較マトリクス】\n`;
threadText += `--------------------------------------------------\n`;
threadText += `蓄積された全OSSの想定受託単価・技術スタック一覧は公式メディアで無料公開中（検索・絞り込み対応）：\n`;
threadText += `👉 https://ssk0224.github.io/auto-tech-radar/cheatsheet/\n\n`;
threadText += `毎朝6:00に海外急上昇OSSを日本語解剖中。\n`;
threadText += `最新トレンドを見逃さないよう @AutoTechRadar をフォロー＆RTお願いします！\n`;
threadText += `#AutoTechRadar #OSS #AI #エンジニア #プログラミング\n`;

fs.writeFileSync(outputFile, threadText, 'utf8');

// 第1ツイート用Intent URL
const firstTweet = `【完全保存版】GitHub急上昇の最新AI＆テックOSS 7選まとめ\n\n世界の最新オープンソースを「技術アーキテクチャ」「商用受託・SaaS展開性」で徹底比較。\n新規事業のネタ帳・社内DX提案資料に最適（保存推奨 📌）\n\n全一覧・チートシート👇\nhttps://ssk0224.github.io/auto-tech-radar/cheatsheet/\n\n#AutoTechRadar #OSS #AI`;
const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(firstTweet)}`;

console.log('===============================================================================');
console.log('⚡ 【X集客ブースト】完全保存版まとめスレッドテキストを生成しました！');
console.log(`📄 保存先: ${outputFile}`);
console.log('===============================================================================\n');

// メモ帳（テキストファイル）と Chrome（X投稿画面）を直接起動
exec(`start "" "${outputFile}"`);
exec(`start chrome "${tweetUrl}"`, (err) => {
  if (err) {
    exec(`powershell -NoProfile -Command "Start-Process '${tweetUrl.replace(/'/g, "''")}'"`);
  }
});
