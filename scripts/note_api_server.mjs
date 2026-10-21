import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { parseDraftToNotePayload } from './utils/note_html.mjs';
import { assembleNote, loadPrivateKeys, noteDir } from './utils/note_vault.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { eyecatchPng, EYECATCH_WIDTH, EYECATCH_HEIGHT } from './utils/eyecatch.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const PORT = 18921;

export function buildFullSyncTasks() {
  const keys = loadPrivateKeys();
  const noteUrlsPath = path.join(REPO, 'scripts/note_urls.json');
  const noteUrls = fs.existsSync(noteUrlsPath) ? JSON.parse(fs.readFileSync(noteUrlsPath, 'utf8')) : {};

  const updates = [];
  // 1. LEAD_MAGNET_CHEAT_SHEET
  const leadPath = path.join(noteDir, 'LEAD_MAGNET_CHEAT_SHEET.md');
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
    const noteFile = path.join(noteDir, `${slug}_note.md`);
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
  const allDrafts = fs.readdirSync(noteDir).filter((f) => f.endsWith('_note.md'));
  for (const f of allDrafts) {
    const slug = f.replace('_note.md', '');
    if (slug === 'LEAD_MAGNET_CHEAT_SHEET' || isNoise(slug)) continue;
    if (noteUrls[slug]?.url) continue; // Already mapped
    const noteFile = path.join(noteDir, f);
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

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
        try {
          const r = JSON.parse(body);
          console.log(`\n🖼 見出し画像: 設定 ${r.set.length} / 変更なし ${r.skipped.length} / 失敗 ${r.failed.length}`);
          r.failed.forEach((f) => console.log(`  ✕ ${f}`));
        } catch {}
        res.writeHead(200);
        res.end('ok');
        if (eyecatchOnly) setTimeout(() => process.exit(0), 500);
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
        } catch {}
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
