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
import { noteTextIssues, noteHtmlText, autoFixableByMaintain } from './utils/note_pending.mjs';
import { draftFileFor, freePartVerdict, isPaidSlug, plainText, renderDraftFree, PAST_MARGIN_CHARS } from './utils/free_part.mjs';
import { BAD, UNKNOWN, annotation, readJsonStrict, tally, unknown } from './utils/verdict.mjs';

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
      // membershipConnected: メンバーシップ特典に入っているか（項目が無ければ null＝分からない。false にしない）
      notes.push({ name: n.name, noteUrl: n.noteUrl, price: typeof n.price === 'number' ? n.price : null, publishAt: typeof n.publishAt === 'string' ? n.publishAt : '', membershipConnected: typeof n.isMembershipConnected === 'boolean' ? n.isMembershipConnected : null });
    }
    // isLastPage が無い・真偽値でない応答を「最後のページ」とみなすと、一覧の途中で打ち切った対応表を作ってしまう
    if (typeof data.isLastPage !== 'boolean') throw new Error('想定外の応答形式（isLastPage が真偽値でない）');
    if (data.isLastPage) break;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return notes;
}

// 公開中の note 記事そのもの（無料部分の本文・タイトル・見出し画像）を検査する。
// オーナー端末からの一括更新（[N]）や見出し画像の設定（[E]）が実際に反映されたかを、note 側の公開内容で確かめるため
export function publishedNoteIssues(d) {
  const text = `${d.name || ''}\n${String(d.body || '').replace(/<[^>]+>/g, ' ')}`;
  const issues = findForbiddenClaims(text);
  // 名前を付けて知らせる表現（ThoughtWorks・インボイス対応領収書・コピペで本番〜・生成時に禁止した誇張）。書き方によらず検出する。
  // [E] で直せるかは表現ではなく、無料部分を原稿の描画に置き換えた後に問題が残らないか（inspectPublishedNotes の maintainFixes）で決める
  for (const issue of noteTextIssues(`${d.name || ''}\n${noteHtmlText(d.body)}`)) {
    if (!issues.includes(issue)) issues.push(issue);
  }
  if (/^\s*#/.test(d.name || '')) issues.push('タイトルが # で始まる');
  return issues;
}

// 比較用の本文（無料部分の検査 freePartVerdict と同じ正規化。記号・数字は消さない）
const plain = plainText;

// 公開中の無料部分が、原稿で決めた有料ラインのどこで終わっているか。
// note の API はログインなしだと有料ラインより前（無料部分）だけを返すので、その終わりが原稿の無料部分のどこにあたるかを見る。
// endPct: 原稿の無料部分の何 % の位置で終わっているか（100 前後なら原稿どおり。小さいほど有料ラインが上）。
// pastDraft: 原稿の無料部分の終わりより先まで無料で見えている（有料部分が無料で読める可能性）
export function paidLineReport(body, draftContent) {
  const split = splitPaid(draftContent || '');
  const rendered = split && renderDraftFree(draftContent);
  if (!rendered) return null;
  const free = plain(body);
  // 原稿は出品と同じ変換で描画してから比べる（Markdown のまま比べると、図の変換などで公開中の方が長く見え、
  // 原稿どおりの記事を「有料ラインが下」と誤って報告していた: 2026-10-22 cadcraft）
  const draftFree = plain(rendered);
  const tail = free.slice(-30);
  const at = tail.length >= 10 ? draftFree.indexOf(tail) : -1;
  const draftEnd = draftFree.slice(-30);
  const endIdx = free.indexOf(draftEnd);
  // 原稿の末尾が公開中の本文に見つかり、その後ろが長い／末尾が見つからなくても全体が原稿より大きく長い: 有料部分が見えている恐れ
  const pastDraft = (endIdx !== -1 && free.length - (endIdx + draftEnd.length) > PAST_MARGIN_CHARS) || free.length > draftFree.length + PAST_MARGIN_CHARS;
  // 位置: past（原稿より先まで見える）/ inside（原稿の無料部分の中で終わる）/ unknown（末尾の文言が原稿と違い、位置が分からない）。
  // 以前は「位置が分からない」を pastDraft: false（＝見えていない）としていたため、37 本中 24 本が測れないまま「0 本」と報告されていた
  const position = pastDraft ? 'past' : at !== -1 || endIdx !== -1 ? 'inside' : 'unknown';
  return {
    position,
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
  const data = (await res.json())?.data;
  if (!data || typeof data !== 'object') throw new Error('想定外の応答形式（data が無い）');
  return data;
}

// 原稿（正本）。無ければ null（比べられない＝unknown）。読めないのは null にしない（失敗として扱う）
function readDraftFile(slug) {
  try {
    return fs.readFileSync(draftFileFor(slug, NOTE_DIR), 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 公開中の note を 1 本ずつ検査する。無料部分を原稿の描画と比べ（freePartVerdict）、比べられない・取得できない記事は unknown として数える。
// 取得に失敗した記事は前回の結果を previous に残し（stale）、半数以上が失敗した回は記録（note_status.json）を上書きしない（write: false）。
// 戻り値の lines は GitHub Actions に出す行、exitCode は 1 つでも bad / unknown / 問題があれば 1
export async function inspectPublishedNotes(map, { fetchDetail = fetchNoteDetail, readDraft = readDraftFile, prev = null, unlinked = [], delayMs = 800 } = {}) {
  const notes = {};
  let failed = 0;
  for (const [slug, v] of Object.entries(map)) {
    const key = String(v?.url || '').match(/\/n\/(n\w+)/)?.[1];
    if (!key) {
      notes[slug] = { freePart: unknown('記事の URL から記事キーが分からない'), issues: ['未計測: 記事の URL から記事キーが分からない'] };
      continue;
    }
    try {
      const d = await fetchDetail(key);
      const draft = readDraft(slug);
      const isPaid = isPaidSlug(slug);
      const freePart = freePartVerdict(d.body, draft, { isPaid });
      const paidLine = isPaid && draft ? paidLineReport(d.body, draft) : null;
      const issues = publishedNoteIssues(d);
      if (freePart.status === BAD) issues.push(`無料部分が原稿と違う: ${freePart.reason}`);
      if (freePart.status === UNKNOWN) issues.push(`未計測: ${freePart.reason}`);
      if (paidLine?.pastDraft && freePart.kind !== 'past') issues.push('有料ラインが原稿の位置より下（有料部分が無料で読める可能性）');
      // [E]（note_browser.mjs maintain）は無料部分を原稿の描画で置き換える。置き換えた後の記事に問題が残らない（タイトルも含めて）なら [E] で直せる
      const maintainFixes = freePart.status === BAD && freePart.kind === 'text' && publishedNoteIssues({ name: d.name, body: renderDraftFree(draft, { isPaid }) }).length === 0;
      // 更新日時とタイトルも残す（オーナーの差し替えが note に届いたかを、日時で確かめられるように）
      const tw = String(d.body || '').match(/.{0,20}ThoughtWorks.{0,20}/);
      notes[slug] = {
        eyecatch: Boolean(d.eyecatch),
        issues,
        freePart,
        maintainFixes,
        ...(paidLine ? { paidLine } : {}),
        sale: saleFields(d),
        name: d.name || '',
        updatedAt: d.updated_at || d.updatedAt || d.publish_at || d.publishAt || '',
        ...(tw ? { excerpt: tw[0].replace(/<[^>]+>/g, '') } : {}),
      };
    } catch (e) {
      failed++;
      const before = prev?.notes?.[slug];
      notes[slug] = { error: e.message, stale: true, freePart: unknown(`取得失敗: ${e.message}`), issues: [`未計測: 取得失敗（${e.message}）`], ...(before ? { previous: before } : {}) };
    }
    if (delayMs) await sleep(delayMs);
  }
  // 原稿と対応づかない公開中の note（古い版の出品が残っているなど）も記録する。古い表現の検査もする
  const others = [];
  for (const n of unlinked) {
    const key = n.noteUrl.match(/\/n\/(n\w+)/)?.[1];
    let issues = [];
    try {
      if (!key) throw new Error('記事キーが分からない');
      issues = publishedNoteIssues(await fetchDetail(key));
    } catch (e) {
      issues = [`未計測: 取得失敗（${e.message}）`];
    }
    if (delayMs) await sleep(delayMs);
    others.push({ name: n.name, url: n.noteUrl, price: n.price, publishAt: n.publishAt, issues });
  }

  const counts = tally(Object.values(notes).map((n) => n.freePart));
  const total = Object.keys(notes).length;
  const lines = [];
  const noImage = Object.keys(notes).filter((s) => notes[s].eyecatch === false);
  const withIssues = Object.keys(notes).filter((s) => notes[s].issues?.length);
  lines.push(`✓ 公開中の note を検査: ${total} 本（無料部分が原稿どおり ${counts.ok} / 原稿と違う ${counts.bad} / 未計測 ${counts.unknown}、見出し画像なし ${noImage.length} 本）`);
  if (noImage.length) lines.push(annotation('warning', 'note の見出し画像', `未設定 ${noImage.length} 本: ${noImage.join(', ')}（ランチャー [E] で設定）`));
  for (const s of withIssues) {
    const fix = notes[s].freePart.status === UNKNOWN ? '取得・比較できるようになるまで確かめられません' : autoFixableByMaintain(notes[s]) ? 'ランチャー [E] で原稿の内容に置き換え' : 'ランチャー [U] で原稿の内容に更新';
    lines.push(annotation('error', 'note の公開内容', `${s}: ${notes[s].issues.join(' / ')}（${fix}）`));
  }
  const unknownSlugs = Object.keys(notes).filter((s) => notes[s].freePart.status === UNKNOWN);
  if (counts.unknown) lines.push(annotation('error', 'note の未計測', `未計測 ${counts.unknown} 本（${unknownSlugs.join(', ')}）。測れなかった記事は「問題なし」ではありません`));
  const unlinkedUnknown = others.filter((o) => o.issues.some((i) => i.startsWith('未計測'))).length;
  if (others.length) lines.push(annotation('warning', '原稿と対応づかない公開中の note', `${others.length} 本（古い版の出品の可能性。scripts/note_status.json の unlinked）${unlinkedUnknown ? `。うち未計測 ${unlinkedUnknown} 本` : ''}`));
  // 半数以上を取得できなかった回の結果で、前回の記録（ランチャーの修正一覧の元）を置き換えない
  const write = !(total > 0 && failed * 2 >= total);
  if (!write) lines.push(annotation('error', 'note の検査', `${total} 本中 ${failed} 本を取得できなかったため、scripts/note_status.json は上書きしません（前回の記録のまま）`));
  const exitCode = counts.bad || counts.unknown || withIssues.length || unlinkedUnknown ? 1 : 0;
  return { notes, unlinked: others, counts, lines, write, exitCode };
}

async function main() {
  let notes;
  try {
    notes = await fetchAllNotes();
  } catch (e) {
    console.log(annotation('error', 'note URL sync', `note の記事一覧を取得できませんでした（${e.message}）。購入リンクは前回の対応表のまま、公開中の記事は検査していません（未計測）`));
    process.exitCode = 1;
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
    prev = readJsonStrict(OUT_FILE, { missing: {} });
  } catch (e) {
    // 壊れた対応表は、今回取得した一覧で作り直す（前回と比べる歯止めは効かないので知らせる）
    console.log(annotation('warning', 'note URL sync', `前回の対応表を読めません（${e.message}）。今回の一覧で作り直します`));
  }
  // note.com から正常に取得できた場合、現在公開中の記事マップを採用する（非公開化された記事が 404 のまま残存するのを防ぐ）。
  // ただし前回より大きく減ったときは一覧の欠けを疑い、置き換えない
  const next = nextNoteUrlMap(prev, mapped);
  if (!next.replace) {
    console.log(annotation('error', 'note URL sync', next.reason));
    process.exitCode = 1;
  }
  const finalMap = next.map;
  fs.writeFileSync(OUT_FILE, JSON.stringify(Object.fromEntries(Object.entries(finalMap).sort()), null, 2) + '\n', 'utf8');
  console.log(`✓ note の記事 ${notes.length} 本中 ${Object.keys(mapped).length} 本を原稿と対応づけました（対応表 ${Object.keys(finalMap).length} 本）`);
  // 対応づけられなかったもの（公開情報のタイトルのみ）を記録し、取り違えや未対応を確認できるようにする
  const linked = new Set(Object.values(mapped).flatMap((v) => [v.url, ...(v.duplicates || [])]));
  for (const [slug, v] of Object.entries(mapped)) {
    if (v.duplicates) console.log(`::warning title=note の重複出品::${slug} が note に ${v.duplicates.length + 1} 本あります。ランチャー [U] で 1 本にしてください`);
  }
  const unlinked = notes.filter((n) => !linked.has(n.noteUrl));
  for (const n of unlinked) console.log(`  - 未対応の note: ${n.name}`);
  let prevStatus = null;
  try {
    prevStatus = readJsonStrict(STATUS_FILE, { missing: null });
  } catch (e) {
    console.log(annotation('warning', 'note の検査', `前回の検査結果を読めません（${e.message}）`));
  }
  const r = await inspectPublishedNotes(finalMap, { prev: prevStatus, unlinked });
  for (const l of r.lines) console.log(l);
  if (r.write) fs.writeFileSync(STATUS_FILE, JSON.stringify({ checkedAt: new Date().toISOString(), counts: r.counts, notes: r.notes, unlinked: r.unlinked }, null, 2) + '\n', 'utf8');
  if (r.exitCode) process.exitCode = 1;
}

// 購入リンクの対応表を今回の一覧 mapped で置き換えてよいか。前回の 8 割未満に減ったら置き換えない（一覧 API の欠け・タイトル照合の失敗で購入リンクを消さない）
export const MIN_KEEP_RATIO = 0.8;
export function nextNoteUrlMap(prev, mapped) {
  const before = Object.keys(prev || {}).length;
  const after = Object.keys(mapped).length;
  if (before > 0 && after < before * MIN_KEEP_RATIO) {
    return { replace: false, map: prev, reason: `対応づけた記事が ${after} 本で、前回の ${before} 本の 8 割未満です。一覧の欠けの恐れがあるため購入リンクの対応表は置き換えません（記事を非公開にした場合は対応表を手で更新してください）` };
  }
  return { replace: true, map: mapped, reason: '' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
