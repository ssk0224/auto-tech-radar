import type { APIRoute } from 'astro';
import { getArticles, slugOf, starTier, STAR_TIERS, STAR_TIER_NOTE } from '../../utils/articles.js';
// 掲載時と現在のスター数（Radar Ledger: data/derived/velocity.json。記録が無ければ null）
import { trackRecordFor } from '../../utils/track_record.js';
import { velocity } from '../../utils/velocity_data.js';

export const GET: APIRoute = async () => {
  // ノイズ記事は getArticles 側で除外済み
  const items = getArticles().map((post: any) => {
    const slug = slugOf(post);
    const fm = post.frontmatter || {};
    const stars = Number(fm.stars) || 0;
    // GitHub スター数による区分（評価・推奨ではない）
    const ring = starTier(stars).label;
    const track = trackRecordFor(fm, velocity);

    return {
      slug,
      title: fm.title || slug,
      description: fm.description || "",
      stars,
      ring,
      tags: fm.tags || [],
      pubDate: fm.pubDate || null, // 欠落時に仮の日付を入れない
      stars_at_publish: track.stars_at_publish,
      stars_now: track.stars_now,
      growth_pct: track.growth_pct,
      url: `https://ssk0224.github.io/auto-tech-radar/radar/${slug}/`
    };
  }).sort((a, b) => b.stars - a.stars);

  return new Response(JSON.stringify({
    name: "Auto Tech Radar Intelligence API",
    version: "2026.10",
    specification: "Agentic AI & Machine-Readable Open Tech Radar",
    endpoint_url: "https://ssk0224.github.io/auto-tech-radar/api/radar.json",
    total_tracked_oss: items.length,
    updated_at: new Date().toISOString(),
    rings_definition: { tiers: STAR_TIERS.map((t) => t.label), note: STAR_TIER_NOTE },
    data: items
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
