// note に公開済みの記事 URL を取得し、記事（slug）ごとの購入リンクを scripts/note_urls.json に保存する。
// Web 記事の「noteで購入」ボタンを、プロフィールではなくその記事の有料版へ直接つなぐためのもの。
// note の公開 API（ログイン不要の読み取り）を使う。取得に失敗したら既存の対応表を一切変更しない
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { siteConfig } from '../src/config/site.js';
import { isNoise } from './utils/noise_filter.mjs';

const NOTE_URLNAME = new URL(siteConfig.noteProfileUrl).pathname.replace(/\//g, '');
const OUT_FILE = path.resolve('scripts/note_urls.json');
const NOTE_DIR = path.resolve('note_drafts');

// 記号・空白・全角半角の違いを無視して比べる
export function normalizeTitle(s) {
  return (s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

// 原稿タイトルからプロジェクト名を取り出す（「ZCode」・【…】ZCodeとは？ の形式）
export function projectNameOf(title) {
  const m = title.match(/「([^」]{3,})」/) || title.match(/】\s*(.{3,}?)とは/);
  return m ? m[1].trim() : '';
}

// note の記事一覧と原稿（slug, title）を対応づける。タイトル完全一致を優先し、
// 無ければプロジェクト名を含む記事が 1 本だけのときに限って採用する（誤ったリンクより、リンク無しを選ぶ）
export function matchNotesToSlugs(notes, drafts) {
  const out = {};
  for (const d of drafts) {
    const t = normalizeTitle(d.title);
    const p = normalizeTitle(projectNameOf(d.title));
    let hit = notes.filter((n) => normalizeTitle(n.name) === t);
    // 次にプロジェクト名の完全一致（「laya」と「laya-mlx」を取り違えない）、最後に部分一致
    if (hit.length !== 1 && p.length >= 3) hit = notes.filter((n) => normalizeTitle(projectNameOf(n.name)) === p);
    if (hit.length !== 1 && p.length >= 3) hit = notes.filter((n) => normalizeTitle(n.name).includes(p));
    if (hit.length === 1) out[d.slug] = { url: hit[0].noteUrl, price: hit[0].price ?? null, title: hit[0].name };
  }
  return out;
}

export function readDrafts(dir = NOTE_DIR) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('_note.md') && !isNoise(f.replace(/_note\.md$/, '')))
    .map((f) => ({
      slug: f.replace(/_note\.md$/, ''),
      title: (fs.readFileSync(path.join(dir, f), 'utf8').match(/^#\s+(.+)$/m) || [, ''])[1].trim(),
    }));
}

async function fetchAllNotes() {
  const notes = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`https://note.com/api/v2/creators/${NOTE_URLNAME}/contents?kind=note&page=${page}`, {
      headers: { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json())?.data;
    if (!Array.isArray(data?.contents)) throw new Error('想定外の応答形式（data.contents が無い）');
    for (const n of data.contents) {
      if (typeof n.name !== 'string' || typeof n.noteUrl !== 'string' || !n.noteUrl.startsWith('https://note.com/')) {
        throw new Error('想定外の応答形式（name / noteUrl）');
      }
      notes.push({ name: n.name, noteUrl: n.noteUrl, price: typeof n.price === 'number' ? n.price : null });
    }
    if (data.isLastPage !== false) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return notes;
}

async function main() {
  let notes;
  try {
    notes = await fetchAllNotes();
  } catch (e) {
    console.log(`::warning title=note URL sync::note の記事一覧を取得できませんでした（${e.message}）。購入リンクは前回の対応表のままです`);
    return;
  }
  const mapped = matchNotesToSlugs(notes, readDrafts());
  // 既存の対応は残し、今回見つかったものだけ上書きする（note 側の一時的な欠落でリンクを消さない）
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  } catch (e) {}
  const merged = { ...prev, ...mapped };
  fs.writeFileSync(OUT_FILE, JSON.stringify(Object.fromEntries(Object.entries(merged).sort()), null, 2) + '\n', 'utf8');
  console.log(`✓ note の記事 ${notes.length} 本中 ${Object.keys(mapped).length} 本を原稿と対応づけました（対応表 ${Object.keys(merged).length} 本）`);
  // 対応づけられなかったもの（公開情報のタイトルのみ）を記録し、取り違えや未対応を確認できるようにする
  const linked = new Set(Object.values(mapped).map((v) => v.url));
  for (const n of notes.filter((n) => !linked.has(n.noteUrl))) console.log(`  - 未対応の note: ${n.name}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
