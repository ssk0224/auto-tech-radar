import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const noteDir = path.join(rootDir, 'note_drafts');

if (!fs.existsSync(noteDir)) fs.mkdirSync(noteDir, { recursive: true });

// ノイズフィルター
const NOISE_FILTER_REGEX = /(index$|core$|cask$|nixpkgs|mediawiki|internship|cheatsheet)/i;

function getTopRepos() {
  if (!fs.existsSync(radarDir)) return [];
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));

  const repos = [];
  for (const f of files) {
    const slug = f.replace('.md', '');
    if (NOISE_FILTER_REGEX.test(slug)) continue;

    const content = fs.readFileSync(path.join(radarDir, f), 'utf8');
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) continue;

    const fm = fmMatch[1];
    let title = slug;
    let desc = '';
    let tags = [];
    let stars = 0;
    let repoUrl = '';

    const titleM = fm.match(/^title:\s*"?(.*?)"?$/m);
    if (titleM) title = titleM[1];
    const descM = fm.match(/^description:\s*"?(.*?)"?$/m);
    if (descM) desc = descM[1];
    const starsM = fm.match(/^stars:\s*(\d+)/m);
    if (starsM) stars = parseInt(starsM[1], 10);
    const tagsM = fm.match(/^tags:\s*\[(.*?)\]/m);
    if (tagsM) tags = tagsM[1].split(',').map(s => s.replace(/["'\s]/g, ''));
    const urlM = fm.match(/^repoUrl:\s*"?(.*?)"?$/m);
    if (urlM) repoUrl = urlM[1];

    // 単価やカテゴリの推定
    let category = tags[0] || 'AI / OSS';
    let priceRange = '¥100万〜¥250万';
    if (stars > 5000) priceRange = '¥150万〜¥350万';
    else if (stars < 1500) priceRange = '¥80万〜¥200万';

    repos.push({
      slug,
      title: title.split(' - ')[0].split(':')[0].trim(),
      desc,
      category,
      stars,
      priceRange,
      repoUrl
    });
  }

  return repos.sort((a, b) => b.stars - a.stars);
}

export function generateLeadMagnetNote() {
  const repos = getTopRepos().slice(0, 15);
  const today = new Date().toISOString().split('T')[0];

  let md = `# 【完全保存版】2026年最新・現場で即戦力になる「海外急上昇オープンソース15選」商用化チートシート（社内DX・受託開発・AI導入の決定版）\n\n`;

  md += `## はじめに：なぜ今、世界のトップ企業は「オープンソースのセルフホスト・商用化」に舵を切っているのか？\n\n`;
  md += `月額数万円〜数十万円を支払い続けている商用SaaS。API利用料が毎月跳ね上がるクラウドAIサービス。\n`;
  md += `2026年現在、シリコンバレーのテック企業や先進的な国内スタートアップは、**「急上昇中の高品質オープンソース（OSS）を自社クラウドへセルフホストし、内製化・自社DX基盤として運用する」** ことで、年間数百万円単位のコスト削減とデータセキュリティの完全保護を両立させています。\n\n`;
  md += `さらに受託開発やフリーランスエンジニアにとっても、これら急上昇OSSを活用した**「社内AI導入・DX支援パッケージ（案件単価80万〜250万円）」** は、今最も需要が高く利益率の高いドル箱領域です。\n\n`;
  md += `本記事では、世界中のGitHubで直近スター数が急増している厳選オープンソース15選を、**「商用化の狙い目」「想定受託単価」「競合SaaSとの比較」** の視点で完全網羅した【商用化チートシート】として完全無料公開します。\n\n`;
  md += `日々の技術リサーチや新規事業のネタ帳、クライアントへのDX提案資料としてぜひ末永くご活用ください（**「スキ」「保存」推奨 📌**）。\n\n`;

  md += `--- \n\n`;
  md += `## 📊 【全OSS横断】商用化・受託開発チートシート早見表\n\n`;
  md += `| プロジェクト名 | カテゴリ / 言語 | GitHub Stars | 想定受託単価 | 商用化・自社DXの狙い目 | 詳細レポート |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  repos.forEach(r => {
    const starStr = r.stars > 0 ? `⭐ ${r.stars.toLocaleString()}` : '急上昇中';
    const cleanDesc = r.desc.length > 30 ? r.desc.slice(0, 30) + '...' : r.desc;
    md += `| **${r.title}** | ${r.category} | ${starStr} | ${r.priceRange} | ${cleanDesc} | [詳細解説 →](https://ssk0224.github.io/auto-tech-radar/radar/${r.slug}/) |\n`;
  });

  md += `\n--- \n\n`;
  md += `## 🏆 厳選！注目急上昇OSS 15選の徹底解説\n\n`;

  repos.forEach((r, idx) => {
    const starStr = r.stars > 0 ? `★ ${r.stars.toLocaleString()}` : '急上昇中';
    md += `### ${idx + 1}. ${r.title}（${starStr} / ${r.category}）\n\n`;
    md += `- **プロジェクト概要**: ${r.desc}\n`;
    md += `- **想定受託単価**: ${r.priceRange}\n`;
    md += `- **商用化・SaaS代替の狙い目**:\n`;
    md += `  - 既存の高額課金SaaSからのリプレイスによる月額ランニングコスト削減\n`;
    md += `  - クライアント企業専用のセキュアなオンプレミス/プライベートクラウド構築受託\n`;
    md += `  - 自社マイクロSaaSへの機能組み込み・バックエンド活用\n\n`;
    md += `👉 **[「${r.title}」の深層アーキテクチャ解剖 ＆ 受託提案書・Dockerキット付き完全版はこちら →](https://ssk0224.github.io/auto-tech-radar/radar/${r.slug}/)**\n\n`;
    md += `----\n\n`;
  });

  md += `## 💼 法人向け受託開発 ＆ 自社AI導入支援について\n\n`;
  md += `Auto Tech Radar では、上記OSSを活用した以下のソリューションを提供しております：\n\n`;
  md += `- **社内専用AIエージェント・DX基盤の構築受託**（80万円〜250万円）\n`;
  md += `- **月額課金SaaSのセルフホスト化による脱課金コンサルティング**\n`;
  md += `- **技術顧問・PoC（概念実証）の超高速プロトタイピング**\n\n`;
  md += `受託開発のご相談やお見積もりのご依頼は、公式Webサイトよりお気軽にお問い合わせください：\n`;
  md += `👉 **[受託開発・導入支援の無料相談窓口（/contact/）](https://ssk0224.github.io/auto-tech-radar/contact/)**\n\n`;

  md += `--- \n\n`;
  md += `## 🎁 【note公式メンバーシップのご案内】\n\n`;
  md += `Auto Tech Radar noteメンバーシップ（月額1,980円）では、\n`;
  md += `各OSSの **「コピペで出せる社内DX提案書Markdown」「詳細工数・見積算出シミュレーション表」「本番即起動Docker Composeキット」「CTO説得想定問答」** を含む全有料レポート（総額20,000円以上）がすべて初月即時読み放題となります。\n\n`;
  md += `「最短で受託案件を獲得したい」「自社のAI内製化を最速で成功させたい」エンジニアや経営者の方は、ぜひご参加ください！\n\n`;
  md += `👉 **[note公式メンバーシップに参加する（初月読み放題）](https://note.com/vast_ixora7005)**\n\n`;

  md += `--- \n`;
  md += `**【推奨ハッシュタグ】**\n`;
  md += `#AI #OSS #オープンソース #プログラミング #エンジニア #受託開発 #社内DX #副業 #GitHub #最新技術\n`;

  const outputPath = path.join(noteDir, 'LEAD_MAGNET_CHEAT_SHEET.md');
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`✓ note無料集客用 特大リードマグネット原稿を生成しました: ${outputPath}`);

  // 専用アイキャッチ画像の生成
  generateLeadMagnetOgCard();

  return outputPath;
}

