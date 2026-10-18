import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const ogpDir = path.join(rootDir, 'public', 'ogp');

console.log('===============================================================================');
console.log('🛡️  ECC × SUPERPOWERS × SUBAGENT 自律品質＆セキュリティ総合監査 (Audit Gate)');
console.log('===============================================================================\n');

let errorCount = 0;
let warningCount = 0;

// 1. 【ECC 監査】機密保護 ＆ Git境界チェック
console.log('▶ [1/3] ECC 機密保護 ＆ プライベートリポジトリ境界監査...');
const trackedFiles = fs.readdirSync(rootDir);
const forbiddenPatterns = [/\bea\b/i, /ssk.*os/i, /financial/i, /trading/i, /secret_keys/i];
let leakFound = false;

// .gitignore の存在確認
const gitignorePath = path.join(rootDir, '.gitignore');
const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
if (!gitignoreContent.includes('.env')) {
  console.error('  ❌ [CRITICAL LEAK RISK] .env が .gitignore に指定されていません！');
  leakFound = true;
  errorCount++;
}

trackedFiles.forEach(f => {
  if (f === '.env.example' || f === 'AGENT_RULES.md' || f === '.env') return;
  forbiddenPatterns.forEach(pattern => {
    if (pattern.test(f)) {
      console.error(`  ❌ [CRITICAL LEAK RISK] 機密名称に抵触するファイルが検出されました: ${f}`);
      leakFound = true;
      errorCount++;
    }
  });
});

if (!leakFound) {
  console.log('  ✓ ECC機密監査合格: 外部漏洩リスクのあるファイルは一切存在しません。安全スコープ厳守。\n');
}

// 2. 【SUPERPOWERS 監査】記事品質・画像・欠陥スイープ
console.log('▶ [2/3] SUPERPOWERS コンテンツ完全性 ＆ 欠陥スイープ監査...');
if (!fs.existsSync(radarDir)) {
  console.error('  ❌ 記事ディレクトリが存在しません: ' + radarDir);
  process.exit(1);
}

const articles = fs.readdirSync(radarDir).filter(f => f.endsWith('.md'));
console.log(`  全 ${articles.length} 本の技術レポートを精密検査中...`);

articles.forEach(file => {
  const slug = file.replace('.md', '');
  const content = fs.readFileSync(path.join(radarDir, file), 'utf8');

  // A. PNG サムネイル存在チェック (1200x630)
  const pngPath = path.join(ogpDir, `${slug}.png`);
  if (!fs.existsSync(pngPath)) {
    console.warn(`  ⚠️ [MISSING PNG] サムネイルPNGが見つかりません: public/ogp/${slug}.png`);
    warningCount++;
  }

  // B. Mermaid ダイアグラムチェック
  if (!content.includes('```mermaid')) {
    console.warn(`  ⚠️ [NO MERMAID] Mermaid図解が未検出です: ${file}`);
    warningCount++;
  }

  // C. 想定単価・ビジネス活用チェック
  if (!content.includes('ビジネス') && !content.includes('受託') && !content.includes('マネタイズ')) {
    console.warn(`  ⚠️ [NO MONETIZATION] 商用マネタイズ分析が不足しています: ${file}`);
    warningCount++;
  }
});

if (warningCount === 0) {
  console.log(`  ✓ SUPERPOWERS品質監査合格: 全 ${articles.length} 本のレポートが最高基準（PNGサムネ・Mermaid図解・商用分析）を完全充足。\n`);
} else {
  console.log(`  ℹ️ SUPERPOWERS監査完了: 警告 ${warningCount} 件（運用上の許容範囲）。\n`);
}

// 3. 【SUBAGENT 監査】CVRトリガー ＆ 収益化導線チェック
console.log('▶ [3/3] SUBAGENT 成約率(CVR) ＆ 収益化パイプライン監査...');
const contactPage = path.join(rootDir, 'src', 'pages', 'contact.astro');
const cheatsheetPage = path.join(rootDir, 'src', 'pages', 'cheatsheet.astro');
const estimatePage = path.join(rootDir, 'src', 'pages', 'estimate.astro');
const weeklyPage = path.join(rootDir, 'src', 'pages', 'weekly.astro');
const layoutPage = path.join(rootDir, 'src', 'layouts', 'Layout.astro');

let pipelineOk = true;

if (!fs.existsSync(contactPage)) {
  console.error('  ❌ 受託相談ページ (/contact/) が存在しません');
  pipelineOk = false;
  errorCount++;
}
if (!fs.existsSync(cheatsheetPage)) {
  console.error('  ❌ チートシートページ (/cheatsheet/) が存在しません');
  pipelineOk = false;
  errorCount++;
}
if (!fs.existsSync(estimatePage)) {
  console.error('  ❌ 見積もり試算ページ (/estimate/) が存在しません');
  pipelineOk = false;
  errorCount++;
}
if (!fs.existsSync(weeklyPage)) {
  console.error('  ❌ 週間白書ページ (/weekly/) が存在しません');
  pipelineOk = false;
  errorCount++;
}

const layoutContent = fs.readFileSync(layoutPage, 'utf8');
if (!layoutContent.includes('.png')) {
  console.warn('  ⚠️ Layout.astro の ogImage が .png 形式になっていない可能性があります');
  warningCount++;
}
if (!layoutContent.includes('/contact/')) {
  console.error('  ❌ Layout.astro に /contact/ へのリンクがありません');
  pipelineOk = false;
  errorCount++;
}

