import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { parseDraftToNotePayload } from './utils/note_html.mjs';
import { assembleNote, loadPrivateKeys, noteDir } from './utils/note_vault.mjs';
import { isNoise } from './utils/noise_filter.mjs';

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

if (process.argv[1] && process.argv[1].endsWith('note_api_server.mjs')) {
  const tasksData = buildFullSyncTasks();
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
