// リポジトリの外にある公開文面（note のクリエイター紹介・メンバーシップの名前と説明・プランの説明・X の自己紹介・GitHub の About）を、
// 正本 data/profile_copy.json と比べる。違う面・取得できない面（unknown）は ::error にして終了コード 1。
// 公開中の文面には正本が無く、手書きのまま「毎朝」「全有料レポート読み放題」が残っていた（2026-10-22: 有料 36 本中 3 本しか特典に入っていない）。
// 正本の文は、根拠つきで登録した語だけで書く（scripts/utils/profile_vocabulary.mjs。書いてはいけない語を並べる方式は言い換えで通った）。
// .github/workflows/live-check.yml から定期実行する（サイトの公開は止めない）。ファイルは書かない。
// --print: 正本から各面の文面を出す（note・X・GitHub に貼り付ける用。ネットワークに接続しない）
// 既存の check_zenn.mjs（Zenn の記事の公開状態を zenn_status.json に書く）・check_mermaid.mjs（記事の図の構文）とは、
// 対象（プロフィール類）も正本（data/profile_copy.json）も違い、ファイルを書かない検査なので、別のファイルにしている
import path from 'path';
import { pathToFileURL } from 'url';
import { siteConfig } from '../src/config/site.js';
import { findForbiddenClaims } from './utils/claims_check.mjs';
import { findHype } from './utils/hype_check.mjs';
import { NAME_RE, placeholders, termEvidenceProblems, vocabularyProblems } from './utils/profile_vocabulary.mjs';
import { BAD, UNKNOWN, annotation, bad, ok, readJsonStrict, tally, unknown } from './utils/verdict.mjs';
import { fetchAllNotes } from './sync_note_urls.mjs';

