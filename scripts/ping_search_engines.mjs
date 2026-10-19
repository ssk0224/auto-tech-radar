import fs from 'fs';
import path from 'path';

// 現代最新: 世界標準 IndexNow プロトコル ＆ サイトマップ Ping による検索エンジン即時インデックス連携
async function notifySearchEngines() {
  console.log('=== 🌐 Search Engine Notification (IndexNow + Sitemap Ping) ===');
  const radarDir = path.resolve('src/pages/radar');
  if (!fs.existsSync(radarDir)) return;

  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  const urlList = files.map(f => `https://ssk0224.github.io/auto-tech-radar/radar/${f.replace('.md', '')}/`);
  urlList.push('https://ssk0224.github.io/auto-tech-radar/');
  urlList.push('https://ssk0224.github.io/auto-tech-radar/cheatsheet/');

  const key = "3f9a7b21e84c40d99a5e2f7b8c1d3e5a";
  const payload = {
    host: "ssk0224.github.io",
    key: key,
    keyLocation: `https://ssk0224.github.io/auto-tech-radar/${key}.txt`,
    urlList: urlList.slice(0, 100)
  };

  // 1. IndexNow API
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    console.log(`✓ IndexNow API 送信結果: HTTP ${res.status} (${payload.urlList.length} 件のURLを通知)`);
  } catch (err) {
    console.warn(`- IndexNow 通知スキップ: ${err.message}`);
  }

  // 2. Bing & Google Sitemap Ping
  const sitemapUrl = "https://ssk0224.github.io/auto-tech-radar/sitemap-index.xml";
  const pings = [
    { name: "Bing", url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}` }
  ];

  for (const p of pings) {
    try {
      const res = await fetch(p.url, { signal: AbortSignal.timeout(5000) });
      console.log(`✓ ${p.name} Sitemap Ping 送信完了: HTTP ${res.status}`);
    } catch (e) {
      console.warn(`- ${p.name} Sitemap Ping スキップ: ${e.message}`);
    }
  }
}

notifySearchEngines();
