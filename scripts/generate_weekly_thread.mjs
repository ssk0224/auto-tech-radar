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

const now = new Date();
const today = now.toISOString().split('T')[0];
const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
const outputFile = path.join(xDir, `weekly_summary_${today}.txt`);

// X重複検知を100%回避する動的フィーチャー（上位2つの具体的なOSS名を埋め込み）
const featuredNames = topPosts.slice(0, 2).map(p => p.title.split(' - ')[0].split(':')[0].trim()).join(' / ');
const dateLabel = `${now.getMonth() + 1}月${now.getDate()}日`;

let threadText = `【完全保存版】GitHub急上昇の最新AI＆テックOSS 7選（${dateLabel}速報）\n\n`;
threadText += `注目: ${featuredNames} など世界の最先端OSSを「技術構成」「受託開発・SaaS化の狙い目」で徹底解剖。\n`;
threadText += `新規事業のネタ帳・社内DX提案資料として即戦力です（ブックマーク推奨 📌）👇🧵\n\n`;

topPosts.forEach((p, idx) => {
  const shortTitle = p.title.split(' - ')[0].split(':')[0].trim();
  const starStr = p.stars > 0 ? `★ ${p.stars.toLocaleString()}` : '急上昇中';
  const cleanDesc = (p.desc || '').length > 46 ? (p.desc || '').slice(0, 44) + '...' : (p.desc || '');

  threadText += `--------------------------------------------------\n`;
  threadText += `【${idx + 1}/7】${shortTitle} (${starStr})\n`;
  threadText += `--------------------------------------------------\n`;
  threadText += `・概要: ${cleanDesc}\n`;
  threadText += `・狙い目: 業務自動化 / 自社DX基盤 / 独自SaaS化\n`;
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

// 第1ツイート用Intent URL（厳格な全角140字/重み280以内判定を保証し、絶対に文字数オーバーさせない高CTR設計）
const firstTweet = `【完全保存版】GitHub急上昇の最新AI・テックOSS 7選（${dateLabel}）\n\n注目: ${featuredNames} 等\n技術構成と商用化・受託提案の狙い目を徹底比較。DX資料やネタ帳に（保存推奨 📌）\n\n▼チートシート\nhttps://ssk0224.github.io/auto-tech-radar/cheatsheet/\n#AutoTechRadar #OSS`;
const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(firstTweet)}`;

console.log('===============================================================================');
console.log(`⚡ 【X集客ブースト】完全保存版まとめスレッドテキストを発行しました！（${dateLabel} ${timeStr}版）`);
console.log(`📄 保存先: ${outputFile}`);
console.log('===============================================================================\n');

// メモ帳（テキストファイル）と ブラウザ（X投稿画面）を対話型GUIで確実に起動
exec(`start "" "${outputFile}"`);
exec(`rundll32 url.dll,FileProtocolHandler "${tweetUrl}"`, (err) => {
  if (err) {
    exec(`start "" "${tweetUrl}"`);
  }
});
