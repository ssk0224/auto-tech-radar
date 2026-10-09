import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

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

// 有名人気実績者の勝ちパターン: テーマ別ダイナミックカラー＆ビジュアルパレット
function getThemeByTags(tags, title, desc) {
  const text = `${(tags || []).join(' ')} ${title} ${desc}`.toLowerCase();
  
  if (/agent|ai|llm|swarm|model|neural|gpt/i.test(text)) {
    return {
      type: 'AI AGENT / LLM',
      icon: '🤖',
      bg1: '#14082e', bg2: '#281157', bg3: '#080314',
      accent1: '#c084fc', accent2: '#8b5cf6',
      badgeBg: 'rgba(139, 92, 246, 0.25)', badgeBorder: '#a855f7',
      glow: '#a855f7',
      stripe: '#8b5cf6',
      price: '¥150万〜¥350万',
      subtext: '最先端AIエージェント内製化・受託DXモデル'
    };
  } else if (/rust|perf|speed|fast|kernel|wasm/i.test(text)) {
    return {
      type: 'RUST / HIGH-SPEED',
      icon: '🦀',
      bg1: '#260b05', bg2: '#401507', bg3: '#100401',
      accent1: '#fb923c', accent2: '#ea580c',
      badgeBg: 'rgba(234, 88, 12, 0.25)', badgeBorder: '#f97316',
      glow: '#ea580c',
      stripe: '#ea580c',
      price: '¥120万〜¥280万',
      subtext: '爆速バックエンド基盤・高負荷インフラ刷新'
    };
  } else if (/python|data|analysis|pytorch|ml/i.test(text)) {
    return {
      type: 'PYTHON / ML CORE',
      icon: '🐍',
      bg1: '#07182c', bg2: '#0e2e54', bg3: '#020b14',
      accent1: '#38bdf8', accent2: '#0284c7',
      badgeBg: 'rgba(2, 132, 199, 0.25)', badgeBorder: '#38bdf8',
      glow: '#38bdf8',
      stripe: '#0284c7',
      price: '¥100万〜¥250万',
      subtext: 'データ分析・ML推論パイプライン構築'
    };
  } else if (/cli|tool|dev|automation|terminal|nix|brew/i.test(text)) {
    return {
      type: 'DEV TOOLS / CLI',
      icon: '🛠️',
      bg1: '#041d14', bg2: '#083a27', bg3: '#010d08',
      accent1: '#34d399', accent2: '#059669',
      badgeBg: 'rgba(5, 150, 105, 0.25)', badgeBorder: '#10b981',
      glow: '#10b981',
      stripe: '#10b981',
      price: '¥80万〜¥200万',
      subtext: '開発者生産性爆上げ・業務自動化ツール'
    };
  } else if (/web|html|ui|frontend|app|music|media/i.test(text)) {
    return {
      type: 'MODERN WEB / UI',
      icon: '🌐',
      bg1: '#051b26', bg2: '#0a3042', bg3: '#020b10',
      accent1: '#22d3ee', accent2: '#0891b2',
      badgeBg: 'rgba(8, 145, 178, 0.25)', badgeBorder: '#06b6d4',
      glow: '#06b6d4',
      stripe: '#06b6d4',
      price: '¥80万〜¥220万',
      subtext: '次世代Webフロント・自社SaaS構築'
    };
  } else {
    return {
      type: 'HIGH-TICKET OSS',
      icon: '⚡',
      bg1: '#1f1604', bg2: '#382806', bg3: '#0a0701',
      accent1: '#facc15', accent2: '#ca8a04',
      badgeBg: 'rgba(202, 138, 4, 0.25)', badgeBorder: '#eab308',
      glow: '#eab308',
      stripe: '#eab308',
      price: '¥100万〜¥300万',
      subtext: '受託開発提案・商用マネタイズ実践'
    };
  }
}

