import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// X (Twitter) API v2 自動投稿エンジン (OAuth 1.0a HMAC-SHA1)
// シークレット未設定時は安全にスキップし、パイプラインを絶対に落とさない設計
async function postLatestTweet() {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_TOKEN_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log('ℹ️ X APIキーが未設定のため、X自動投稿をスキップしました (手動ランチャーで投稿可能)');
    return;
  }

  const xDir = path.resolve('x_posts');
  if (!fs.existsSync(xDir)) return;

  // 履歴ファイル（重複投稿の完全抑止用）の読み込み
  const historyFile = path.resolve('scripts/publish_history.json');
  let history = {};
  if (fs.existsSync(historyFile)) {
    try {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (e) {
      console.warn('⚠️ publish_history.json のパースに失敗しました:', e.message);
    }
  }

  const files = fs.readdirSync(xDir)
    .filter(f => f.endsWith('_x.txt'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(xDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return;

  // まだXに投稿されていない最新原稿を抽出
  const unpostedFiles = files.filter(f => {
    const slug = f.name.replace(/_x\.txt$/, '');
    return !history[slug]?.x;
  });

  if (unpostedFiles.length === 0) {
    console.log('✓ 最新の全記事はすでにX投稿済みです。重複投稿を安全にスキップしました。');
    return;
  }

  const targetFileObj = unpostedFiles[0];
  const slug = targetFileObj.name.replace(/_x\.txt$/, '');
  const latestFile = path.join(xDir, targetFileObj.name);
  const text = fs.readFileSync(latestFile, 'utf8');

  const t1Match = text.match(/【ツイート 1】\r?\n([\s\S]*?)(?=\r?\n\r?\n👉 ワンクリック|$)/);
  const tweetText = t1Match ? t1Match[1].trim() : text.slice(0, 130);

  console.log(`🚀 Xへ自動投稿を試行中: ${targetFileObj.name} (slug: ${slug})...`);

  // OAuth 1.0a 署名生成
  const method = 'POST';
  const url = 'https://api.twitter.com/2/tweets';
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0'
  };

  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');

  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(apiSecret)}&${encodeURIComponent(accessSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  oauthParams['oauth_signature'] = signature;
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: tweetText }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      console.log(`✓ X (Twitter) への最新レポート自動投稿に成功しました: ${slug}`);

      // 履歴ファイルに投稿済みフラグを安全に記録
      const today = new Date().toISOString().split('T')[0];
      history[slug] = {
        ...(history[slug] || {}),
        x: true,
        xAt: today,
      };
      try {
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
        console.log(`✓ publish_history.json を更新しました: ${slug} (x: true)`);
      } catch (saveErr) {
        console.warn('⚠️ publish_history.json の保存に失敗しました:', saveErr.message);
      }
    } else {
      const err = await res.text();
      console.warn(`- X投稿スキップ (${res.status}): ${err}`);
    }
  } catch (err) {
    console.warn(`- X投稿例外スキップ: ${err.message}`);
  }
}

postLatestTweet();
