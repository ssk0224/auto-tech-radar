import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderPngFromSvg } from './generate_og_cards.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { jstDate } from '../src/utils/dates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const noteDir = path.join(rootDir, 'note_drafts');

if (!fs.existsSync(noteDir)) fs.mkdirSync(noteDir, { recursive: true });

function getTopRepos() {
  if (!fs.existsSync(radarDir)) return [];
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));

  const repos = [];
  for (const f of files) {
    const slug = f.replace('.md', '');
    if (isNoise(slug)) continue;

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

    // スター数から受託単価を決める根拠は無いため、単価は載せない（カテゴリはタグの先頭）
    let category = tags[0] || 'AI / OSS';

    repos.push({
      slug,
      title: title.split(' - ')[0].split(':')[0].trim(),
      desc,
      category,
      stars,
      repoUrl
    });
  }

  return repos.sort((a, b) => b.stars - a.stars);
}

export function generateLeadMagnetNote() {
  const repos = getTopRepos().slice(0, 15);
  const today = jstDate();

  let md = `# 海外で注目を集めるオープンソース15選 早見表（${today} 時点・GitHub スター数順）\n\n`;

  md += `## はじめに\n\n`;
  md += `Auto Tech Radar が毎朝 GitHub から収集し、README などの公開情報をもとに解説してきたオープンソースのうち、スター数の多い15件を一覧にしました。\n\n`;
  md += `各プロジェクトの概要は README の説明文の抜粋です。ライセンスや動作環境はプロジェクトごとに異なるため、導入前に必ず公式リポジトリでご確認ください。\n\n`;
  md += `技術リサーチや社内での検討の下調べにご活用ください（**「スキ」「保存」推奨 📌**）。\n\n`;

  md += `--- \n\n`;
  md += `## 📊 早見表\n\n`;
  md += `| プロジェクト名 | カテゴリ / 言語 | GitHub Stars | 概要 | 詳細レポート |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- |\n`;

  repos.forEach(r => {
    const starStr = r.stars > 0 ? `⭐ ${r.stars.toLocaleString()}` : '—';
    const cleanDesc = r.desc.length > 30 ? r.desc.slice(0, 30) + '...' : r.desc;
    md += `| **${r.title}** | ${r.category} | ${starStr} | ${cleanDesc} | [詳細解説 →](https://ssk0224.github.io/auto-tech-radar/radar/${r.slug}/) |\n`;
  });

  md += `\n--- \n\n`;
  md += `## 🔎 15件の概要\n\n`;

  repos.forEach((r, idx) => {
    const starStr = r.stars > 0 ? `★ ${r.stars.toLocaleString()}` : '—';
    md += `### ${idx + 1}. ${r.title}（${starStr} / ${r.category}）\n\n`;
    md += `- **プロジェクト概要**: ${r.desc}\n`;
    if (r.repoUrl) md += `- **公式リポジトリ**: ${r.repoUrl}\n`;
    md += `\n👉 **[「${r.title}」のアーキテクチャ解説（無料）はこちら →](https://ssk0224.github.io/auto-tech-radar/radar/${r.slug}/)**\n\n`;
    md += `----\n\n`;
  });

  md += `## 💼 導入支援のご相談\n\n`;
  md += `上記のようなOSSを使った社内向けシステムの構築・導入支援のご相談を受け付けています。内容・お見積もりはご相談のうえご案内します。\n\n`;
  md += `👉 **[お問い合わせ（/contact/）](https://ssk0224.github.io/auto-tech-radar/contact/)**\n\n`;

  md += `--- \n\n`;
  md += `## 🎁 【note公式メンバーシップのご案内】\n\n`;
  md += `Auto Tech Radar noteメンバーシップ（月額1,980円）では、\n`;
  md += `メンバーシップ特典に追加された有料記事（導入提案書テンプレート・工数見積表・公式READMEに基づく導入手順など）を読むことができます。\n\n`;
  md += `👉 **[note公式メンバーシップを見る](https://note.com/vast_ixora7005)**\n\n`;

  md += `--- \n`;
  md += `**【推奨ハッシュタグ】**\n`;
  md += `#AI #OSS #オープンソース #プログラミング #エンジニア #社内DX #GitHub #最新技術\n`;

  const outputPath = path.join(noteDir, 'LEAD_MAGNET_CHEAT_SHEET.md');
  fs.writeFileSync(outputPath, md, 'utf8');
  console.log(`✓ note無料集客用 特大リードマグネット原稿を生成しました: ${outputPath}`);

  // 専用アイキャッチ画像の生成
  generateLeadMagnetOgCard();

  return outputPath;
}