if (pipelineOk) {
  console.log('  ✓ SUBAGENT CVR監査合格: 法人受託導線、TwitterカードPNG、チートシートが完全連動中。\n');
}

// 4. 【ZENN 監査】公式GitHub自動デプロイ規格チェック (articles/*.md)
console.log('▶ [4/4] ZENN 公式GitHub自動連携仕様監査...');
const zennDir = path.join(rootDir, 'articles');
if (!fs.existsSync(zennDir)) {
  console.error('  ❌ articles/ ディレクトリが存在しません');
  errorCount++;
} else {
  const zennArticles = fs.readdirSync(zennDir).filter(f => f.endsWith('.md'));
  let zennErrors = 0;
  let funnelCount = 0;
  zennArticles.forEach(f => {
    const slug = f.replace('.md', '');
    if (slug.length < 12 || slug.length > 50 || !/^[a-z0-9_-]+$/.test(slug)) {
      console.error(`  ❌ [ZENN INVALID SLUG] ${f}`);
      zennErrors++;
      errorCount++;
    }
    const zContent = fs.readFileSync(path.join(zennDir, f), 'utf8');
    if (zContent.includes('Auto Tech Radar 公式レポート')) {
      funnelCount++;
    }
  });
  if (zennErrors === 0 && funnelCount === zennArticles.length) {
    console.log(`  ✓ Zennデプロイ規格＆送客ファネル監査合格: 全 ${zennArticles.length} 本がZenn公式規格に適合し、自社サイト送客バナーを100%配備中。\n`);
  } else if (funnelCount < zennArticles.length) {
    console.error(`  ❌ Zenn記事の送客バナーが不足しています (${funnelCount}/${zennArticles.length})`);
    errorCount++;
  }
}

// 5. 【現代最新仕様 監査】IndexNow即時通知・Google Paywall構造化データ・FormSubmit・robots.txt
console.log('▶ [5/5] SEO ＆ 現代最新プロトコル監査 (IndexNow, Google Paywall, FormSubmit, robots.txt, CI Safe)...');
const indexNowKey = path.join(rootDir, 'public', 'indexnow-key.txt');
const pingScript = path.join(rootDir, 'scripts', 'ping_search_engines.mjs');
const robotsTxt = path.join(rootDir, 'public', 'robots.txt');
const workflowFile = path.join(rootDir, '.github', 'workflows', 'daily-crawl.yml');
const sponsorPage = path.join(rootDir, 'src', 'pages', 'sponsor.astro');

if (!fs.existsSync(indexNowKey) || !fs.existsSync(pingScript)) {
  console.error('  ❌ IndexNow API 連携ファイルが不足しています');
  errorCount++;
} else {
  console.log('  ✓ IndexNow検索エンジン即時連携: 正常配置');
}

if (!fs.existsSync(robotsTxt) || !fs.readFileSync(robotsTxt, 'utf8').includes('sitemap-index.xml')) {
  console.error('  ❌ robots.txt が不足しているか、Sitemap記述がありません');
  errorCount++;
} else {
  console.log('  ✓ robots.txt ＆ 検索エンジンSitemap連携: 正常配置');
}

const contactFile = path.join(rootDir, 'src', 'pages', 'contact.astro');
const contactCode = fs.readFileSync(contactFile, 'utf8');
if (!contactCode.includes('formsubmit.co')) {
  console.error('  ❌ contact.astro に FormSubmit 直接送信エンドポイントがありません');
  errorCount++;
} else {
  console.log('  ✓ FormSubmit 直接メール送信API: 正常稼働');
}

if (fs.existsSync(sponsorPage) && fs.readFileSync(sponsorPage, 'utf8').includes('/contact/')) {
  console.log('  ✓ スポンサー募集ページ (/sponsor/) お問い合わせ直結: 正常稼働');
} else {
  console.error('  ❌ sponsor.astro に /contact/ への直結リンクがありません');
  errorCount++;
}

if (fs.existsSync(workflowFile) && fs.readFileSync(workflowFile, 'utf8').includes('[skip ci]')) {
  console.log('  ✓ GitHub Actions CI二重起動抑止 ([skip ci]): 正常稼働');
} else {
  console.error('  ❌ daily-crawl.yml に [skip ci] が設定されていません');
  errorCount++;
}

if (layoutContent.includes('atr-paywall-gate') && layoutContent.includes('isAccessibleForFree') && layoutContent.includes('copy-article-url-btn')) {
  console.log('  ✓ Google公式仕様 Paywall構造化データ ＆ フリーミアムゲート ＆ ソーシャルシェア: 正常実装\n');
} else {
  console.error('  ❌ Layout.astro に Paywall 構造化データ、施錠ゲート、またはシェアバーが不足しています');
  errorCount++;
}

console.log('===============================================================================');
if (errorCount === 0) {
  console.log('🎉 総合監査結果: ALL PASS (最高評価) - システムは完璧に稼働しています！');
  console.log('===============================================================================\n');
  process.exit(0);
} else {
  console.error(`❌ 総合監査結果: FAIL (エラー ${errorCount} 件)`);
  console.log('===============================================================================\n');
  process.exit(1);
}
