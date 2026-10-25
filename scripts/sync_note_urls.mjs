// note に公開済みの記事 URL を取得し、記事（slug）ごとの購入リンクを scripts/note_urls.json に保存する。
// Web 記事の「noteで購入」ボタンを、プロフィールではなくその記事の有料版へ直接つなぐためのもの。
// note の公開 API（ログイン不要の読み取り）を使う。取得に失敗したら既存の対応表を一切変更しない
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { siteConfig } from '../src/config/site.js';
import { isNoise } from './utils/noise_filter.mjs';
import { findForbiddenClaims } from './utils/claims_check.mjs';
import { splitPaid } from './utils/note_vault.mjs';
import { NOTE_TEXT_RULES, applyNoteRules, noteHtmlText, autoFixableByMaintain } from './utils/note_pending.mjs';
import { noteStatusFile } from './utils/owner_dir.mjs';

const NOTE_URLNAME = new URL(siteConfig.noteProfileUrl).pathname.replace(/\//g, '');
const OUT_FILE = path.resolve('scripts/note_urls.json');
// 公開中の note の検査結果は公開リポに置かない（オーナー端末の ownerDir。CI は ATR_NOTE_STATUS で $RUNNER_TEMP に書き、::error で知らせる）
const STATUS_FILE = noteStatusFile();
// --status-only: 検査結果だけを書き、購入リンクの対応表（scripts/note_urls.json。CI だけが書く）は変えない（オーナー端末のランチャーが使う）
const STATUS_ONLY = process.argv.includes('--status-only');
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

// 記事一覧を読むページ数の上限（ページングが終わらない場合の歯止め）。
// 上限に達しても最後のページに届かなければ、一覧は不完全なので失敗として扱う（以前は 20 ページで黙って打ち切り、
// 不完全な一覧を「公開中の全記事」として対応表を作り直していたため、古い記事の購入リンクが消えるところだった）
export const MAX_NOTE_PAGES = 200;
export async function fetchAllNotes({ fetchImpl = globalThis.fetch, delayMs = 1000, maxPages = MAX_NOTE_PAGES } = {}) {
  const notes = [];
  for (let page = 1; ; page++) {
    if (page > maxPages) throw new Error(`記事一覧が ${maxPages} ページを超えました（一覧が不完全なため対応表を更新しません）`);
    const res = await fetchImpl(`https://note.com/api/v2/creators/${NOTE_URLNAME}/contents?kind=note&page=${page}`, {
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
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return notes;
}

// 公開中の note 記事そのもの（無料部分の本文・タイトル・見出し画像）を検査する。
// オーナー端末からの一括更新（[N]）や見出し画像の設定（[E]）が実際に反映されたかを、note 側の公開内容で確かめるため
export function publishedNoteIssues(d) {
  const text = `${d.name || ''}\n${String(d.body || '').replace(/<[^>]+>/g, ' ')}`;
  const issues = findForbiddenClaims(text);
  // [E] で自動修正する表現（ThoughtWorks・インボイス対応領収書・コピペで本番〜・決まった言い回しの誇張）。
  // 文言は規則の issue と同じにする（ランチャーがこの文言で [E] の対象と見分け、本文の全差し替え [U] に回さない）。
  // 規則を当てても残る書き方は [E] では直せないので、別の文言にして [U] に回す
  const rulesText = `${d.name || ''}\n${noteHtmlText(d.body)}`;
  const fixed = applyNoteRules(rulesText);
  for (const r of NOTE_TEXT_RULES) {
    if (!r.detect.test(rulesText)) continue;
    const issue = r.detect.test(fixed) ? `${r.issue}（[E] では直せない書き方）` : r.issue;
    if (!issues.includes(issue)) issues.push(issue);
  }
  if (/^\s*#/.test(d.name || '')) issues.push('タイトルが # で始まる');
  return issues;
}

// 比較用に、記号・空白・Markdown/HTML の書式を除いた本文にする
const plain = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');

// 公開中の無料部分が、原稿で決めた有料ラインのどこで終わっているか。
// note の API はログインなしだと有料ラインより前（無料部分）だけを返すので、その終わりが原稿の無料部分のどこにあたるかを見る。
// endPct: 原稿の無料部分の何 % の位置で終わっているか（100 前後なら原稿どおり。小さいほど有料ラインが上）。
// pastDraft: 原稿の無料部分の終わりより先まで無料で見えている（有料部分が無料で読める可能性）
export function paidLineReport(body, draftContent) {
  const split = splitPaid(draftContent || '');
  if (!split) return null;
  const free = plain(body);
  const draftFree = plain(split.head.slice(0, -1).join('\n').replace(/^#+\s*/gm, ''));
  const tail = free.slice(-30);
  const at = tail.length >= 10 ? draftFree.indexOf(tail) : -1;
  const draftEnd = draftFree.slice(-30);
  const endIdx = free.indexOf(draftEnd);
  const pastDraft = endIdx !== -1 && free.length - (endIdx + draftEnd.length) > 200;
  return {
    freeChars: free.length,
    draftFreeChars: draftFree.length,
    endPct: at === -1 ? null : Math.round(((at + tail.length) / draftFree.length) * 100),
    pastDraft,
    endsWith: String(body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(-60),
  };
}

// 価格・メンバーシップ・有料設定にかかわる項目だけを残す（note の非公式 API の項目名は変わりうるため、名前で拾う）
function saleFields(d) {
  return Object.fromEntries(Object.entries(d).filter(([k, v]) => /price|limit|member|paid|purchas|can_read|magazine/i.test(k) && (v === null || ['boolean', 'number', 'string'].includes(typeof v))));
}

async function fetchNoteDetail(key) {
  const res = await fetch(`https://note.com/api/v3/notes/${key}`, {
    headers: { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json())?.data || {};
}

async function checkPublishedNotes(map, unlinked = []) {
  const status = {};
  for (const [slug, v] of Object.entries(map)) {
    const key = v.url.match(/\/n\/(n\w+)/)?.[1];
    if (!key) continue;
    try {
      const d = await fetchNoteDetail(key);
      // 更新日時とタイトルも残す（オーナーの差し替えが note に届いたかを、日時で確かめられるように）
      const tw = String(d.body || '').match(/.{0,20}ThoughtWorks.{0,20}/);
      let draft = '';
      try {
        draft = fs.readFileSync(path.join(NOTE_DIR, slug === 'LEAD_MAGNET_CHEAT_SHEET' ? `${slug}.md` : `${slug}_note.md`), 'utf8');
      } catch (e) {}
      const paidLine = paidLineReport(d.body, draft);
      const issues = publishedNoteIssues(d);
      if (paidLine?.pastDraft) issues.push('有料ラインが原稿の位置より下（有料部分が無料で読める可能性）');
      status[slug] = {
        eyecatch: Boolean(d.eyecatch),
        issues,
        ...(paidLine ? { paidLine } : {}),
        sale: saleFields(d),
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
  // CI のログは公開される。どの記事にどの問題が残っているかの一覧は出さず、本数だけを ::error で知らせる（詳細はオーナー端末のランチャーで取り直す）
  if (process.env.GITHUB_ACTIONS === 'true') {
    if (withIssues.length) console.log(`::error title=note の公開内容::直す表現が残っている公開中の note が ${withIssues.length} 本あります（ランチャー [U] / [E] で確認・修正）`);
  } else {
    for (const s of withIssues) console.log(`  ✕ ${s}: ${status[s].issues.join(' / ')}（${autoFixableByMaintain(status[s]) ? 'ランチャー [E] で自動修正' : 'ランチャー [U] で原稿の内容に更新'}）`);
  }
  // 原稿と対応づかない公開中の note（古い版の出品が残っているなど）も記録する。古い表現の検査もする
  const others = [];
  for (const n of unlinked) {
    const key = n.noteUrl.match(/\/n\/(n\w+)/)?.[1];
    let issues = [];
    try {
      if (key) issues = publishedNoteIssues(await fetchNoteDetail(key));
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      issues = [`取得失敗: ${e.message}`];
    }
    others.push({ name: n.name, url: n.noteUrl, price: n.price, publishAt: n.publishAt, issues });
  }
  if (others.length) console.log(`::warning title=原稿と対応づかない公開中の note::${others.length} 本（古い版の出品の可能性。検査結果の unlinked）`);
  fs.mkdirSync(path.dirname(STATUS_FILE), { recursive: true });
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ checkedAt: new Date().toISOString(), notes: status, unlinked: others }, null, 2) + '\n', 'utf8');
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
  if (!STATUS_ONLY) fs.writeFileSync(OUT_FILE, JSON.stringify(Object.fromEntries(Object.entries(finalMap).sort()), null, 2) + '\n', 'utf8');
  console.log(`✓ note の記事 ${notes.length} 本中 ${Object.keys(mapped).length} 本を原稿と対応づけました（対応表 ${Object.keys(finalMap).length} 本）`);
  // 対応づけられなかったもの（公開情報のタイトルのみ）を記録し、取り違えや未対応を確認できるようにする
  const linked = new Set(Object.values(mapped).flatMap((v) => [v.url, ...(v.duplicates || [])]));
  for (const [slug, v] of Object.entries(mapped)) {
    if (v.duplicates) console.log(`::warning title=note の重複出品::${slug} が note に ${v.duplicates.length + 1} 本あります。ランチャー [U] で 1 本にしてください`);
  }
  const unlinked = notes.filter((n) => !linked.has(n.noteUrl));
  for (const n of unlinked) console.log(`  - 未対応の note: ${n.name}`);
  await checkPublishedNotes(finalMap, unlinked);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
