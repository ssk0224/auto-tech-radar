import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findProLeaks } from './utils/pro_boundary.mjs';
import { isNoise } from './utils/noise_filter.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 既定は dist/。テストでは別の出力先（astro build --outDir）を引数で渡して同じ監査を通す
const distDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..', 'dist');
const noteDraftsDir = path.resolve(__dirname, '..', 'note_drafts');
const noteUrls = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'note_urls.json'), 'utf8'));

// Astro がテキストを HTML に埋め込むときと同じエスケープ（有料版の項目名を配信 HTML の中で探すため）
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 記事ページの note 有料版の案内（Layout.astro の .note-offer）を確かめる。問題の説明の配列を返す（空なら合格）
function noteOfferProblems(html, slug) {
  const problems = [];
  const item = noteUrls[slug];
  const boxes = [...html.matchAll(/<aside\b[^>]*\bclass="note-offer\b[^"]*"[^>]*>[\s\S]*?<\/aside>/g)];
  const expected = item?.url ? 1 : 0;
  if (boxes.length !== expected) {
    problems.push(`note の販売有無（note_urls.json）と有料版の案内の数が一致しません（${boxes.length} 個、期待 ${expected} 個）`);
    return problems;
  }
  // 購入ボタンは案内の中の 1 つだけ（記事末尾の購入カード・追従バーを戻さない）
  const buyButtons = (html.match(/id="note-buy-btn"/g) || []).length;
  if (buyButtons !== expected) problems.push(`購入ボタン（id="note-buy-btn"）が ${buyButtons} 個あります（期待 ${expected} 個）`);
  if (!expected) return problems;

  const box = boxes[0][0];
  const buy = box.match(/<a\b[^>]*id="note-buy-btn"[^>]*>/);
  if (!buy || !buy[0].includes(`href="${escapeHtml(item.url)}"`)) problems.push('購入ボタンがこの記事の note 有料版の URL を指していません');
  // 案内は記事末尾ではなく導入部の直後（本文の最初の h2 より前）に置く
  const articleStart = html.indexOf('<article id="article-body"');
  const boxAt = boxes[0].index;
  if (articleStart === -1 || boxAt < articleStart || /<h2[\s>]/.test(html.slice(articleStart, boxAt))) {
    problems.push('有料版の案内が本文の導入部の直後（最初の h2 より前）にありません');
  }
  // 含まれる項目は暗号化時に作った内容一覧（note_drafts/<slug>_note.paid.json）と一致させる
  const summaryPath = path.join(noteDraftsDir, `${slug}_note.paid.json`);
  if (fs.existsSync(summaryPath)) {
    const { features = [] } = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const missing = features.filter((f) => !box.includes(`>${escapeHtml(f)}</li>`));
    if (missing.length) problems.push(`有料版の案内に内容一覧の項目がありません: ${missing.join(' / ')}`);
  }
  return problems;
}

// 記事ページに B2B（協賛・導入支援）の案内を出さない。/contact/・/sponsor/ への導線はフッターだけに置く
function b2bOfferProblems(html) {
  const problems = [];
  const footerAt = html.search(/<footer[\s>]/);
  const beforeFooter = footerAt === -1 ? html : html.slice(0, footerAt);
  // 本文中の外部サイトの /contact/ は対象外（このサイトのページへのリンクだけを見る）
  for (const m of beforeFooter.matchAll(/href="((?:https:\/\/ssk0224\.github\.io)?\/auto-tech-radar\/(?:contact|sponsor)\/[^"]*)"/g)) {
    problems.push(`フッター以外に B2B の導線があります: ${m[1]}`);
  }
  if (/price=(?:800000|100000)\b/.test(html)) problems.push('B2B の価格付き相談リンク（price=800000 / price=100000）があります');
  return problems;
}

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
    // 値の埋め込み漏れはパスの区切り（/ ? # = 引用符）に挟まれた単独の語として現れる。
    // 部分一致だと「nullclaw」のような実在のリポジトリ名で誤検出し、毎日のビルドが止まる
    /(?:href|src)="(?:[^"]*[\/=?#])?(?:undefined|null|NaN)(?:[\/?#&][^"]*)?"/,
    /href="[^"]*\[object%20Object\][^"]*"/
  ];
  // 記事ページの h1 はちょうど 1 つ（0 や複数は見出し構造の崩れ）
  if (/^radar\/[^/]+\/index\.html$/.test(relPath)) {
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) {
      console.error(`  ❌ [H1 COUNT] ${relPath}: h1 が ${h1} 個あります（1 個にしてください）`);
      errorCount++;
    }
    // AI 生成の表示、ノイズ記事の noindex、note 出品済みの記事だけに有料版の案内を出すこと、B2B の案内を出さないこと
    const slug = relPath.split('/')[1];
    if (!html.includes('class="ai-disclosure"')) {
      console.error(`  ❌ [AI DISCLOSURE] ${relPath}: AI が下書きした旨の表示がありません`);
      errorCount++;
    }
    if (isNoise(slug) !== /<meta name="robots" content="noindex/.test(html)) {
      console.error(`  ❌ [NOINDEX] ${relPath}: ノイズ記事の判定と noindex が一致しません`);
      errorCount++;
    }
    for (const p of noteOfferProblems(html, slug)) {
      console.error(`  ❌ [BUY CARD] ${relPath}: ${p}`);
      errorCount++;
    }
    for (const p of b2bOfferProblems(html)) {
      console.error(`  ❌ [B2B OFFER] ${relPath}: ${p}`);
      errorCount++;
    }
  }
  for (const bp of badPatterns) {
    const match = html.match(bp);
    if (match) {
      console.error(`  ❌ [CORRUPTED URL] ${relPath}: 不正なリンク・リソースが検出されました: ${match[0]}`);
      errorCount++;
    }
  }

  // 2.5 有料本文（PRO限定エリア）の配信物混入チェック
  const proLeaks = findProLeaks(html);
  if (proLeaks.length) {
    console.error(`  ❌ [PRO CONTENT IN DIST] ${relPath}: 有料本文が配信HTMLに含まれています（${proLeaks.join(', ')}）`);
    errorCount++;
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
