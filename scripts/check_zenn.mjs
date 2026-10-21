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
  };
}

// GitHub Actions に出す警告。公開する記事が 1 本も無い（自動公開の停止中）なら「連携が未設定」とは言わない
export function zennWarnings(results, summary = zennSummary(results)) {
  const warnings = [];
  if (summary.stillLive.length) warnings.push(`published: false にした記事が Zenn でまだ公開中です（${summary.stillLive.length} 本: ${summary.stillLive.join(', ')}）。数日たっても残る場合は Zenn のダッシュボードで非公開にしてください`);
  if (results.some((r) => r.published) && summary.live === 0) warnings.push('articles/ の記事が Zenn に 1 本も公開されていません（Zenn の GitHub 連携が未設定の可能性）');
  return warnings;
}

async function main() {
  // published: false の記事も調べる（非公開にした記事が Zenn に残っていないかを確かめるため）
  const articles = fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).map((f) => ({ slug: f.replace(/\.md$/, ''), published: /^published:\s*true/m.test(fs.readFileSync(path.join(DIR, f), 'utf8')) }));
  const results = [];
  for (const { slug, published } of articles) {
    try {
      const res = await fetch(`https://zenn.dev/api/articles/${slug}`, { headers: { 'User-Agent': 'auto-tech-radar (+https://github.com/ssk0224/auto-tech-radar)' }, signal: AbortSignal.timeout(15000) });
      if (res.status === 404) results.push({ slug, published, live: false, status: 404 });
      else if (!res.ok) results.push({ slug, published, live: null, status: res.status });
      else {
        const a = (await res.json())?.article || {};
        results.push({ slug, published, live: Boolean(a.published ?? true), user: a.user?.username || '', likes: a.liked_count ?? null, publishedAt: a.published_at || '' });
      }
    } catch (e) {
      results.push({ slug, published, live: null, error: e.message });
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const summary = zennSummary(results);
  console.log(`✓ Zenn: 公開中 ${summary.live} / ${summary.total} 本（いいね合計 ${summary.likes}${summary.users.length ? `、アカウント ${summary.users.join(', ')}` : ''}）`);
  for (const w of zennWarnings(results, summary)) console.log(`::warning title=Zenn::${w}`);
  fs.writeFileSync(OUT, JSON.stringify({ checkedAt: new Date().toISOString(), summary, articles: results }, null, 2) + '\n', 'utf8');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
