// Zenn に記事が実際に公開されているかを、記事ごとに Zenn の公開 API で確かめ、scripts/zenn_status.json に残す。
// Zenn の記事 URL の末尾（slug）は Zenn 全体で一意なので、アカウント名を知らなくても slug で引ける。
// articles/*.md は GitHub 連携で Zenn に公開される前提だが、連携が実際に動いているかはこれまで誰も確かめていなかった（2026-10-21）。
// 同日、Zenn への自動公開を停止して全記事を published: false にしたため、published: false なのに Zenn でまだ公開中の記事（非公開化の反映漏れ）も知らせる
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const DIR = path.resolve('articles');
const OUT = path.resolve('scripts/zenn_status.json');

export function zennSummary(results) {
  const live = results.filter((r) => r.live);
  return {
    total: results.length,
    live: live.length,
    likes: live.reduce((a, r) => a + (r.likes || 0), 0),
    users: [...new Set(live.map((r) => r.user).filter(Boolean))],
    // published: false にしたのに Zenn で公開されたままの記事
    stillLive: live.filter((r) => r.published === false).map((r) => r.slug),
    // 公開状態を確認できなかった記事（「公開されていない」とは数えない）
    unknown: results.filter((r) => r.live === null).length,
  };
}

// GitHub Actions に出す警告。公開する記事が 1 本も無い（自動公開の停止中）なら「連携が未設定」とは言わない
export function zennWarnings(results, summary = zennSummary(results)) {
  const warnings = [];
  if (summary.stillLive.length) warnings.push(`published: false にした記事が Zenn でまだ公開中です（${summary.stillLive.length} 本: ${summary.stillLive.join(', ')}）。数日たっても残る場合は Zenn のダッシュボードで非公開にしてください`);
  if (results.some((r) => r.published) && summary.live === 0 && results.some((r) => r.live === false)) warnings.push('articles/ の記事が Zenn に 1 本も公開されていません（Zenn の GitHub 連携が未設定の可能性）');
  // 1 本も確認できなかった（Zenn の API が 403 を返す等）ときは、「公開中の記事が無い」と区別して知らせる。
  // 確認できないまま黙っていると、非公開にした記事が Zenn に残っていても気づけない
  const unknown = results.filter((r) => r.live === null);
  const why = [...new Set(unknown.map((r) => (r.status ? `HTTP ${r.status}` : r.error || "不明")))].slice(0, 3).join(", ");
  if (results.length > 0 && unknown.length === results.length) {
    warnings.push(`Zenn の公開状態を 1 本も確認できませんでした（${results.length} 本すべて ${why}）。非公開にした記事が Zenn に残っていないかは Zenn のダッシュボードで確認してください`);
  } else if (unknown.length) {
    // 一部だけ確認できなかったときも黙らない（確認できなかった記事は公開中かどうか分からない）
    warnings.push(`${results.length} 本中 ${unknown.length} 本は Zenn の公開状態を確認できませんでした（${why}）。その記事が Zenn に残っていないかは分かりません: ${unknown.map((r) => r.slug).join(", ")}`);
  }
  return warnings;
}

// 記事 1 本の公開状態。live: true（公開中）/ false（404 か published: false）/ null（確認できない: 404 以外の失敗・通信の失敗・応答に published が無い）
export async function zennArticleResult(slug, published, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`https://zenn.dev/api/articles/${slug}`, { headers: { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' }, signal: AbortSignal.timeout(15000) });
    if (res.status === 404) return { slug, published, live: false, status: 404 };
    if (!res.ok) return { slug, published, live: null, status: res.status };
    const a = (await res.json())?.article;
    // published が無い・真偽値でない応答を「公開中」とみなさない（以前は ?? true で公開中にしていた）
    if (typeof a?.published !== 'boolean') return { slug, published, live: null, error: '応答に published（真偽値）が無い' };
    return { slug, published, live: a.published, user: a.user?.username || '', likes: a.liked_count ?? null, publishedAt: a.published_at || '' };
  } catch (e) {
    return { slug, published, live: null, error: e.message };
  }
}

async function main() {
  // published: false の記事も調べる（非公開にした記事が Zenn に残っていないかを確かめるため）
  const articles = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, ''), published: /^published:\s*true/m.test(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
  const results = [];
  for (const { slug, published } of articles) {
    results.push(await zennArticleResult(slug, published));
    await new Promise((r) => setTimeout(r, 500));
  }
  const summary = zennSummary(results);
  console.log(`✓ Zenn: 公開中 ${summary.live} / ${summary.total} 本・未確認 ${summary.unknown} 本（いいね合計 ${summary.likes}${summary.users.length ? `、アカウント ${summary.users.join(', ')}` : ''}）`);
  for (const w of zennWarnings(results, summary)) console.log(`::warning title=Zenn::${w}`);
  fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), summary, articles: results }, null, 2) + '\n', 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
