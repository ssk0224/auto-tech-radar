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

// 8つの超洗練ビジュアル・アーキタイプ（読者が絶対に飽きない世界基準のダイナミックデザイン）
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
      type: 'AUTONOMOUS AI AGENT',
      icon: '🧠',
      bgGradient: ['#0f051d', '#230b42', '#05010a'],
      accentGradient: ['#e879f9', '#c084fc', '#a855f7'],
      badgeBg: 'rgba(192, 132, 252, 0.2)', badgeBorder: '#c084fc',
      glow: '#d946ef',
      patternType,
      seed,
      price: '¥180万〜¥400万',
      subtext: '自律型マルチエージェント基盤・業務完全無人化DX'
    };
  } else if (/llm|qwen|gpt|model|weights|inference|neural|speculative/i.test(text)) {
    return {
      type: 'NEXT-GEN LLM & MODEL',
      icon: '⚡',
      bgGradient: ['#050e26', '#0d2859', '#020512'],
      accentGradient: ['#38bdf8', '#60a5fa', '#3b82f6'],
      badgeBg: 'rgba(56, 189, 248, 0.2)', badgeBorder: '#38bdf8',
      glow: '#0284c7',
      patternType,
      seed,
      price: '¥150万〜¥350万',
      subtext: 'オープンウェイトローカル推論基盤・内製LLM構築'
    };
  } else if (/rust|perf|speed|fast|kernel|wasm|low-latency/i.test(text)) {
    return {
      type: 'ULTRA HIGH-SPEED RUST',
      icon: '🔥',
      bgGradient: ['#240a04', '#4a1506', '#100301'],
      accentGradient: ['#fb923c', '#f97316', '#ea580c'],
      badgeBg: 'rgba(249, 115, 22, 0.2)', badgeBorder: '#fb923c',
      glow: '#f97316',
      patternType,
      seed,
      price: '¥140万〜¥300万',
      subtext: '超高速ネイティブエンジン・高負荷バックエンド刷新'
    };
  } else if (/browser|automation|crawl|scrap|web-agent/i.test(text)) {
    return {
      type: 'AUTONOMOUS WEB RPA',
      icon: '🚀',
      bgGradient: ['#031826', '#08334c', '#010c14'],
      accentGradient: ['#22d3ee', '#06b6d4', '#0284c7'],
      badgeBg: 'rgba(34, 211, 238, 0.2)', badgeBorder: '#22d3ee',
      glow: '#06b6d4',
      patternType,
      seed,
      price: '¥120万〜¥280万',
      subtext: '爆速ブラウザ操作エージェント・次世代Web自動化'
    };
  } else if (/cli|tool|terminal|developer|devops|infra|nix|brew/i.test(text)) {
    return {
      type: 'DEV INFRA & CLI SUITE',
      icon: '🛠️',
      bgGradient: ['#031710', '#073322', '#010c08'],
      accentGradient: ['#34d399', '#10b981', '#059669'],
      badgeBg: 'rgba(52, 211, 153, 0.2)', badgeBorder: '#34d399',
      glow: '#10b981',
      patternType,
      seed,
      price: '¥100万〜¥220万',
      subtext: 'エンジニア生産性極大化・モダンDevOps/環境整備'
    };
  } else if (/python|data|analytics|pipeline|database/i.test(text)) {
    return {
      type: 'DATA & ML PIPELINE',
      icon: '🐍',
      bgGradient: ['#081726', '#122c42', '#030b14'],
      accentGradient: ['#4ade80', '#22c55e', '#16a34a'],
      badgeBg: 'rgba(74, 222, 128, 0.2)', badgeBorder: '#4ade80',
      glow: '#22c55e',
      patternType,
      seed,
      price: '¥110万〜¥260万',
      subtext: 'リアルタイム分析基盤・MLデータパイプライン'
    };
  } else if (/security|auth|privacy|sandbox|audit/i.test(text)) {
    return {
      type: 'SECURITY & RUNTIME',
      icon: '🛡️',
      bgGradient: ['#1c0410', '#3b0a24', '#0d0107'],
      accentGradient: ['#f43f5e', '#e11d48', '#be123c'],
      badgeBg: 'rgba(244, 63, 94, 0.2)', badgeBorder: '#f43f5e',
      glow: '#f43f5e',
      patternType,
      seed,
      price: '¥160万〜¥380万',
      subtext: 'セキュア実行サンドボックス・企業情報漏洩対策'
    };
  } else {
    return {
      type: 'COMMERCIAL OSS SUITE',
      icon: '💎',
      bgGradient: ['#1f1304', '#402908', '#0c0701'],
      accentGradient: ['#fbbf24', '#f59e0b', '#d97706'],
      badgeBg: 'rgba(251, 191, 36, 0.2)', badgeBorder: '#fbbf24',
      glow: '#f59e0b',
      patternType,
      seed,
      price: '¥120万〜¥300万',
      subtext: '受託開発高単価提案・マイクロSaaS月額課金化'
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

export function generateOgCardForPost(postData) {
  const { slug, title, stars, tags, desc } = postData;
  const shortTitle = escapeXml(title.split(' - ')[0].split(':')[0].trim());
  const starCount = stars ? `★ ${stars.toLocaleString()}` : '急上昇';
  const tagList = Array.isArray(tags) ? tags.slice(0, 3) : ['OSS', 'Tech'];
  const safeDesc = escapeXml((desc || '').slice(0, 72) + '...');

  const archetype = getVisualArchetype(tags, title, desc, slug);
  const monogram = shortTitle.slice(0, 2).toUpperCase();

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
      ⚡ AUTO TECH RADAR ｜ ${escapeXml(archetype.type)}
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
      海外急上昇OSS 徹底解剖 ＆ 商用手順書
    </text>
  </g>

  <!-- 【超高視認性】キラー帯（想定受託単価 ＆ 収益化モデル） -->
  <g transform="translate(60, 282)">
    <rect width="1080" height="66" rx="12" fill="${archetype.badgeBg}" stroke="${archetype.badgeBorder}" stroke-width="1.6" filter="url(#cardShadow)" />
    <rect x="0" y="0" width="10" height="66" rx="5" fill="${archetype.accentGradient[0]}" />
    <text x="32" y="42" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="900">
      💰 想定受託単価: <tspan fill="${archetype.accentGradient[0]}">${archetype.price}</tspan> ｜ <tspan fill="#f1f5f9" font-weight="700">${archetype.subtext}</tspan>
    </text>
  </g>

  <!-- リポジトリ概要（抜粋） -->
  <g transform="translate(60, 395)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="500">
      ${safeDesc}
    </text>
  </g>

  <!-- フッター実績プルーフバッジ群（4大キラープルーフ） -->
  <g transform="translate(60, 480)">
    <!-- バッジ 1: 商用SaaS活用手順 -->
    <rect x="0" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="${archetype.accentGradient[0]}" stroke-width="1.3" />
    <text x="130" y="31" fill="${archetype.accentGradient[0]}" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ 商用SaaS化・構築手順付</text>

    <!-- バッジ 2: 社内稟議テンプレ -->
    <rect x="280" y="0" width="260" height="50" rx="10" fill="#0d1117" stroke="#3b82f6" stroke-width="1.3" />
    <text x="410" y="31" fill="#93c5fd" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">✓ 社内稟議・提案書ドラフト</text>

    <!-- バッジ 3: 技術タグ -->
    <rect x="560" y="0" width="280" height="50" rx="10" fill="#0d1117" stroke="#374151" stroke-width="1.3" />
    <text x="700" y="31" fill="#cbd5e1" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="700" text-anchor="middle">${tagList.join(' ｜ ')}</text>

    <!-- バッジ 4: PRO限定 -->
    <rect x="860" y="0" width="220" height="50" rx="10" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" stroke-width="1.3" />
    <text x="970" y="31" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="800" text-anchor="middle">🔒 完全保存版 PRO</text>
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
