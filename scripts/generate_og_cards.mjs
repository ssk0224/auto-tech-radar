import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const ogpDir = path.join(rootDir, 'public', 'ogp');

if (!fs.existsSync(ogpDir)) fs.mkdirSync(ogpDir, { recursive: true });

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

export function generateOgCardForPost(postData) {
  const { slug, title, stars, tags, desc } = postData;
  const shortTitle = escapeXml(title.split(' - ')[0].split(':')[0].trim());
  const starCount = stars ? `★ ${stars.toLocaleString()}` : '急上昇';
  const tagList = Array.isArray(tags) ? tags.slice(0, 3) : ['OSS', 'Tech'];
  const safeDesc = escapeXml((desc || '').slice(0, 70) + '...');

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0f19" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#030712" />
    </linearGradient>
    <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#60a5fa" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.25" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#glow)" />

  <!-- Grid lines -->
  <g opacity="0.06" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="126" x2="1200" y2="126" />
    <line x1="0" y1="252" x2="1200" y2="252" />
    <line x1="0" y1="378" x2="1200" y2="378" />
    <line x1="0" y1="504" x2="1200" y2="504" />
    <line x1="240" y1="0" x2="240" y2="630" />
    <line x1="480" y1="0" x2="480" y2="630" />
    <line x1="720" y1="0" x2="720" y2="630" />
    <line x1="960" y1="0" x2="960" y2="630" />
  </g>

  <!-- Brand Badge Top Left -->
  <g transform="translate(80, 75)">
    <rect width="280" height="38" rx="19" fill="#1e293b" stroke="#3b82f6" stroke-width="1.2" />
    <text x="140" y="24" fill="#60a5fa" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" text-anchor="middle" letter-spacing="1">⚡ AUTO TECH RADAR</text>
  </g>

  <!-- Star Metric Badge Top Right -->
  <g transform="translate(900, 75)">
    <rect width="220" height="38" rx="19" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.2" />
    <text x="110" y="24" fill="#fbbf24" font-family="monospace" font-size="16" font-weight="700" text-anchor="middle">${starCount}</text>
  </g>

  <!-- Main Repo Title -->
  <text x="80" y="220" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="64" font-weight="900" letter-spacing="-1">
    ${shortTitle}
  </text>

  <!-- Sub Title -->
  <text x="80" y="295" fill="url(#brand)" font-family="-apple-system, sans-serif" font-size="34" font-weight="800">
    海外急上昇OSS 徹底解剖 ＆ 商用受託・SaaS活用法
  </text>

  <!-- Description -->
  <text x="80" y="375" fill="#94a3b8" font-family="-apple-system, sans-serif" font-size="22" font-weight="500">
    ${safeDesc}
  </text>

  <!-- Bottom Badges -->
  <g transform="translate(80, 480)">
    <rect x="0" y="0" width="220" height="48" rx="8" fill="#111827" stroke="#10b981" stroke-width="1.2" />
    <text x="110" y="30" fill="#34d399" font-family="sans-serif" font-size="15" font-weight="700" text-anchor="middle">受託単価 ¥80万〜250万</text>

    <rect x="240" y="0" width="220" height="48" rx="8" fill="#111827" stroke="#6366f1" stroke-width="1.2" />
    <text x="350" y="30" fill="#a5b4fc" font-family="sans-serif" font-size="15" font-weight="700" text-anchor="middle">アーキテクチャ深層解説</text>

    <rect x="480" y="0" width="240" height="48" rx="8" fill="#111827" stroke="#1f2937" stroke-width="1.2" />
    <text x="600" y="30" fill="#cbd5e1" font-family="monospace" font-size="14" text-anchor="middle">${tagList.join(' ｜ ')}</text>
  </g>
</svg>`;

  const outPath = path.join(ogpDir, `${slug}.svg`);
  fs.writeFileSync(outPath, svgContent, 'utf8');
  return `/auto-tech-radar/ogp/${slug}.svg`;
}

// 全記事に対して実行
if (process.argv[1] && process.argv[1].endsWith('generate_og_cards.mjs')) {
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  console.log(`全 ${files.length} 本のOGPカードを生成中...`);

  files.forEach(f => {
    const slug = f.replace('.md', '');
    const content = fs.readFileSync(path.join(radarDir, f), 'utf8');

    let title = slug;
    let desc = '';
    let tags = [];
    let stars = 0;

    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const fm = fmMatch[1];
      const titleM = fm.match(/^title:\s*"?(.*?)"?$/m);
      if (titleM) title = titleM[1];
      const descM = fm.match(/^description:\s*"?(.*?)"?$/m);
      if (descM) desc = descM[1];
      const starsM = fm.match(/^stars:\s*(\d+)/m);
      if (starsM) stars = parseInt(starsM[1], 10);
      const tagsM = fm.match(/^tags:\s*\[(.*?)\]/m);
      if (tagsM) tags = tagsM[1].split(',').map(s => s.replace(/["'\s]/g, ''));
    }

    generateOgCardForPost({ slug, title, desc, tags, stars });
  });

  console.log('✓ 全OGPカード（SVG）の生成が完了しました！');
}
