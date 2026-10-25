import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { isNoise } from './utils/noise_filter.mjs';
import { jstDaysAgo } from '../src/utils/dates.js';

// IndexNow で検索エンジン（Bing など IndexNow 参加エンジン）に新規・更新ページを通知する。
// Bing のサイトマップ ping（bing.com/ping）は廃止済みのため使わない。
// 通知するのは直近に公開した記事だけ（noindex のノイズ記事は送らない）
const SITE = 'https://ssk0224.github.io/auto-tech-radar';
const KEY = '3f9a7b21e84c40d99a5e2f7b8c1d3e5a';
const RECENT_DAYS = 2;

export function recentArticleUrls(radarDir, now = Date.now(), days = RECENT_DAYS) {
  // 記事の pubDate は日本時間の暦日。直近 days 日（日本時間・今日を含む）だけを送る（UTC の日付と比べると 3〜4 日分になっていた）
  const since = jstDaysAgo(days - 1, now);
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
  await notifyIndexNow([...articles, `${SITE}/`, `${SITE}/cheatsheet/`]);
}

// IndexNow に通知する。受理（200 / 202）だけが ok。拒否（403 鍵不一致・422 URL 不正・429 など）は bad、通信の失敗は unknown で、
// どちらも ::warning で残す（以前は通信の失敗を console.warn だけにしていて、Actions の注釈に出なかった）。公開は止めない
export async function notifyIndexNow(urlList, { fetchImpl = globalThis.fetch, log = console.log } = {}) {
  const payload = { host: 'ssk0224.github.io', key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList };
  let res;
  try {
    res = await fetchImpl('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    log(`::warning title=IndexNow::通知できませんでした（${err.message}）。検索エンジンへの通知は届いていません`);
    return { status: 'unknown' };
  }
  if (res.status === 200 || res.status === 202) {
    log(`✓ IndexNow 受理: HTTP ${res.status} (${urlList.length} 件)`);
    return { status: 'ok' };
  }
  const body = await res.text().catch((e) => `（応答の本文を読めません: ${e.message}）`);
  log(`::warning title=IndexNow::HTTP ${res.status} ${body.slice(0, 300)}`);
  return { status: 'bad' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  notifySearchEngines();
}
