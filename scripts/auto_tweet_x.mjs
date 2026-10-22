import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pathToFileURL } from 'url';
import { isNoise } from './utils/noise_filter.mjs';
import { sanitizeAndAttachUrlToTweet, extractTweet1 } from './utils/twitter_formatter.mjs';
import { annotation, readJsonStrict } from './utils/verdict.mjs';

// X API の応答をどう扱うか。
// - 2xx: 投稿できた
// - 401 と、重複投稿以外の 403: 認証・アプリ権限の問題で記事のせいではない。記録せずに実行を失敗させて気づけるようにする
//   （記録すると、鍵を直した後もその記事が二度と投稿されない）
// - 400・422・重複投稿の 403: 記事ごとの問題（文字数・重複など）。失敗として記録して次の記事へ進む
// - それ以外（429・5xx・402 のクレジット切れ・408・425 など、記事のせいと分からないもの）: 次回に再試行（記録しない）。
//   以前は「その他の 4xx」をすべて failed として記録したため、402 でクレジットが切れた日の記事が二度と投稿されなかった
const ARTICLE_FAULT_STATUSES = new Set([400, 422]);
export function classifyXResponse(status, body = '') {
  if (status >= 200 && status < 300) return 'posted';
  if (status === 401 || (status === 403 && !/duplicate/i.test(body))) return 'auth';
  if (ARTICLE_FAULT_STATUSES.has(status) || (status === 403 && /duplicate/i.test(body))) return 'failed';
  return 'retry';
}

function oauthHeader({ method, url, env }) {
  const oauthParams = {
    oauth_consumer_key: env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: env.X_ACCESS_TOKEN,
    oauth_version: '1.0'
  };
  const paramString = Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`)
    .join('&');
  const baseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(env.X_API_SECRET)}&${encodeURIComponent(env.X_ACCESS_TOKEN_SECRET)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  return 'OAuth ' + Object.keys(oauthParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');
}

// X (Twitter) API v2 自動投稿エンジン (OAuth 1.0a HMAC-SHA1)。パイプライン（サイトの公開）は止めないが、
// 投稿できなかった理由（鍵の未設定・再試行・通信の失敗）は ::warning、履歴が読めない・認証エラーは ::error で必ず知らせる。
// 戻り値 { outcome, exitCode }。root / env / fetchImpl / log はテスト用に差し替えられる
export async function postLatestTweet({ root = process.cwd(), env = process.env, fetchImpl = globalThis.fetch, log = console.log } = {}) {
  if (!env.X_API_KEY || !env.X_API_SECRET || !env.X_ACCESS_TOKEN || !env.X_ACCESS_TOKEN_SECRET) {
    log(annotation('warning', 'X 自動投稿', 'X の API キーが未設定のため、X への自動投稿をしていません（手動ランチャーで投稿できます）'));
    return { outcome: 'skipped', exitCode: 0 };
  }

  const xDir = path.join(root, 'x_posts');
  if (!fs.existsSync(xDir)) return { outcome: 'skipped', exitCode: 0 };

  // 履歴ファイル（重複投稿の完全抑止用）。壊れて読めないときは投稿しない（空として扱うと、投稿済みの記事をもう一度投稿し、
  // 記録するときに他の記事の出品・投稿の記録をすべて消してしまう）
  const historyFile = path.join(root, 'scripts', 'publish_history.json');
  let history;
  try {
    history = readJsonStrict(historyFile, { missing: {} });
  } catch (e) {
    log(annotation('error', 'X 自動投稿', `scripts/publish_history.json を読めないため、投稿も記録もしていません（${e.message}）。ファイルを直してください`));
    return { outcome: 'history-unreadable', exitCode: 1 };
  }

  // 新しい記事から投稿する。CI ではチェックアウト時に全ファイルの mtime が揃うため、記事の pubDate で並べる
  const radarDir = path.join(root, 'src', 'pages', 'radar');
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

  if (files.length === 0) return { outcome: 'nothing', exitCode: 0 };

  // まだXに投稿されていない最新原稿を抽出
  const unpostedFiles = files.filter(f => !history[f.slug]?.x);
  if (unpostedFiles.length === 0) {
    log('✓ 最新の全記事はすでにX投稿済みです。重複投稿を安全にスキップしました。');
    return { outcome: 'nothing', exitCode: 0 };
  }

  const { slug, name } = unpostedFiles[0];
  const text = fs.readFileSync(path.join(xDir, name), 'utf8');
  const safeData = sanitizeAndAttachUrlToTweet(extractTweet1(text, slug), slug);

  const recordHistory = (entry, label) => {
    history[slug] = { ...(history[slug] || {}), ...entry };
    try {
      fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
      log(`✓ publish_history.json を更新しました: ${slug} (${label})`);
    } catch (saveErr) {
      log(annotation('warning', 'X 自動投稿', `publish_history.json を保存できませんでした: ${saveErr.message}`));
    }
  };
  const today = new Date().toISOString().split('T')[0];

  if (!safeData.isSafe) {
    log(annotation('warning', 'X 自動投稿', `文字数の上限を超えているため投稿しません (weight ${safeData.weight}/280): ${slug}`));
    recordHistory({ x: 'failed', xAt: today, xError: `weight ${safeData.weight}` }, 'x: failed');
    return { outcome: 'failed', exitCode: 0 };
  }

  log(`🚀 Xへ自動投稿を試行中: ${name} (slug: ${slug})...`);
  const url = 'https://api.twitter.com/2/tweets';
  let res;
  let err = '';
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: oauthHeader({ method: 'POST', url, env }), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: safeData.tweet }),
      signal: AbortSignal.timeout(15000),
    });
    err = res.ok ? '' : await res.text();
  } catch (e) {
    log(annotation('warning', 'X 自動投稿', `X への通信に失敗しました（${e.message}）。記録はせず、次回に再試行します: ${slug}`));
    return { outcome: 'retry', exitCode: 0 };
  }
  const outcome = classifyXResponse(res.status, err);
  if (outcome === 'posted') {
    log(`✓ X (Twitter) への最新レポート自動投稿に成功しました: ${slug}`);
    recordHistory({ x: true, xAt: today }, 'x: true');
    return { outcome, exitCode: 0 };
  }
  if (outcome === 'auth') {
    log(annotation('error', 'X 認証エラー', `X API が ${res.status} を返しました（APIキー・アクセストークン・アプリの書き込み権限を確認してください）。記事の投稿状態は変更していません: ${err.slice(0, 300)}`));
    return { outcome, exitCode: 1 };
  }
  if (outcome === 'failed') {
    log(annotation('warning', 'X 自動投稿', `記事の内容の問題で投稿できませんでした (HTTP ${res.status})。failed として記録し、次の記事に進みます: ${slug}: ${err.slice(0, 300)}`));
    recordHistory({ x: 'failed', xAt: today, xError: `HTTP ${res.status}` }, 'x: failed');
    return { outcome, exitCode: 0 };
  }
  log(annotation('warning', 'X 自動投稿', `X API が ${res.status} を返しました。記事のせいと分からないため記録せず、次回に再試行します: ${slug}: ${err.slice(0, 300)}`));
  return { outcome, exitCode: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  postLatestTweet().then((r) => {
    if (r.exitCode) process.exitCode = r.exitCode;
  });
}