export function generateOgCardForPost(postData) {
  const { slug, title, stars, tags, desc } = postData;
  const shortTitle = escapeXml(title.split(' - ')[0].split(':')[0].trim());
  const starCount = stars ? `★ ${stars.toLocaleString()}` : '急上昇';
  const tagList = Array.isArray(tags) ? tags.slice(0, 3) : ['OSS', 'Tech'];
  const safeDesc = escapeXml((desc || '').slice(0, 68) + '...');

  const theme = getThemeByTags(tags, title, desc);
  const monogram = shortTitle.slice(0, 2).toUpperCase();

  // タイトル文字数に応じた動的フォントサイズ調整
  let titleFontSize = 64;
  if (shortTitle.length > 18) titleFontSize = 48;
  if (shortTitle.length > 26) titleFontSize = 40;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <!-- ダイナミック・オーロラグラデーション背景 -->
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.bg1}" />
      <stop offset="50%" stop-color="${theme.bg2}" />
      <stop offset="100%" stop-color="${theme.bg3}" />
    </linearGradient>

    <!-- テーマ別アクセントグラデーション -->
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${theme.accent1}" />
      <stop offset="100%" stop-color="${theme.accent2}" />
    </linearGradient>

    <!-- ゴールドスターグラデーション -->
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>

    <!-- オーロラグロー効果 -->
    <radialGradient id="glowTop" cx="80%" cy="15%" r="65%">
      <stop offset="0%" stop-color="${theme.glow}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>
    <radialGradient id="glowBottom" cx="20%" cy="85%" r="55%">
      <stop offset="0%" stop-color="${theme.accent2}" stop-opacity="0.25" />
      <stop offset="100%" stop-color="transparent" />
    </radialGradient>

    <!-- クロップ用シャドウフィルタ -->
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect width="1200" height="630" fill="url(#glowTop)" />
  <rect width="1200" height="630" fill="url(#glowBottom)" />

  <!-- 外枠ネオンストローク（高級感・ブランドフレーム） -->
  <rect x="20" y="20" width="1160" height="590" rx="16" fill="none" stroke="${theme.badgeBorder}" stroke-width="1.5" stroke-opacity="0.4" />

  <!-- ハイテク背景グリッド -->
  <g opacity="0.07" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="126" x2="1200" y2="126" />
    <line x1="0" y1="252" x2="1200" y2="252" />
    <line x1="0" y1="378" x2="1200" y2="378" />
    <line x1="0" y1="504" x2="1200" y2="504" />
    <line x1="200" y1="0" x2="200" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="800" y1="0" x2="800" y2="630" />
    <line x1="1000" y1="0" x2="1000" y2="630" />
  </g>

  <!-- ヘッダー行: ブランドバッジ ＆ カテゴリ -->
  <g transform="translate(60, 55)">
    <rect width="360" height="42" rx="21" fill="${theme.badgeBg}" stroke="${theme.badgeBorder}" stroke-width="1.4" />
    <text x="180" y="26" fill="${theme.accent1}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="800" text-anchor="middle" letter-spacing="1.2">
      ⚡ AUTO TECH RADAR ｜ ${theme.type}
    </text>
  </g>

  <!-- ヘッダー右: ゴールドスターメガバッジ -->
  <g transform="translate(930, 55)">
    <rect width="210" height="42" rx="21" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.4" />
    <text x="105" y="27" fill="#fbbf24" font-family="'JetBrains Mono', monospace, sans-serif" font-size="18" font-weight="900" text-anchor="middle">${starCount}</text>
  </g>

  <!-- 巨大テックモノグラム・3Dシンボルブロック（視覚的アイキャッチ） -->
  <g transform="translate(60, 140)">
    <rect width="110" height="110" rx="22" fill="#0d1117" stroke="${theme.accent1}" stroke-width="2.5" filter="url(#cardShadow)" />
    <text x="55" y="58" font-size="40" text-anchor="middle" dominant-baseline="central">${theme.icon}</text>
    <text x="55" y="94" fill="${theme.accent1}" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" text-anchor="middle">${monogram}</text>
  </g>

  <!-- メインタイトル（リポジトリ名） -->
  <g transform="translate(195, 175)">
    <text x="0" y="0" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${titleFontSize}" font-weight="900" letter-spacing="-0.5">
      ${shortTitle}
    </text>
    <text x="0" y="44" fill="url(#accent)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="25" font-weight="800">
      海外急上昇OSS 徹底解剖 ＆ 商用手順書
    </text>
  </g>

  <!-- 【超高視認性】キラー帯（実績者が絶対に使う注目座布団バナー） -->
  <g transform="translate(60, 285)">
    <rect width="1080" height="64" rx="10" fill="${theme.badgeBg}" stroke="${theme.badgeBorder}" stroke-width="1.5" />
    <rect x="0" y="0" width="8" height="64" rx="4" fill="${theme.accent1}" />
    <text x="30" y="40" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="900">
      💰 想定受託単価: <tspan fill="${theme.accent1}">${theme.price}</tspan> ｜ <tspan fill="#e2e8f0" font-weight="600">${theme.subtext}</tspan>
    </text>
  </g>

  <!-- リポジトリ概要（抜粋） -->
  <g transform="translate(60, 395)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="500">
      ${safeDesc}
    </text>
  </g>

  <!-- フッター実績プルーフバッジ群 -->
  <g transform="translate(60, 480)">
    <!-- バッジ 1: 商用SaaS活用手順 -->
    <rect x="0" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="${theme.accent1}" stroke-width="1.2" />
    <text x="130" y="31" fill="${theme.accent1}" font-family="-apple-system, sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ 商用SaaS化・構築手順付</text>

    <!-- バッジ 2: 社内稟議テンプレ -->
    <rect x="280" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="#3b82f6" stroke-width="1.2" />
    <text x="410" y="31" fill="#93c5fd" font-family="-apple-system, sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ 社内稟議・提案書ドラフト</text>

    <!-- バッジ 3: 技術タグ -->
    <rect x="560" y="0" width="280" height="50" rx="10" fill="#0d1117" stroke="#374151" stroke-width="1.2" />
    <text x="700" y="31" fill="#cbd5e1" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="700" text-anchor="middle">${tagList.join(' ｜ ')}</text>

    <!-- バッジ 4: PRO限定 -->
    <rect x="860" y="0" width="220" height="50" rx="10" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.2" />
    <text x="970" y="31" fill="#fbbf24" font-family="-apple-system, sans-serif" font-size="16" font-weight="800" text-anchor="middle">🔒 完全保存版 PRO</text>
  </g>
</svg>`;

  const outPath = path.join(ogpDir, `${slug}.svg`);
  fs.writeFileSync(outPath, svgContent, 'utf8');

  // PNGサムネイルの自動生成（note見出し画像用: 1200x630）
  const pngPath = path.join(ogpDir, `${slug}.png`);
  try {
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'google-chrome',
      'chromium',
      'chromium-browser'
    ];
    const chromeBin = chromeCandidates.find(c => fs.existsSync(c)) || 'google-chrome';
    execSync(`"${chromeBin}" --headless --disable-gpu --no-sandbox --screenshot="${pngPath}" --window-size=1200,630 "${outPath}"`, { stdio: 'ignore' });
  } catch (e) {
    // Chromeが使えない環境でもエラーで中断しないフェイルセーフ設計
  }

  return `/auto-tech-radar/ogp/${slug}.svg`;
}

// 全記事に対して実行
if (process.argv[1] && process.argv[1].endsWith('generate_og_cards.mjs')) {
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
  console.log(`全 ${files.length} 本のOGPカード ＆ サムネイルPNGを生成中...`);

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

  console.log('✓ 全OGPカード（SVG ＆ note用PNGサムネイル）の生成が完了しました！');
}
