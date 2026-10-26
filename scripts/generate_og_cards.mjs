import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pngFromSvg } from './utils/og_png.mjs';
import { imageTextProblems } from './utils/image_text.mjs';
import { UNCATEGORIZED } from '../src/utils/categories.js';

export { UNCATEGORIZED };

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

// 見た目（色・アイコン・背景の模様）の種類。キーワードの部分一致で選ぶので、記事の内容を述べる文字（カテゴリ名・用途の決まり文句）は持たせない
// （「セキュア実行サンドボックス」などが Android TV のツールの画像に出た。2026-10-22）
function getVisualArchetype(tags, title, desc, slug) {
  const text = `${(tags || []).join(' ')} ${title} ${desc}`.toLowerCase();
  
  // スラッグ文字列から決定論的ハッシュ値を計算（一意のバリエーションシード）
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash);

  // パターン種別の選択: 0=circuit, 1=matrix_dots, 2=isometric_cubes, 3=radial_radar, 4=sound_waves
  const patternType = seed % 5;

  if (/agent|swarm|orchestrat|multi-agent/i.test(text)) {
    return {
      icon: '🧠',
      bgGradient: ['#0f051d', '#230b42', '#05010a'],
      accentGradient: ['#e879f9', '#c084fc', '#a855f7'],
      badgeBg: 'rgba(192, 132, 252, 0.2)', badgeBorder: '#c084fc',
      glow: '#d946ef',
      patternType,
      seed
    };
  } else if (/llm|qwen|gpt|model|weights|inference|neural|speculative/i.test(text)) {
    return {
      icon: '⚡',
      bgGradient: ['#050e26', '#0d2859', '#020512'],
      accentGradient: ['#38bdf8', '#60a5fa', '#3b82f6'],
      badgeBg: 'rgba(56, 189, 248, 0.2)', badgeBorder: '#38bdf8',
      glow: '#0284c7',
      patternType,
      seed
    };
  } else if (/rust|perf|speed|fast|kernel|wasm|low-latency/i.test(text)) {
    return {
      icon: '🔥',
      bgGradient: ['#240a04', '#4a1506', '#100301'],
      accentGradient: ['#fb923c', '#f97316', '#ea580c'],
      badgeBg: 'rgba(249, 115, 22, 0.2)', badgeBorder: '#fb923c',
      glow: '#f97316',
      patternType,
      seed
    };
  } else if (/browser|automation|crawl|scrap|web-agent/i.test(text)) {
    return {
      icon: '🚀',
      bgGradient: ['#031826', '#08334c', '#010c14'],
      accentGradient: ['#22d3ee', '#06b6d4', '#0284c7'],
      badgeBg: 'rgba(34, 211, 238, 0.2)', badgeBorder: '#22d3ee',
      glow: '#06b6d4',
      patternType,
      seed
    };
  } else if (/cli|tool|terminal|developer|devops|infra|nix|brew/i.test(text)) {
    return {
      icon: '🛠️',
      bgGradient: ['#031710', '#073322', '#010c08'],
      accentGradient: ['#34d399', '#10b981', '#059669'],
      badgeBg: 'rgba(52, 211, 153, 0.2)', badgeBorder: '#34d399',
      glow: '#10b981',
      patternType,
      seed
    };
  } else if (/python|data|analytics|pipeline|database/i.test(text)) {
    return {
      icon: '🐍',
      bgGradient: ['#081726', '#122c42', '#030b14'],
      accentGradient: ['#4ade80', '#22c55e', '#16a34a'],
      badgeBg: 'rgba(74, 222, 128, 0.2)', badgeBorder: '#4ade80',
      glow: '#22c55e',
      patternType,
      seed
    };
  } else if (/security|auth|privacy|sandbox|audit/i.test(text)) {
    return {
      icon: '🛡️',
      bgGradient: ['#1c0410', '#3b0a24', '#0d0107'],
      accentGradient: ['#f43f5e', '#e11d48', '#be123c'],
      badgeBg: 'rgba(244, 63, 94, 0.2)', badgeBorder: '#f43f5e',
      glow: '#f43f5e',
      patternType,
      seed
    };
  } else {
    return {
      icon: '💎',
      bgGradient: ['#1f1304', '#402908', '#0c0701'],
      accentGradient: ['#fbbf24', '#f59e0b', '#d97706'],
      badgeBg: 'rgba(251, 191, 36, 0.2)', badgeBorder: '#fbbf24',
      glow: '#f59e0b',
      patternType,
      seed
    };
  }
}

