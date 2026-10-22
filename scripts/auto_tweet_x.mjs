import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { isNoise } from './utils/noise_filter.mjs';
import { jstDate } from '../src/utils/dates.js';
import { sanitizeAndAttachUrlToTweet, extractTweet1 } from './utils/twitter_formatter.mjs';

// X API の応答をどう扱うか。
// - 429（レート制限）と 5xx: 次回に再試行（記録しない）
// - 401 と、重複投稿以外の 403: 認証・アプリ権限の問題で記事のせいではない。記録せずに実行を失敗させて気づけるようにする
//   （記録すると、鍵を直した後もその記事が二度と投稿されない）
// - それ以外の 4xx（重複投稿・文字数超過など記事ごとの問題）: 失敗として記録して次の記事へ進む
export function classifyXResponse(status, body = '') {
  if (status >= 200 && status < 300) return 'posted';
  if (status === 429 || status >= 500) return 'retry';
  if (status === 401 || (status === 403 && !/duplicate/i.test(body))) return 'auth';
  return 'failed';
}

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

  // 新しい記事から投稿する。CI ではチェックアウト時に全ファイルの mtime が揃うため、記事の pubDate で並べる
  const radarDir = path.resolve('src/pages/radar');
  const pubDateOf = (slug) => {
    try {
      const m = fs.readFileSync(path.join(radarDir, `${slug}.md`), 'utf8').match(/^pubDate:\s*"?([0-9-]+)"?/m);
      return m ? m[1] : '';
    } catch (e) {
      return '';
    }
  };
  const files = fs.readdirSync(xDir)
    .filter(f => f.endsWith('_x.txt'))
    .map(f => ({ name: f, slug: f.replace(/_x\.txt$/, '') }))
    .filter(f => !isNoise(f.slug) && fs.existsSync(path.join(radarDir, `${f.slug}.md`)))
    .map(f => ({ ...f, pubDate: pubDateOf(f.slug) }))
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate) || a.slug.localeCompare(b.slug));

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

  const rawTweet = extractTweet1(text, slug);
  const safeData = sanitizeAndAttachUrlToTweet(rawTweet, slug);
  const tweetText = safeData.tweet;

  const recordHistory = (entry, label) => {
    history[slug] = { ...(history[slug] || {}), ...entry };
    try {
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
      console.log(`✓ publish_history.json を更新しました: ${slug} (${label})`);
    } catch (saveErr) {
      console.warn('⚠️ publish_history.json の保存に失敗しました:', saveErr.message);
    }
  };
  const today = jstDate(); // 記録する日付は日本時間（publish_history の他の日付と同じ）

  if (!safeData.isSafe) {
    console.warn(`- X投稿スキップ: 文字数の上限を超えています (weight ${safeData.weight}/280): ${slug}`);
    recordHistory({ x: 'failed', xAt: today, xError: `weight ${safeData.weight}` }, 'x: failed');
    return;
  }

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
    const err = res.ok ? '' : await res.text();
    const outcome = classifyXResponse(res.status, err);
    if (outcome === 'posted') {
      console.log(`✓ X (Twitter) への最新レポート自動投稿に成功しました: ${slug}`);
      recordHistory({ x: true, xAt: today }, 'x: true');
    } else if (outcome === 'auth') {
      console.log(`::error title=X 認証エラー::X API が ${res.status} を返しました（APIキー・アクセストークン・アプリの書き込み権限を確認してください）。記事の投稿状態は変更していません: ${err.slice(0, 300)}`);
      process.exitCode = 1;
    } else {
      console.warn(`- X投稿スキップ (${res.status}): ${err}`);
      if (outcome === 'failed') {
        recordHistory({ x: 'failed', xAt: today, xError: `HTTP ${res.status}` }, 'x: failed');
      }
    }
  } catch (err) {
    console.warn(`- X投稿例外スキップ: ${err.message}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  postLatestTweet();
}
