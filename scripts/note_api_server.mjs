import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { parseDraftToNotePayload } from './utils/note_html.mjs';
import { assembleNote, noteDir } from './utils/note_vault.mjs';
import { assertOwnerChecksGreen, privateKeysIfPresent } from './utils/owner_checks.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { isNoteWithdrawn } from './utils/blocklist.mjs';
import { eyecatchPng, EYECATCH_WIDTH, EYECATCH_HEIGHT } from './utils/eyecatch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PORT = 18921;

// 新規出品する原稿のスラグ。URL のある記事（出品済み）と、note から取り下げた記事（blocklist.mjs）は除く
export function slugsToCreate(files, noteUrls) {
  return files
    .filter((f) => f.endsWith('_note.md'))
    .map((f) => f.replace('_note.md', ''))
    .filter((slug) => slug !== 'LEAD_MAGNET_CHEAT_SHEET' && !isNoise(slug) && !isNoteWithdrawn(slug) && !noteUrls[slug]?.url);
}

// 公開中の note の本文を書き換える・新しく作るので、出品と同じ有料本文の検査が green（秘密鍵があり全原稿が合格）でなければ止める
export function buildFullSyncTasks({ dir = noteDir, keys = privateKeysIfPresent() } = {}) {
  assertOwnerChecksGreen({ dir, keys });
  const noteUrlsPath = path.join(REPO, 'scripts/note_urls.json');
  const noteUrls = fs.existsSync(noteUrlsPath) ? JSON.parse(fs.readFileSync(noteUrlsPath, 'utf8')) : {};

  const updates = [];
  // 1. LEAD_MAGNET_CHEAT_SHEET
  const leadPath = path.join(dir, 'LEAD_MAGNET_CHEAT_SHEET.md');
  const leadKey = noteUrls.LEAD_MAGNET_CHEAT_SHEET?.url?.match(/\/n\/(n[a-z0-9]+)/i)?.[1];
  if (leadKey && fs.existsSync(leadPath)) {
    const p = parseDraftToNotePayload(fs.readFileSync(leadPath, 'utf8'), false);
    updates.push({ slug: 'LEAD_MAGNET_CHEAT_SHEET', key: leadKey, ...p });
  }

  // 2. Existing paid articles
  for (const [slug, info] of Object.entries(noteUrls)) {
    if (slug === 'LEAD_MAGNET_CHEAT_SHEET' || isNoise(slug)) continue;
    const k = info.url?.match(/\/n\/(n[a-z0-9]+)/i)?.[1];
    if (!k) continue;
    const noteFile = path.join(dir, `${slug}_note.md`);
    if (!fs.existsSync(noteFile)) continue;
    const fullMd = assembleNote(noteFile, keys);
    const payload = parseDraftToNotePayload(fullMd, true);
    if (!payload.freeBody || !payload.payBody || !payload.separator) {
      throw new Error(`Split failed for: ${slug}`);
    }
    updates.push({ slug, key: k, ...payload });
  }

  // 3. New articles to create dynamically
  const creates = [];
  for (const slug of slugsToCreate(fs.readdirSync(dir), noteUrls)) {
    const noteFile = path.join(dir, `${slug}_note.md`);
    const fullMd = assembleNote(noteFile, keys);
    const payload = parseDraftToNotePayload(fullMd, true);
    if (!payload.freeBody || !payload.payBody || !payload.separator) {
      throw new Error(`Split failed for create: ${slug}`);
    }
    creates.push({ slug, ...payload });
  }

  return { updates, creates, unpublishKeys: [] };
}

// 見出し画像の設定対象: note に公開済みで URL が分かっている記事（ノイズ記事は除く）
export function buildEyecatchTasks(noteUrls) {
  return Object.entries(noteUrls)
    .filter(([slug]) => !isNoise(slug))
    .map(([slug, info]) => ({ slug, key: info.url?.match(/\/n\/(n[a-z0-9]+)/i)?.[1] }))
    .filter((t) => t.key)
    .map((t) => ({ ...t, width: EYECATCH_WIDTH, height: EYECATCH_HEIGHT }));
}

// ブリッジに来てよいリクエストか。Origin が無い（curl 等の同じ PC 上のプロセス）か note.com のページだけを許可し、
// Host はループバックのみ（DNS リバインディング対策）
export const ALLOWED_ORIGINS = new Set(['https://note.com', 'https://editor.note.com']);
export function isAllowedRequest(headers) {
  const host = String(headers.host || '');
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return false;
  return !headers.origin || ALLOWED_ORIGINS.has(headers.origin);
}