// 幾何学・ハイテク背景パターンの動的ジェネレータ
function renderBackgroundPattern(patternType, accentColor, seed) {
  switch (patternType) {
    case 0: // 回路・サイバーライン（Circuit Grid）
      return `
        <g opacity="0.12" stroke="${accentColor}" stroke-width="1.5" fill="none">
          <path d="M 0 100 L 250 100 L 320 170 L 600 170 L 680 90 L 1200 90" />
          <path d="M 0 350 L 400 350 L 480 430 L 850 430 L 920 360 L 1200 360" />
          <path d="M 0 520 L 180 520 L 260 440 L 720 440 L 790 510 L 1200 510" />
          <circle cx="320" cy="170" r="4" fill="${accentColor}" />
          <circle cx="680" cy="90" r="4" fill="${accentColor}" />
          <circle cx="480" cy="430" r="4" fill="${accentColor}" />
          <circle cx="790" cy="510" r="4" fill="${accentColor}" />
        </g>
      `;
    case 1: // マトリクス・ハイテクドット（Dot Matrix）
      return `
        <pattern id="dotPattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="1.8" fill="${accentColor}" opacity="0.18" />
        </pattern>
        <rect width="1200" height="630" fill="url(#dotPattern)" />
      `;
    case 2: // 等角投影キューブ＆ワイヤー（Isometric Cube Net）
      return `
        <g opacity="0.08" stroke="#ffffff" stroke-width="1" fill="none">
          <line x1="0" y1="0" x2="1200" y2="630" />
          <line x1="0" y1="315" x2="600" y2="630" />
          <line x1="600" y1="0" x2="1200" y2="315" />
          <line x1="1200" y1="0" x2="0" y2="630" />
          <circle cx="600" cy="315" r="180" stroke="${accentColor}" stroke-width="1.2" opacity="0.2" />
          <circle cx="600" cy="315" r="320" stroke="${accentColor}" stroke-width="1" stroke-dasharray="8 6" opacity="0.15" />
        </g>
      `;
    case 3: // レーダー走査円＆同心円（Concentric Radar）
      return `
        <g opacity="0.15" stroke="${accentColor}" fill="none">
          <circle cx="1050" cy="220" r="100" stroke-width="1.2" />
          <circle cx="1050" cy="220" r="220" stroke-width="1" stroke-dasharray="10 8" />
          <circle cx="1050" cy="220" r="360" stroke-width="1" opacity="0.6" />
          <line x1="1050" y1="0" x2="1050" y2="630" stroke-width="1" opacity="0.4" />
          <line x1="600" y1="220" x2="1200" y2="220" stroke-width="1" opacity="0.4" />
        </g>
      `;
    default: // ハイテクサウンドウェーブ＆ストライプ（Audio Waveform）
      return `
        <g opacity="0.12" fill="${accentColor}">
          <rect x="150" y="180" width="3" height="80" rx="1.5" />
          <rect x="180" y="150" width="3" height="140" rx="1.5" />
          <rect x="210" y="200" width="3" height="50" rx="1.5" />
          <rect x="240" y="160" width="3" height="120" rx="1.5" />
          <rect x="960" y="170" width="3" height="110" rx="1.5" />
          <rect x="990" y="140" width="3" height="160" rx="1.5" />
          <rect x="1020" y="190" width="3" height="70" rx="1.5" />
          <rect x="1050" y="160" width="3" height="130" rx="1.5" />
        </g>
      `;
  }
}

// 画像の左上に出すカテゴリ。記事のタグの先頭（GitHub の主な言語）から導き、無ければ「未分類」
const GENERIC_TAGS = new Set(['OSS', 'GITHUB', 'TECH', 'AI']);
export function categoryLabelOf(tags) {
  const first = (Array.isArray(tags) ? tags : []).map((t) => String(t || '').trim()).find(Boolean);
  return first && !GENERIC_TAGS.has(first.toUpperCase()) ? first.toUpperCase() : UNCATEGORIZED;
}

