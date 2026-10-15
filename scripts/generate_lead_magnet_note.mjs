import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  return outputPath;
}

// 直接実行された場合
if (process.argv[1] && process.argv[1].endsWith('generate_lead_magnet_note.mjs')) {
  generateLeadMagnetNote();
}
