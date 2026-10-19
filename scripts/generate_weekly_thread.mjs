import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { isNoise } from './utils/noise_filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const xDir = path.join(rootDir, 'x_posts');

if (!fs.existsSync(xDir)) fs.mkdirSync(xDir, { recursive: true });

function getTopPosts() {
  if (!fs.existsSync(radarDir)) return [];
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md') && !isNoise(f.replace('.md', '')));
  
  const posts = files.map(f => {
    const content = fs.readFileSync(path.join(radarDir, f), 'utf8');
    const slug = f.replace('.md', '');
    
    // frontmatter抽出
    let title = slug;
    let desc = '';
    let tags = [];
    let stars = 0;
    let pubDate = '';

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

  // 直近7日に公開した記事をスター数順に。7本に満たなければ新しい順で補う
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const recent = posts.filter(p => p.pubDate >= since).sort((a, b) => b.stars - a.stars);
  const rest = posts.filter(p => !(p.pubDate >= since)).sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  return [...recent, ...rest];
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

let threadText = `今週取り上げた GitHub 急上昇OSS ${topPosts.length}選（${dateLabel}）\n\n`;
threadText += `注目: ${featuredNames} など。README をもとに技術構成と使いどころを日本語で解説しています。\n`;
threadText += `技術リサーチのメモにどうぞ（ブックマーク推奨 📌）👇🧵\n\n`;

topPosts.forEach((p, idx) => {
  const shortTitle = p.title.split(' - ')[0].split(':')[0].trim();
  const starStr = p.stars > 0 ? `★ ${p.stars.toLocaleString()}` : 'GitHub';
  const cleanDesc = (p.desc || '').length > 46 ? (p.desc || '').slice(0, 44) + '...' : (p.desc || '');

  threadText += `--------------------------------------------------\n`;
  threadText += `【${idx + 1}/${topPosts.length}】${shortTitle} (${starStr})\n`;
  threadText += `--------------------------------------------------\n`;
  threadText += `・概要: ${cleanDesc}\n`;
  threadText += `・詳細解説: https://ssk0224.github.io/auto-tech-radar/radar/${p.slug}/\n\n`;
});

threadText += `--------------------------------------------------\n`;
threadText += `【全OSSの比較チートシート】\n`;
threadText += `--------------------------------------------------\n`;
threadText += `これまで解説した OSS の技術スタック・スター数の一覧（検索・絞り込み対応、無料）：\n`;
threadText += `👉 https://ssk0224.github.io/auto-tech-radar/cheatsheet/\n\n`;
threadText += `毎朝、海外の急上昇OSSを日本語で解説しています（AI が下書き）。\n`;
threadText += `最新トレンドを見逃さないよう @AutoTechRadar をフォロー＆RTお願いします！\n`;
threadText += `#AutoTechRadar #OSS #AI #エンジニア #プログラミング\n`;

fs.writeFileSync(outputFile, threadText, 'utf8');

// 第1ツイート用Intent URL（アルゴリズム激減を防ぐため外部URLを完全排除し、保存・インプを極大化）
const firstTweet = `今週取り上げた GitHub 急上昇OSS ${topPosts.length}選（${dateLabel}）

注目: ${featuredNames} 等
技術構成と使いどころを日本語で解説。
各OSSの解説と比較チートシートはリプ欄👇（保存推奨 📌）
#AutoTechRadar #OSS`;
const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(firstTweet)}`;

console.log('===============================================================================');
console.log(`⚡ 【X集客ブースト】週間まとめスレッドテキストを発行しました！（${dateLabel} ${timeStr}版）`);
console.log(`📄 保存先: ${outputFile}`);
console.log('===============================================================================\n');

// メモ帳（テキストファイル）と ブラウザ（X投稿画面）を対話型GUIで確実に起動
exec(`start "" "${outputFile}"`);
exec(`rundll32 url.dll,FileProtocolHandler "${tweetUrl}"`, (err) => {
  if (err) {
    exec(`start "" "${tweetUrl}"`);
  }
});
