import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  const postModules = import.meta.glob('../radar/*.md', { eager: true });
  const items = Object.values(postModules).map((post: any) => {
    const slug = post.url?.replace(/\/$/, '').split('/').pop() || '';
    const fm = post.frontmatter || {};
    const stars = Number(fm.stars) || 0;
    let ring = "TRIAL";
    if (stars >= 15000) ring = "ADOPT";
    else if (stars >= 5000) ring = "TRIAL";
    else if (stars >= 1000) ring = "ASSESS";
    else ring = "HOLD";

    return {
      slug,
      title: fm.title || slug,
      description: fm.description || "",
      stars,
      ring,
      tags: fm.tags || [],
      pubDate: fm.pubDate || "2026-10-09",
      url: `https://ssk0224.github.io/auto-tech-radar/radar/${slug}/`,
      mcp_command: `npx -y @modelcontextprotocol/server-fetch https://ssk0224.github.io/auto-tech-radar/radar/${slug}/`
    };
  }).sort((a, b) => b.stars - a.stars);

  return new Response(JSON.stringify({
    name: "Auto Tech Radar Intelligence API",
    version: "2026.10",
    specification: "Agentic AI & Machine-Readable Open Tech Radar",
    endpoint_url: "https://ssk0224.github.io/auto-tech-radar/api/radar.json",
    total_tracked_oss: items.length,
    updated_at: new Date().toISOString(),
    rings_definition: {
      ADOPT: "Stars >= 15,000: 商用本番稼働推奨・デファクトスタンダード基盤",
      TRIAL: "Stars >= 5,000: 本番採用検証・高ROI期待新星",
      ASSESS: "Stars >= 1,000: 急上昇トレンド・先行調査推奨",
      HOLD: "検証保留・動向注視"
    },
    data: items
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
};
