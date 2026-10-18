import fs from 'fs';
import path from 'path';

// 現代最新: 世界標準 IndexNow プロトコルによる検索エンジン即時インデックス連携
async function notifyIndexNow() {
  console.log('=== 🌐 IndexNow API 検索エンジン即時クロール通知 ===');
  const radarDir = path.resolve('src/pages/radar');
  if (!fs.existsSync(radarDir)) return;

  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  const urlList = files.map(f => `https://ssk0224.github.io/auto-tech-radar/radar/${f.replace('.md', '')}/`);
  urlList.push('https://ssk0224.github.io/auto-tech-radar/');
  urlList.push('https://ssk0224.github.io/auto-tech-radar/cheatsheet/');

  const payload = {
    host: "ssk0224.github.io",
    key: "auto-tech-radar-indexnow-2026-key",
    keyLocation: "https://ssk0224.github.io/auto-tech-radar/indexnow-key.txt",
    urlList: urlList.slice(0, 50)
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    console.log(`✓ IndexNow API 送信完了: HTTP ${res.status} (${payload.urlList.length} 件のURLを通知)`);
  } catch (err) {
    console.warn(`- IndexNow 通知スキップ: ${err.message}`);
  }
}

notifyIndexNow();
