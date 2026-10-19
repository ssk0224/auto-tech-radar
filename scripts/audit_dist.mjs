import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');

console.log('===============================================================================');
console.log('🔍 E2E レンダリング後 HTML・リンク完全性 総合監査 (Post-Build Dist Audit Gate)');
console.log('===============================================================================\n');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist/ ディレクトリが存在しません。astro build を先に実行してください。');
  process.exit(1);
}

function getAllHtmlFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getAllHtmlFiles(distDir);
console.log(`▶ 全 ${htmlFiles.length} 件の静的生成HTMLをディープスキャン中...\n`);

let errorCount = 0;
let checkedLinksCount = 0;

for (const filePath of htmlFiles) {
  const relPath = path.relative(distDir, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf8');

  // 1. 二重プレフィックス欠陥チェック (/auto-tech-radar/auto-tech-radar/)
  if (html.includes('/auto-tech-radar/auto-tech-radar/')) {
    console.error(`  ❌ [DUPLICATE PATH] ${relPath}: 二重プレフィックス /auto-tech-radar/auto-tech-radar/ が検出されました`);
    errorCount++;
  }

  // 2. undefined / null / NaN / [object Object] の混入チェック
  const badPatterns = [
    /href="[^"]*undefined[^"]*"/,
    /href="[^"]*null[^"]*"/,
    /href="[^"]*\[object%20Object\][^"]*"/,
    /src="[^"]*undefined[^"]*"/,
    /src="[^"]*null[^"]*"/
  ];
  for (const bp of badPatterns) {
    const match = html.match(bp);
    if (match) {
      console.error(`  ❌ [CORRUPTED URL] ${relPath}: 不正なリンク・リソースが検出されました: ${match[0]}`);
      errorCount++;
    }
  }

  // 3. og:url の存在チェック
  if (!html.includes('<meta property="og:url"')) {
    console.error(`  ❌ [MISSING OG:URL] ${relPath}: <meta property="og:url"> が未設定です`);
    errorCount++;
  }

  // 4. 内部リンク実在性チェック (404リンク切れの完全撲滅)
  const hrefMatches = html.matchAll(/href="(\/auto-tech-radar\/[^"#?]+)"/g);
  for (const match of hrefMatches) {
    checkedLinksCount++;
    const linkPath = match[1];
    // '/auto-tech-radar/' を取り除いて dist からの相対パスに変換
    let localPath = linkPath.replace(/^\/auto-tech-radar\//, '');
    if (localPath.endsWith('/')) {
      localPath += 'index.html';
    } else if (!path.extname(localPath)) {
      localPath += '/index.html';
    }

    const expectedDiskFile = path.join(distDir, localPath);
    if (!fs.existsSync(expectedDiskFile)) {
      console.error(`  ❌ [404 DEAD LINK] ${relPath} 内のリンク ${linkPath} に対応するファイルが存在しません (${localPath})`);
      errorCount++;
    }
  }
}

// 5. お問い合わせページ (contact) の堅牢性チェック
const contactDist = path.join(distDir, 'contact', 'index.html');
if (fs.existsSync(contactDist)) {
  const contactHtml = fs.readFileSync(contactDist, 'utf8');
  if (!contactHtml.includes('_captcha') || !contactHtml.includes('_replyto')) {
    console.error('  ❌ contact/index.html に _captcha または _replyto が不足しています');
    errorCount++;
  } else {
    console.log('  ✓ contact フォーム堅牢性: FormSubmit _captcha, _replyto 正常稼働');
  }
}

console.log(`\n▶ スキャン完了: 総リンク検査数 ${checkedLinksCount} 件`);

if (errorCount === 0) {
  console.log('===============================================================================');
  console.log('🎉 E2E Dist 総合監査結果: ALL PASS (欠陥ゼロ・完全性100%合格)');
  console.log('===============================================================================\n');
  process.exit(0);
} else {
  console.error('===============================================================================');
  console.error(`❌ E2E Dist 総合監査結果: FAIL (欠陥 ${errorCount} 件が検出されました)`);
  console.error('===============================================================================\n');
  process.exit(1);
}