export function generateLeadMagnetOgCard() {
  const today = jstDate();
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
    <text x="360" y="26" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="900" text-anchor="middle">⭐ スター数順 15件</text>

    <!-- 完全無料公開バッジ -->
    <rect x="510" y="0" width="160" height="42" rx="21" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" stroke-width="1.5" />
    <text x="590" y="26" fill="#4ade80" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="16" font-weight="900" text-anchor="middle">🎁 無料</text>
  </g>

  <!-- メインタイトル -->
  <g transform="translate(60, 150)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="24" font-weight="700" letter-spacing="2">
      【${today} 時点】
    </text>
    <text x="0" y="60" fill="url(#cyanGrad)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="54" font-weight="900" letter-spacing="-0.5">
      海外急上昇オープンソース15選
    </text>
    <text x="0" y="115" fill="#f8fafc" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="36" font-weight="800">
      GitHub スター数順の早見表
    </text>
  </g>

  <!-- 内容の帯（記事に実際に含まれるものだけを書く） -->
  <g transform="translate(60, 340)">
    <rect width="1080" height="74" rx="14" fill="rgba(15, 23, 42, 0.8)" stroke="#38bdf8" stroke-width="1.8" />
    <rect x="0" y="0" width="12" height="74" rx="6" fill="url(#cyanGrad)" />
    <text x="36" y="47" fill="#ffffff" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="24" font-weight="900">
      📖 README ベースの概要 ｜ <tspan fill="#e2e8f0" font-weight="700">AIエージェント・ローカルLLM・開発ツール</tspan>
    </text>
  </g>

  <!-- サブ説明文 -->
  <g transform="translate(60, 465)">
    <text x="0" y="0" fill="#94a3b8" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Hiragino Sans', 'Meiryo', sans-serif" font-size="22" font-weight="500">
      各プロジェクトの公式リポジトリと、無料のアーキテクチャ解説記事へのリンク付き。
    </text>
  </g>

  <!-- フッターバッジ群 -->
  <g transform="translate(60, 520)">
    <!-- バッジ 1 -->
    <rect x="0" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#38bdf8" stroke-width="1.4" />
    <text x="125" y="32" fill="#38bdf8" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ スター数順の早見表</text>

    <!-- バッジ 2 -->
    <rect x="270" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#818cf8" stroke-width="1.4" />
    <text x="395" y="32" fill="#a5b4fc" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ 公式リポジトリ付</text>

    <!-- バッジ 3 -->
    <rect x="540" y="0" width="250" height="52" rx="10" fill="#0b1329" stroke="#34d399" stroke-width="1.4" />
    <text x="665" y="32" fill="#6ee7b7" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="800" text-anchor="middle">✓ 無料の解説記事へ</text>

    <!-- バッジ 4 -->
    <rect x="810" y="0" width="270" height="52" rx="10" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" stroke-width="1.4" />
    <text x="945" y="32" fill="#fbbf24" font-family="-apple-system, BlinkMacSystemFont, 'Meiryo', sans-serif" font-size="17" font-weight="900" text-anchor="middle">📌 保存・ブクマ推奨</text>
  </g>
</svg>`;

  const svgPath = path.join(ogpDir, 'LEAD_MAGNET_CHEAT_SHEET.svg');
  const pngPath = path.join(ogpDir, 'LEAD_MAGNET_CHEAT_SHEET.png');

  fs.writeFileSync(svgPath, svgContent, 'utf8');

  // PNG は記事の OGP 画像と同じ方法で作る（元の SVG のハッシュを PNG に記録する。tests/og_text.test.mjs）
  if (renderPngFromSvg(svgPath, pngPath)) console.log(`✓ リードマグネット専用アイキャッチPNGを生成しました: ${pngPath}`);
}

// 直接実行された場合
if (process.argv[1] && process.argv[1].endsWith('generate_lead_magnet_note.mjs')) {
  generateLeadMagnetNote();
}
