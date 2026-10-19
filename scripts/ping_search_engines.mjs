import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isNoise } from './utils/noise_filter.mjs';

// IndexNow で検索エンジン（Bing など IndexNow 参加エンジン）に新規・更新ページを通知する。
// Bing のサイトマップ ping（bing.com/ping）は廃止済みのため使わない。
// 通知するのは直近に公開した記事だけ（noindex のノイズ記事は送らない）
const SITE = 'https://ssk0224.github.io/auto-tech-radar';
const KEY = '3f9a7b21e84c40d99a5e2f7b8c1d3e5a';
const RECENT_DAYS = 2;

export function recentArticleUrls(radarDir, now = new Date(), days = RECENT_DAYS) {
  const since = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
  return fs.readdirSync(radarDir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const slug = f.replace(/\.md$/, '');
      const m = fs.readFileSync(path.join(radarDir, f), 'utf8').match(/^pubDate:\s*"?([0-9]{4}-[0-9]{2}-[0-9]{2})"?/m);
      return { slug, pubDate: m ? m[1] : '' };
    })
    .filter(a => a.pubDate >= since && !isNoise(a.slug))
    .map(a => `${SITE}/radar/${a.slug}/`);
}

async function notifySearchEngines() {
  console.log('=== 🌐 Search Engine Notification (IndexNow) ===');
  const radarDir = path.resolve('src/pages/radar');
  if (!fs.existsSync(radarDir)) return;

  const articles = recentArticleUrls(radarDir);
  if (articles.length === 0) {
    console.log('ℹ️ 直近に公開した記事が無いため、通知をスキップしました');
    return;
  }
  const urlList = [...articles, `${SITE}/`, `${SITE}/cheatsheet/`];
  const payload = {
    host: 'ssk0224.github.io',
    key: KEY,
    keyLocation: `${SITE}/${KEY}.txt`,
    urlList,
  };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    // 200 / 202 が受理。それ以外（403 鍵不一致、422 URL 不正、429 など）は警告として残す
    if (res.status === 200 || res.status === 202) {
      console.log(`✓ IndexNow 受理: HTTP ${res.status} (${urlList.length} 件)`);
    } else {
      console.log(`::warning title=IndexNow::HTTP ${res.status} ${await res.text().catch(() => '')}`);
    }
  } catch (err) {
    console.warn(`- IndexNow 通知スキップ: ${err.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  notifySearchEngines();
}