const COPY_FILE = path.resolve('data/profile_copy.json');
const UA = { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' };

// 公開文面の面。path は正本の surfaces の名前。opaqueUrls は URL が短縮される面（X は t.co に置き換える）
export const PROFILE_SURFACES = [
  { id: 'noteProfile', path: 'note.creatorProfile' },
  { id: 'circleName', path: 'note.circle.name' },
  { id: 'circleDescription', path: 'note.circle.description' },
  { id: 'planName', path: 'note.plan.name' },
  { id: 'planDescription', path: 'note.plan.description' },
  { id: 'xBio', path: 'x.bio', opaqueUrls: true },
  { id: 'githubDescription', path: 'github.description' },
  { id: 'githubHomepage', path: 'github.homepage' },
];

// 補助の検査（語の一覧）。主の検査は語の登録（vocabularyProblems）で、こちらは登録した語の組み合わせで主張が作られたときの保険
const CLAIM_CLASSES = [
  [/毎朝|毎日|毎晩|毎週|日刊|デイリー|\bdaily\b/i, '配信の頻度（実際の公開は不定期）'],
  [/世界最速|最速|最強|世界一|No\.?\s?1|唯一|圧倒的/i, '根拠のない最上級'],
  [/Trending/i, 'GitHub Trending から集めているかのような表現（検索 API で集めている）'],
];
// メンバーシップで全記事が読めるかのような表現
const MEMBERSHIP_ALL_RE = /(?:読み|見)放題|全て|すべて|全部|全(?:有料)?(?:技術)?(?:記事|レポート|アーカイブ)|過去の全/;

export const normalizeCopy = (s) => String(s ?? '').normalize('NFKC').replace(/\s+/g, '');
const comparable = (s, surface) => normalizeCopy(surface.opaqueUrls ? String(s ?? '').replace(/https?:\/\/\S+/g, 'URL') : s);

// 正本から面 surfacePath の文面を作る（文を改行でつなぎ、差し込みを埋める）。作れなければ null
export function renderSurface(copy, surfacePath) {
  const ids = copy?.surfaces?.[surfacePath];
  if (!Array.isArray(ids) || !ids.length || !ids.every((id) => typeof copy.statements?.[id] === 'string')) return null;
  const values = placeholders(copy.names);
  return ids.map((id) => copy.statements[id].replace(/\{([\w.]+)\}/g, (m, k) => values[k] ?? m)).join('\n');
}

// 「全記事・全アーカイブ読み放題」は、有料記事がすべてメンバーシップ特典に入っているときだけ言える。本数が分からなければ言えない
export function membershipClaimProblems(text, { paidNotes, membershipConnected } = {}) {
  const m = normalizeCopy(text).match(MEMBERSHIP_ALL_RE);
  if (!m) return [];
  if (!Number.isInteger(paidNotes) || !Number.isInteger(membershipConnected)) return [`「${m[0]}」と書いているが、メンバーシップ特典に入っている有料記事の本数が分からない`];
  if (paidNotes === 0 || membershipConnected < paidNotes) return [`「${m[0]}」と書いているが、メンバーシップ特典に入っている有料記事は ${membershipConnected} / ${paidNotes} 本`];
  return [];
}

// 改行・空白で語が分かれていても見つける（note の API は説明文を途中で改行して返す）
function claimProblems(raw) {
  const text = normalizeCopy(raw);
  const hits = [...findForbiddenClaims(text), ...findHype(text)];
  for (const [re, why] of CLAIM_CLASSES) {
    const m = text.match(re);
    if (m) hits.push(`${why} ("${m[0]}")`);
  }
  return hits;
}

// 正本そのものの問題: 面の形（登録した文の id の並びだけ）、文の語（根拠つきの語と文法の語だけ）、名前の形、語の根拠の実在、
// 使っていない文（どの面にも出ない文は見直されないまま残る）、組み立てた文面の補助の検査
export function copyProblems(copy) {
  const out = [];
  const statements = copy?.statements && typeof copy.statements === 'object' ? copy.statements : {};
  const known = placeholders(copy?.names);
  for (const [id, text] of Object.entries(statements)) {
    if (typeof text !== 'string' || !text.trim()) out.push(`statements.${id}: 文が空`);
    else for (const p of vocabularyProblems(text, known)) out.push(`statements.${id}: ${p}`);
  }
  for (const [k, v] of Object.entries(copy?.names || {})) if (typeof v !== 'string' || !NAME_RE.test(v)) out.push(`names.${k}: 名前はカタカナ・ラテン文字だけの 16 文字以内（"${v}"）`);
  const used = new Set();
  for (const s of PROFILE_SURFACES) {
    const ids = copy?.surfaces?.[s.path];
    if (!Array.isArray(ids) || !ids.length) {
      out.push(`${s.path}: 面は statements の id の並びで書く（${JSON.stringify(ids ?? null).slice(0, 60)}）`);
      continue;
    }
    for (const id of ids) {
      if (typeof statements[id] !== 'string') out.push(`${s.path}: 登録されていない文 "${id}"`);
      used.add(id);
    }
    const text = renderSurface(copy, s.path);
    if (text === null) continue;
    for (const p of claimProblems(text)) out.push(`${s.path}: ${p}`);
    const all = normalizeCopy(text).match(MEMBERSHIP_ALL_RE);
    if (all) out.push(`${s.path}: メンバーシップで全記事が読み放題かのような表現 ("${all[0]}")`);
  }
  for (const id of Object.keys(statements)) if (!used.has(id)) out.push(`statements.${id}: どの面でも使っていない文`);
  for (const p of termEvidenceProblems()) out.push(`語の根拠: ${p}`);
  return out;
}

// live: 公開中の値（取得できなかった面は undefined / null）。paidNotes / membershipConnected: 有料記事の本数と、そのうち特典に入っている本数。
// 全記事読み放題の表現は、面を選ばずすべての面で確かめる
export function liveProfileVerdicts(copy, live) {
  const verdicts = {};
  for (const s of PROFILE_SURFACES) {
    const value = live[s.id];
    if (value === undefined || value === null) {
      verdicts[s.id] = unknown(live.errors?.[s.id] ? `取得できない（${live.errors[s.id]}）` : '取得できない');
      continue;
    }
    const problems = membershipClaimProblems(value, live);
    const want = renderSurface(copy, s.path);
    if (want === null) problems.push(`正本（data/profile_copy.json の surfaces.${s.path}）から文面を作れない`);
    else if (comparable(value, s) !== comparable(want, s)) problems.push(`正本（data/profile_copy.json の surfaces.${s.path}）と違う`);
    verdicts[s.id] = problems.length ? bad(problems.join(' / ')) : ok();
  }
  const counts = { paidNotes: live.paidNotes, membershipConnected: live.membershipConnected };
  verdicts.membership = Number.isInteger(live.paidNotes) && Number.isInteger(live.membershipConnected)
    ? ok(counts)
    : unknown('有料記事の本数・メンバーシップ特典に入っている本数を取得できない', counts);
  return verdicts;
}

export function liveProfileReport(verdicts) {
  const counts = tally(Object.values(verdicts));
  const lines = [`✓ 公開文面の検査: ${Object.keys(verdicts).length} 面（正本どおり ${counts.ok} / 違う ${counts.bad} / 未計測 ${counts.unknown}）`];
  for (const [id, v] of Object.entries(verdicts)) {
    if (v.status === BAD) lines.push(annotation('error', '公開文面が正本と違う', `${id}: ${v.reason}`));
    else if (v.status === UNKNOWN) lines.push(annotation('error', '公開文面の未計測', `${id}: 未計測（${v.reason}）。確かめられない面は「問題なし」ではありません`));
  }
  return { lines, counts, exitCode: counts.bad || counts.unknown ? 1 : 0 };
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const decodeEntities = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// 取得先は設定（src/config/site.js）から作る（正本に URL やアカウント名を二重に持たない）
const lastPathPart = (url) => new URL(url).pathname.split('/').filter(Boolean).pop();

// 公開中の値を集める。取れなかった面は値を入れず、errors に理由を残す（unknown になる）
export async function fetchLiveProfile() {
  const live = { errors: {} };
  const attempt = async (ids, fn) => {
    try {
      await fn();
    } catch (e) {
      for (const id of ids) live.errors[id] = e.message;
    }
  };
  const u = lastPathPart(siteConfig.noteProfileUrl);
  await attempt(['noteProfile'], async () => {
    const p = (await getJson(`https://note.com/api/v2/creators/${u}`))?.data?.profile;
    if (typeof p !== 'string') throw new Error('想定外の応答形式（profile が無い）');
    live.noteProfile = p;
  });
  await attempt(['circleName', 'circleDescription'], async () => {
    const d = (await getJson(`https://note.com/api/v2/creators/${u}/circle`))?.data;
    if (typeof d?.name !== 'string' || typeof d?.description !== 'string') throw new Error('想定外の応答形式（name / description が無い）');
    live.circleName = d.name;
    live.circleDescription = d.description;
  });
  await attempt(['planName', 'planDescription', 'membership'], async () => {
    const notes = await fetchAllNotes({ delayMs: 800 });
    const paid = notes.filter((n) => typeof n.price === 'number' && n.price > 0);
    live.paidNotes = paid.length;
    if (paid.every((n) => typeof n.membershipConnected === 'boolean')) live.membershipConnected = paid.filter((n) => n.membershipConnected).length;
    // プランの説明は、特典に入っている記事の API にだけ載る
    const key = paid.find((n) => n.membershipConnected)?.noteUrl.match(/\/n\/(n\w+)/)?.[1];
    if (!key) throw new Error('メンバーシップ特典に入っている記事が無いため、プランの説明を読めない');
    const plan = (await getJson(`https://note.com/api/v3/notes/${key}`))?.data?.circle_plans?.[0];
    if (typeof plan?.name !== 'string' || typeof plan?.description !== 'string') throw new Error('想定外の応答形式（circle_plans が無い）');
    live.planName = plan.name;
    live.planDescription = plan.description;
  });
  await attempt(['xBio'], async () => {
    const res = await fetch(`https://x.com/${siteConfig.xHandle.replace(/^@/, '')}`, { headers: UA, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const m = html.match(/<meta[^>]+(?:property|name)="(?:og:)?description"[^>]*content="([^"]*)"/i) || html.match(/<meta[^>]+content="([^"]*)"[^>]*(?:property|name)="(?:og:)?description"/i);
    if (!m) throw new Error('自己紹介（meta description）が見つからない');
    live.xBio = decodeEntities(m[1]);
  });
  await attempt(['githubDescription', 'githubHomepage'], async () => {
    const token = process.env.GITHUB_TOKEN;
    const repo = new URL(siteConfig.githubUrl).pathname.replace(/^\/|\/$/g, '');
    const d = await getJson(`https://api.github.com/repos/${repo}`, token ? { Authorization: `Bearer ${token}` } : {});
    if (typeof d?.description !== 'string') throw new Error('想定外の応答形式（description が無い）');
    live.githubDescription = d.description;
    live.githubHomepage = d.homepage ?? '';
  });
  return live;
}

async function main() {
  const copy = readJsonStrict(COPY_FILE);
  const own = copyProblems(copy);
  for (const p of own) console.log(annotation('error', '正本の文面に問題', p));
  if (process.argv.includes('--print')) {
    for (const s of PROFILE_SURFACES) console.log(`--- ${s.path}\n${renderSurface(copy, s.path)}\n`);
    process.exitCode = own.length ? 1 : 0;
    return;
  }
  const r = liveProfileReport(liveProfileVerdicts(copy, await fetchLiveProfile()));
  for (const l of r.lines) console.log(l);
  process.exitCode = own.length || r.exitCode ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.log(annotation('error', '公開文面の検査', `検査そのものが失敗しました（${e.message}）`));
    process.exitCode = 1;
  });
}
