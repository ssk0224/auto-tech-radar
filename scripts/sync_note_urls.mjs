// note に公開済みの記事 URL を取得し、記事（slug）ごとの購入リンクを scripts/note_urls.json に保存する。
// Web 記事の「noteで購入」ボタンを、プロフィールではなくその記事の有料版へ直接つなぐためのもの。
// note の公開 API（ログイン不要の読み取り）を使う。取得に失敗したら既存の対応表を一切変更しない
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { siteConfig } from '../src/config/site.js';
import { isNoise } from './utils/noise_filter.mjs';
import { findForbiddenClaims } from './utils/claims_check.mjs';

const NOTE_URLNAME = new URL(siteConfig.noteProfileUrl).pathname.replace(/\//g, '');
const OUT_FILE = path.resolve('scripts/note_urls.json');
const STATUS_FILE = path.resolve('scripts/note_status.json');
const NOTE_DIR = path.resolve('note_drafts');

// 記号・空白・全角半角の違いを無視して比べる
export function normalizeTitle(s) {
  return (s || '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

// 原稿タイトルからプロジェクト名を取り出す（「ZCode」・【…】ZCodeとは？・ZCode: 概要と革新性 の形式）
export function projectNameOf(title) {
  const m = title.match(/「([^」]{3,})」/) || title.match(/】\s*(.{3,}?)とは/) || title.match(/^#?\s*([a-z0-9_.-]{3,}):\s*概要/i);
  return m ? m[1].trim() : '';
}

// note の記事一覧と原稿（slug, title）を対応づける。タイトル完全一致を優先し、
// 無ければプロジェクト名を含む記事が 1 本だけのときに限って採用する（誤ったリンクより、リンク無しを選ぶ）
// 同じタイトルの記事が複数ある（重複出品）ときは、いちばん古いものを代表にしてリンクし、残りを duplicates に記録する
export function matchNotesToSlugs(notes, drafts) {
  const groups = new Map();
  notes.forEach((n, i) => {
    const k = normalizeTitle(n.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ ...n, order: i });
  });
  // API は新しい順に返すので、publishAt が無いときは後ろにあるものほど古い
  const oldestFirst = (a, b) => (a.publishAt && b.publishAt ? a.publishAt.localeCompare(b.publishAt) : b.order - a.order);
  const reps = [...groups.values()].map((g) => ({ ...[...g].sort(oldestFirst)[0], all: [...g].sort(oldestFirst).map((n) => n.noteUrl) }));
  notes = reps;
  const out = {};
  for (const d of drafts) {
    const t = normalizeTitle(d.title);
    const p = normalizeTitle(projectNameOf(d.title));
    let hit = notes.filter((n) => normalizeTitle(n.name) === t);
    // 次にプロジェクト名の完全一致。部分一致は使わない（未出品の「laya」が「laya-mlx」の記事に、「ray」が「array-utils」にリンクされる）
    if (hit.length !== 1 && p.length >= 3) hit = notes.filter((n) => normalizeTitle(projectNameOf(n.name)) === p);
    // タイトルを付け替えた記事は、別名（タイトルに必ず含まれる語）で探す
    if (hit.length !== 1 && d.alias) hit = notes.filter((n) => normalizeTitle(n.name).includes(normalizeTitle(d.alias)));
    if (hit.length === 1) {
      const cleanTitle = (hit[0].name || '').replace(/^#+\s*/, '').trim();
      out[d.slug] = { url: hit[0].noteUrl, price: hit[0].price ?? null, title: cleanTitle };
      if (hit[0].all.length > 1) out[d.slug].duplicates = hit[0].all.slice(1);
    }
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
      notes.push({ name: n.name, noteUrl: n.noteUrl, price: typeof n.price === 'number' ? n.price : null, publishAt: typeof n.publishAt === 'string' ? n.publishAt : '' });
    }
    if (data.isLastPage !== false) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return notes;
}

// 公開中の note 記事そのもの（無料部分の本文・タイトル・見出し画像）を検査する。
// オーナー端末からの一括更新（[N]）や見出し画像の設定（[E]）が実際に反映されたかを、note 側の公開内容で確かめるため
export function publishedNoteIssues(d) {
  const text = `${d.name || ''}\n${String(d.body || '').replace(/<[^>]+>/g, ' ')}`;
  const issues = findForbiddenClaims(text);
  if (/ThoughtWorks/.test(text)) issues.push('第三者（ThoughtWorks）の評価のような表現');
  if (/^\s*#/.test(d.name || '')) issues.push('タイトルが # で始まる');
  return issues;
}

async function fetchNoteDetail(key) {
  const res = await fetch(`https://note.com/api/v3/notes/${key}`, {
    headers: { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json())?.data || {};
}

async function checkPublishedNotes(map) {
  const status = {};
  for (const [slug, v] of Object.entries(map)) {
    const key = v.url.match(/\/n\/(n\w+)/)?.[1];
    if (!key) continue;
    try {
      const d = await fetchNoteDetail(key);
      // 更新日時とタイトルも残す（オーナーの差し替えが note に届いたかを、日時で確かめられるように）
      const tw = String(d.body || '').match(/.{0,20}ThoughtWorks.{0,20}/);
      status[slug] = {
        eyecatch: Boolean(d.eyecatch),
        issues: publishedNoteIssues(d),
        name: d.name || '',
        updatedAt: d.updated_at || d.updatedAt || d.publish_at || d.publishAt || '',
        ...(tw ? { excerpt: tw[0].replace(/<[^>]+>/g, '') } : {}),
      };
    } catch (e) {
      status[slug] = { error: e.message };
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  const noImage = Object.keys(status).filter((s) => status[s].eyecatch === false);
  const withIssues = Object.keys(status).filter((s) => status[s].issues?.length);
  console.log(`✓ 公開中の note を検査: ${Object.keys(status).length} 本（見出し画像なし ${noImage.length} 本 / 問題のある表現 ${withIssues.length} 本）`);
  if (noImage.length) console.log(`::warning title=note の見出し画像::未設定 ${noImage.length} 本: ${noImage.join(', ')}（ランチャー [E] で設定）`);
  for (const s of withIssues) console.log(`::warning title=note の公開内容::${s}: ${status[s].issues.join(' / ')}（ランチャー [N] で原稿の内容に更新）`);
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ checkedAt: new Date().toISOString(), notes: status }, null, 2) + '\n', 'utf8');
}

async function main() {
  let notes;
  try {
    notes = await fetchAllNotes();
  } catch (e) {
    console.log(`::warning title=note URL sync::note の記事一覧を取得できませんでした（${e.message}）。購入リンクは前回の対応表のままです`);
    return;
  }
  const drafts = readDrafts();
  // 無料のリードマグネットも重複出品の検出対象にする（購入リンクには使わない）
  const lead = path.join(NOTE_DIR, 'LEAD_MAGNET_CHEAT_SHEET.md');
  if (fs.existsSync(lead)) {
    const title = (fs.readFileSync(lead, 'utf8').match(/^#\s+(.+)$/m) || [, ''])[1].trim();
    drafts.push({ slug: 'LEAD_MAGNET_CHEAT_SHEET', title, alias: 'オープンソース15選' });
  }
  const mapped = matchNotesToSlugs(notes, drafts);
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  } catch (e) {}
  // note.com から正常に取得できた場合、現在公開中の記事マップを採用する（非公開化された記事が 404 のまま残存するのを防ぐ）
  const finalMap = notes.length > 0 ? mapped : { ...prev, ...mapped };
  fs.writeFileSync(OUT_FILE, JSON.stringify(Object.fromEntries(Object.entries(finalMap).sort()), null, 2) + '\n', 'utf8');
  console.log(`✓ note の記事 ${notes.length} 本中 ${Object.keys(mapped).length} 本を原稿と対応づけました（対応表 ${Object.keys(finalMap).length} 本）`);
  // 対応づけられなかったもの（公開情報のタイトルのみ）を記録し、取り違えや未対応を確認できるようにする
  const linked = new Set(Object.values(mapped).flatMap((v) => [v.url, ...(v.duplicates || [])]));
  for (const [slug, v] of Object.entries(mapped)) {
    if (v.duplicates) console.log(`::warning title=note の重複出品::${slug} が note に ${v.duplicates.length + 1} 本あります。ランチャー [U] で 1 本にしてください`);
  }
  for (const n of notes.filter((n) => !linked.has(n.noteUrl))) console.log(`  - 未対応の note: ${n.name}`);
  await checkPublishedNotes(finalMap);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