export function generateLeadMagnetOgCard() {
  const ogpDir = path.join(rootDir, 'public', 'ogp');
  if (!fs.existsSync(ogpDir)) fs.mkdirSync(ogpDir, { recursive: true });

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#040919" />
      <stop offset="50%" stop-color="#091b3a" />
      <stop offset="100%" stop-color="#020611" />
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#22d3ee" />
      <stop offset="100%" stop-color="#818cf8" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#f59e0b" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- 背景 -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />

  <!-- サイバーグリッドパターン -->
  <g opacity="0.08" stroke="#38bdf8" stroke-width="1">
    <line x1="0" y1="100" x2="1200" y2="100" />
    <line x1="0" y1="200" x2="1200" y2="200" />
    <line x1="0" y1="300" x2="1200" y2="300" />
    <line x1="0" y1="400" x2="1200" y2="400" />
    <line x1="0" y1="500" x2="1200" y2="500" />
    <line x1="200" y1="0" x2="200" y2="630" />
    <line x1="400" y1="0" x2="400" y2="630" />
    <line x1="600" y1="0" x2="600" y2="630" />
    <line x1="800" y1="0" x2="800" y2="630" />
    <line x1="1000" y1="0" x2="1000" y2="630" />
  </g>

  <!-- レーダーサークル装飾 -->
  <circle cx="1080" cy="120" r="180" fill="none" stroke="#38bdf8" stroke-width="1.5" opacity="0.15" />
  <circle cx="1080" cy="120" r="120" fill="none" stroke="#22d3ee" stroke-width="1" opacity="0.15" />
  <circle cx="1080" cy="120" r="60" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.15" />

  <!-- 上部ヘッダー（メディアブランド ＆ スターバッジ） -->
  <g transform="translate(60, 50)">
    <rect width="210" height="42" rx="21" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" stroke-width="1.5" />
    <circle cx="24" cy="21" r="6" fill="#38bdf8" filter="url(#glow)" />
    <text x="42" y="27" fill="#38bdf8" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" letter-spacing="1.5">AUTO TECH RADAR</text>

    <!-- 特大注目バッジ -->
    <rect x="230" y="0" width="260" height="42" rx="21" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.5" />
    <text x="360" y="26" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="900" text-anchor="middle">⭐ 累計200,000+ Stars 厳選</text>

    <!-- 完全無料公開バッジ -->
    <rect x="510" y="0" width="160" height="42" rx="21" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" stroke-width="1.5" />
    <text x="590" y="26" fill="#4ade80" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="900" text-anchor="middle">🎁 完全無料公開</text>
  </g>

  <!-- メインタイトル -->
  <g transform="translate(60, 150)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="24" font-weight="700" letter-spacing="2">
      【2026年最新 完全保存版】
    </text>
    <text x="0" y="60" fill="url(#cyanGrad)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="54" font-weight="900" letter-spacing="-0.5">
      海外急上昇オープンソース15選
    </text>
    <text x="0" y="115" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="36" font-weight="800">
      現場で即戦力になる商用化 ＆ 社内DXチートシート
    </text>
  </g>

  <!-- 想定単価・キラー帯 -->
  <g transform="translate(60, 340)">
    <rect width="1080" height="74" rx="14" fill="rgba(15, 23, 42, 0.8)" stroke="#38bdf8" stroke-width="1.8" />
    <rect x="0" y="0" width="12" height="74" rx="6" fill="url(#cyanGrad)" />
    <text x="36" y="47" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="24" font-weight="900">
      💰 想定受託単価: <tspan fill="#38bdf8">¥80万〜¥350万円</tspan> ｜ <tspan fill="#e2e8f0" font-weight="700">社内DX・AIエージェント・脱課金SaaS</tspan>
    </text>
  </g>

  <!-- サブ説明文 -->
  <g transform="translate(60, 465)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="500">
      世界中のGitHubから急上昇OSSを徹底厳選。アーキテクチャ図解・社内稟議提案書・見積内訳付き。
    </text>
  </g>

  <!-- フッター実績プルーフバッジ群 -->
  <g transform="translate(60, 520)">
    <!-- バッジ 1 -->
    <rect x="0" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#38bdf8" stroke-width="1.4" />
    <text x="125" y="32" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ 商用化チートシート</text>

    <!-- バッジ 2 -->
    <rect x="270" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#818cf8" stroke-width="1.4" />
    <text x="395" y="32" fill="#a5b4fc" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ 社内稟議テンプレ付</text>

    <!-- バッジ 3 -->
    <rect x="540" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#34d399" stroke-width="1.4" />
    <text x="665" y="32" fill="#6ee7b7" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ 想定受託単価一覧</text>

    <!-- バッジ 4 -->
    <rect x="810" y="0" width="270" height="52" rx="10" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.4" />
    <text x="945" y="32" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="900" text-anchor="middle">📌 保存・ブクマ推奨</text>
  </g>
</svg>`;

  const svgPath = path.join(ogpDir, 'LEAD_MAGNET_CHEAT_SHEET.svg');
  const pngPath = path.join(ogpDir, 'LEAD_MAGNET_CHEAT_SHEET.png');

  fs.writeFileSync(svgPath, svgContent, 'utf8');

  try {
    const chromeCandidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'google-chrome',
      'chromium',
      'chromium-browser'
    ];
    const chromeBin = chromeCandidates.find(c => fs.existsSync(c)) || 'google-chrome';
    execSync(`"${chromeBin}" --headless --disable-gpu --no-sandbox --screenshot="${pngPath}" --window-size=1200,630 "${svgPath}"`, { stdio: 'ignore' });
    console.log(`✓ リードマグネット専用アイキャッチPNGを生成しました: ${pngPath}`);
  } catch (e) {
    console.warn(`PNG生成スキップ: ${e.message}`);
  }
}

// 直接実行された場合
if (process.argv[1] && process.argv[1].endsWith('generate_lead_magnet_note.mjs')) {
  generateLeadMagnetNote();
}