// SVG の文字列を作る（ファイルには書かない）。文字は記事のデータ（タイトル・説明・タグ・スター数・公開日・図の有無）だけから作る
export function renderOgSvg(postData) {
  const { slug, title, stars, tags, desc, pubDate, hasDiagram = true } = postData;
  const rawShortTitle = title.split(' - ')[0].split(':')[0].trim();
  const shortTitle = escapeXml(rawShortTitle);
  const starCount = stars ? `★ ${stars.toLocaleString()}` : '★ —';
  // 説明文とタグは取得元（GitHub の説明・トピック）の文字なので、画像に焼き込めない文字（価格の記号 "$$" など）を含めば画像に出さない（記事のページには残る）
  const imageSafe = (text) => imageTextProblems([text]).length === 0;
  const tagList = Array.isArray(tags) ? tags.filter(imageSafe).slice(0, 3) : ['OSS', 'Tech'];
  // 幅 1080px・22px で収まる長さに切る（全角は半角の約 2 倍の幅）。短い説明には … を付けない
  const fitWidth = (text, maxUnits) => {
    let out = '';
    let units = 0;
    for (const ch of text) {
      units += ch.codePointAt(0) > 0xff ? 2 : 1;
      if (units > maxUnits) return out + '…';
      out += ch;
    }
    return out;
  };
  const safeDesc = escapeXml(fitWidth(desc && imageSafe(desc) ? desc : '', 88));

  const archetype = getVisualArchetype(tags, title, desc, slug);
  const bandText = `${pubDate ? `掲載 ${pubDate} ｜ ` : ''}★は記事作成時点の GitHub スター数`;
  // エスケープ前の文字から切り出す（&amp; などの実体参照を途中で切ると SVG が壊れる）
  const monogram = escapeXml(rawShortTitle.slice(0, 2).toUpperCase());

  // タイトル文字数に応じた動的フォントサイズ調整
  let titleFontSize = 64;
  if (shortTitle.length > 16) titleFontSize = 50;
  if (shortTitle.length > 24) titleFontSize = 40;

  // テーマごとの光彩位置の計算（シード値で個々にダイナミック変化）
  const glowX = 70 + (archetype.seed % 25);
  const glowY = 15 + ((archetype.seed * 3) % 25);

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- 多層ディープグラデーション背景 -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${archetype.bgGradient[0]}" />
      <stop offset="50%" stop-color="${archetype.bgGradient[1]}" />
      <stop offset="100%" stop-color="${archetype.bgGradient[2]}" />
    </linearGradient>

    <!-- 主役アクセントグラデーション -->
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${archetype.accentGradient[0]}" />
      <stop offset="60%" stop-color="${archetype.accentGradient[1]}" />
      <stop offset="100%" stop-color="${archetype.accentGradient[2]}" />
    </linearGradient>

    <!-- ゴールドスターグラデーション -->
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>

    <!-- 特注オーロラグロー効果（記事ごとに照射角度・位置が変動） -->
    <radialGradient id="glowDynamic" cx="${glowX}%" cy="${glowY}%" r="60%">
      <stop offset="0%" stop-color="${archetype.glow}" stop-opacity="0.4" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>

    <!-- ドロップシャドウ -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.65"/>
    </filter>
  </defs>

  <!-- Background Layer -->
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#glowDynamic)" />

  <!-- 記事個別ジェネレーティブ・ハイテク背景パターン -->
  ${renderBackgroundPattern(archetype.patternType, archetype.accentGradient[0], archetype.seed)}

  <!-- 外枠プレミアムフレーム（ネオンデュアルライン） -->
  <rect x="20" y="20" width="1160" height="590" rx="16" fill="none" stroke="${archetype.badgeBorder}" stroke-width="1.5" stroke-opacity="0.45" />
  <rect x="25" y="25" width="1150" height="580" rx="13" fill="none" stroke="#ffffff" stroke-width="0.7" stroke-opacity="0.08" />

  <!-- ヘッダー行: ブランドバッジ ＆ カテゴリ -->
  <g transform="translate(60, 52)">
    <rect width="380" height="44" rx="22" fill="${archetype.badgeBg}" stroke="${archetype.badgeBorder}" stroke-width="1.4" />
    <text x="190" y="28" fill="${archetype.accentGradient[0]}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="15" font-weight="900" text-anchor="middle" letter-spacing="1.2">
      ⚡ AUTO TECH RADAR ｜ ${escapeXml(categoryLabelOf(tags))}
    </text>
  </g>

  <!-- ヘッダー右: ゴールドスターメガバッジ -->
  <g transform="translate(930, 52)">
    <rect width="210" height="44" rx="22" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.5" />
    <text x="105" y="28" fill="#fbbf24" font-family="'JetBrains Mono', 'Segoe UI', monospace, sans-serif" font-size="19" font-weight="900" text-anchor="middle">${starCount}</text>
  </g>

  <!-- 巨大3Dモノグラム＆シンボル（左アイキャッチブロック） -->
  <g transform="translate(60, 135)">
    <rect width="115" height="115" rx="24" fill="#0d1117" stroke="${archetype.accentGradient[0]}" stroke-width="2.6" filter="url(#cardShadow)" />
    <text x="57" y="60" font-size="44" text-anchor="middle" dominant-baseline="central">${archetype.icon}</text>
    <text x="57" y="98" fill="${archetype.accentGradient[0]}" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="900" text-anchor="middle">${monogram}</text>
  </g>

  <!-- メインタイトル ＆ サブヘッド -->
  <g transform="translate(205, 172)">
    <text x="0" y="0" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="${titleFontSize}" font-weight="900" letter-spacing="-0.5">
      ${shortTitle}
    </text>
    <text x="0" y="45" fill="url(#accent)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="25" font-weight="800">
      海外急上昇OSS README の原文
    </text>
  </g>

  <!-- 帯: 掲載日とスター数の注記（記事のデータから） -->
  <g transform="translate(60, 282)">
    <rect width="1080" height="66" rx="12" fill="${archetype.badgeBg}" stroke="${archetype.badgeBorder}" stroke-width="1.6" filter="url(#cardShadow)" />
    <rect x="0" y="0" width="10" height="66" rx="5" fill="${archetype.accentGradient[0]}" />
    <text x="32" y="42" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="900">
      <tspan fill="#f1f5f9" font-weight="700">${escapeXml(bandText)}</tspan>
    </text>
  </g>

  <!-- リポジトリ概要（抜粋） -->
  <g transform="translate(60, 395)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="500">
      ${safeDesc}
    </text>
  </g>

  <!-- フッターバッジ群（Web 記事＝無料部分に実際に含まれるものだけを書く） -->
  <g transform="translate(60, 480)">
    <!-- バッジ 1: 解説の根拠 -->
    <rect x="0" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="${archetype.accentGradient[0]}" stroke-width="1.3" />
    <text x="130" y="31" fill="${archetype.accentGradient[0]}" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ README ベースの解説</text>

    <!-- バッジ 2: 図解（記事に Mermaid 図があるときだけ） -->
    ${hasDiagram ? `<rect x="280" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="#3b82f6" stroke-width="1.3" />
    <text x="410" y="31" fill="#93c5fd" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ アーキテクチャ図解</text>` : ''}

    <!-- バッジ 3: 技術タグ -->
    <rect x="560" y="0" width="280" height="50" rx="10" fill="#0d1117" stroke="#374151" stroke-width="1.3" />
    <text x="700" y="31" fill="#cbd5e1" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="700" text-anchor="middle">${tagList.map(escapeXml).join(' ｜ ')}</text>

    <!-- バッジ 4: README の文を訳さずに載せていること -->
    <rect x="860" y="0" width="220" height="50" rx="10" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.3" />
    <text x="970" y="31" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">📖 原文のまま掲載</text>
  </g>
</svg>`;
  return svgContent;
}

// PNG の部品（scripts/utils/og_png.mjs）。tests/og_text.test.mjs がここから読む
export { PNG_SOURCE_KEY, readPngText, stampPng, svgSourceHash } from './utils/og_png.mjs';

export function generateOgCardForPost(postData) {
  const { slug } = postData;
  const outPath = path.join(ogpDir, `${slug}.svg`);
  fs.writeFileSync(outPath, renderOgSvg(postData), 'utf8');
  // PNGサムネイル（note見出し画像用: 1200x630）
  const png = pngFromSvg(outPath);
  if (png) fs.writeFileSync(path.join(ogpDir, `${slug}.png`), png);
  return `/auto-tech-radar/ogp/${slug}.svg`;
}

// 記事の Markdown から画像の入力を読む（frontmatter の title・description・tags・stars・pubDate と、Mermaid 図の有無）
export function ogInputFromArticle(slug, content) {
  const post = { slug, title: slug, desc: '', tags: [], stars: 0, pubDate: null, hasDiagram: /^```mermaid\b/m.test(content) };
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!fm) return post;
  const titleM = fm.match(/^title:\s*"?(.*?)"?\r?$/m);
  if (titleM) post.title = titleM[1];
  const descM = fm.match(/^description:\s*"?(.*?)"?\r?$/m);
  if (descM) post.desc = descM[1];
  const starsM = fm.match(/^stars:\s*(\d+)/m);
  if (starsM) post.stars = parseInt(starsM[1], 10);
  const tagsM = fm.match(/^tags:\s*\[(.*?)\]/m);
  if (tagsM) post.tags = tagsM[1].split(',').map((t) => t.replace(/["'\s]/g, '')).filter(Boolean);
  const pubM = fm.match(/^pubDate:\s*["']?(\d{4}-\d{2}-\d{2})/m);
  if (pubM) post.pubDate = pubM[1];
  return post;
}

// 全記事に対して実行
if (process.argv[1] && process.argv[1].endsWith('generate_og_cards.mjs')) {
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  console.log(`全 ${files.length} 本のOGPカード ＆ サムネイルPNGを生成中...`);

  files.forEach(f => {
    const slug = f.replace('.md', '');
    generateOgCardForPost(ogInputFromArticle(slug, fs.readFileSync(path.join(radarDir, f), 'utf8')));
  });
  // サイト共通のカード（public/og-card.png）はオーナー端末の node scripts/render_site_og_card.mjs で作り直す（記事の画像を書く CI とは書く側が違う）

  console.log('✓ 全OGPカード（SVG ＆ note用PNGサムネイル）の生成が完了しました！');
}