// ブラウザから届く見出し画像の結果 { set: [], skipped: [], failed: [] } を表示用の行にする。
// 読めない・形が違う結果は「完了」にしない（以前は読めない結果を黙って捨て、ok を返していた）
export function eyecatchCompleteReport(body) {
  let r;
  try {
    r = JSON.parse(body);
  } catch (e) {
    return { ok: false, readable: false, lines: [`\n🖼 見出し画像: ✕ 結果を読めませんでした（${e.message}）。設定できたかは note で確かめてください`] };
  }
  if (!r || !['set', 'skipped', 'failed'].every((k) => Array.isArray(r[k]))) {
    return { ok: false, readable: false, lines: ['\n🖼 見出し画像: ✕ 結果の形が想定と違います（set / skipped / failed の一覧が無い）。設定できたかは note で確かめてください'] };
  }
  const lines = [`\n🖼 見出し画像: 設定 ${r.set.length} / 変更なし ${r.skipped.length} / 失敗 ${r.failed.length}`, ...r.failed.map((f) => `  ✕ ${f}`)];
  return { ok: r.failed.length === 0, readable: true, lines };
}

if (process.argv[1] && process.argv[1].endsWith('note_api_server.mjs')) {
  // --eyecatch-only: 見出し画像の設定だけ行う（秘密鍵は不要）
  const eyecatchOnly = process.argv.includes('--eyecatch-only');
  const tasksData = eyecatchOnly ? { updates: [], creates: [], unpublishKeys: [] } : buildFullSyncTasks();
  const noteUrlsPath = path.join(REPO, 'scripts/note_urls.json');
  const eyecatchTasks = buildEyecatchTasks(fs.existsSync(noteUrlsPath) ? JSON.parse(fs.readFileSync(noteUrlsPath, 'utf8')) : {});
  console.log(`✓ 見出し画像の対象: ${eyecatchTasks.length} 本（ブラウザで scripts/browser/note_eyecatch.js を実行）`);
  console.log(
    `✓ 全自動同期タスク準備完了: 更新=${tasksData.updates.length}件 (無料チートシート含む), 新規出品=${tasksData.creates.length}件`,
  );

  const server = http.createServer((req, res) => {
    // 復号した有料本文を配るため、note.com のページ以外からは読ませない。
    // 他サイトのページからの fetch（Origin 付き）と、DNS リバインディング（Host 偽装）を拒否する
    if (!isAllowedRequest(req.headers)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/tasks' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(tasksData));
      return;
    }

    if (req.url === '/eyecatch-tasks' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(eyecatchTasks));
      return;
    }

    if (req.url === '/eyecatch.js' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      res.end(fs.readFileSync(path.join(__dirname, 'browser', 'note_eyecatch.js'), 'utf8'));
      return;
    }

    const img = req.method === 'GET' && req.url.match(/^\/eyecatch\/([A-Za-z0-9_.-]+)\.png$/);
    if (img) {
      const slug = decodeURIComponent(img[1]);
      if (!eyecatchTasks.some((t) => t.slug === slug)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      eyecatchPng(slug, REPO).then(
        (buf) => {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          res.end(buf);
        },
        (e) => {
          res.writeHead(500);
          res.end(e.message);
        },
      );
      return;
    }

    if (req.url === '/eyecatch-complete' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const r = eyecatchCompleteReport(body);
        for (const l of r.lines) console.log(l);
        // 結果を読めない・失敗がある回は終了コード 1（呼び出し側が「完了」と扱わないように）
        if (!r.ok) process.exitCode = 1;
        res.writeHead(r.readable ? 200 : 400);
        res.end(r.readable ? 'ok' : 'unreadable');
        if (eyecatchOnly) setTimeout(() => process.exit(), 500);
      });
      return;
    }

    if (req.url === '/log' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          console.log(`[Browser] ${msg.text}`);
        } catch (e) {
          // ログが読めなくても処理は続けるが、読めなかったことは表に出す
          console.log(`[Browser] ✕ ログを読めませんでした（${body.length} 文字、${e.message}）`);
        }
        res.writeHead(200);
        res.end('ok');
      });
      return;
    }

    if (req.url === '/complete' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        console.log('\n🎉 ブラウザ側の全記事API処理が完了しました！');
        res.writeHead(200);
        res.end('ok');
        setTimeout(() => process.exit(0), 500);
      });
      return;
    }

    res.writeHead(404);
    res.end('not found');
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 ローカルAPIブリッジ待機中: http://127.0.0.1:${PORT}/tasks`);
  });
}
