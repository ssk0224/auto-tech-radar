import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findProLeaks } from './utils/pro_boundary.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { REMOVED_SLUGS } from './utils/blocklist.mjs';

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

const SITE = 'https://ssk0224.github.io';
const BASE = '/auto-tech-radar/';

// /auto-tech-radar/… のパスを dist 内のファイルに変換する
function localFileFor(linkPath) {
  let localPath = decodeURIComponent(linkPath).replace(/^\/auto-tech-radar\/?/, '');
  if (localPath === '' || localPath.endsWith('/')) localPath += 'index.html';
  else if (!path.extname(localPath)) localPath += '/index.html';
  return localPath;
}

// dist 内の index.html の相対パス → そのページの正しい URL（canonical）
function pageUrlFor(relPath) {
  const dir = path.posix.dirname(relPath);
  return `${SITE}${BASE}${dir === '.' ? '' : dir + '/'}`;
}

const attrOf = (html, re) => (html.match(re) || [])[1];
const unescapeAttr = (s) => String(s ?? '').replace(/&(amp|lt|gt|quot|#39|#x27);/g, (m, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", '#x27': "'" }[e]));

// ページごとの構造の検査: 構造化データ（JSON-LD）・canonical/og:url・id の重複・ページ内リンク・日付の書式
function pageStructureProblems(html, relPath) {
  const problems = [];
  const isArticle = /^radar\/[^/]+\/index\.html$/.test(relPath);

  // JSON-LD は JSON として読め、script 要素の中に生の < を含まない（タイトルの </script> で本文にスクリプトが入らない）
  const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const lds = [];
  for (const b of blocks) {
    if (b.includes('<')) problems.push('JSON-LD の中に生の < があります（</script> で script 要素が閉じる。< は \\u003c にする）');
    try { lds.push(JSON.parse(b)); } catch (e) { problems.push(`JSON-LD が JSON として読めません: ${e.message}`); }
  }
  // 1 つの JSON-LD の後ろに script 要素の外へ漏れた内容が無いこと（ld+json の開始タグと閉じタグの数が一致）
  const ldOpen = (html.match(/<script\b[^>]*type="application\/ld\+json"/g) || []).length;
  if (ldOpen !== blocks.length) problems.push('JSON-LD の script 要素が正しく閉じていません');

  const canonical = attrOf(html, /<link rel="canonical" href="([^"]*)"/);
  const ogUrl = attrOf(html, /<meta property="og:url" content="([^"]*)"/);
  if (fullSite) {
    const expected = pageUrlFor(relPath);
    if (canonical !== expected) problems.push(`canonical が ${canonical} です（期待 ${expected}）`);
    if (ogUrl !== expected) problems.push(`og:url が ${ogUrl} です（期待 ${expected}）`);
    if (isArticle) {
      const art = lds.find((j) => j?.['@type'] === 'TechArticle');
      if (!art) problems.push('記事ページに TechArticle の構造化データがありません');
      else {
        if (art.url !== expected) problems.push(`構造化データの url が ${art.url} です（期待 ${expected}）`);
        for (const k of ['datePublished', 'dateModified']) {
          if (art[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(art[k]))) problems.push(`構造化データの ${k} が YYYY-MM-DD ではありません: ${art[k]}`);
        }
        if (art.datePublished && art.dateModified && art.dateModified < art.datePublished) problems.push(`構造化データの dateModified（${art.dateModified}）が datePublished（${art.datePublished}）より前です`);
        const ogImage = unescapeAttr(attrOf(html, /<meta property="og:image" content="([^"]*)"/));
        if (art.image !== ogImage) problems.push(`構造化データの image（${art.image}）が og:image（${ogImage}）と違います`);
        if (typeof art.headline !== 'string' || !art.headline) problems.push('構造化データの headline が空です');
      }
    }
  }

  // id の重複（ページ内リンク・ラベルの関連付けが壊れる）。スクリプト内の文字列（innerHTML のひな形）は対象外
  const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  if (dup.length) problems.push(`id が重複しています: ${dup.join(', ')}`);
  // ページ内リンク（#…）の行き先がある
  const idSet = new Set(ids.map((id) => unescapeAttr(id)));
  for (const m of markup.matchAll(/href="#([^"]+)"/g)) {
    const target = unescapeAttr(decodeURIComponent(m[1]));
    if (!idSet.has(target)) problems.push(`ページ内リンク #${target} の行き先（id）がありません`);
  }
  // 他ページの #… の行き先がある
  for (const m of markup.matchAll(/href="(?:https:\/\/ssk0224\.github\.io)?(\/auto-tech-radar\/[^"#?]*)#([^"]+)"/g)) {
    const file = path.join(distDir, localFileFor(m[1]));
    if (!fs.existsSync(file)) continue; // 404 は別の検査で出す
    const target = unescapeAttr(decodeURIComponent(m[2]));
    if (!new RegExp(`\\sid="${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(fs.readFileSync(file, 'utf8'))) problems.push(`リンク ${m[1]}#${target} の行き先（id）がありません`);
  }

  // 日付が Date のまま文字列化された跡（YAML で引用符の無い日付を、そのまま表示した場合に出る）
  const leaked = markup.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z|GMT[+-]\d{4} \(|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \d{4}/);
  if (leaked) problems.push(`日付が YYYY-MM-DD ではなく Date の文字列のまま表示されています: ${leaked[0]}`);
  // 数値の埋め込み漏れ（価格・スター数・字数・件数が NaN / undefined）
  const badNumber = markup.match(/[¥★]\s?(?:NaN|undefined|null)|(?:NaN|undefined)\s?(?:字|本|件|円)/);
  if (badNumber) problems.push(`数値が NaN / undefined のまま表示されています: ${badNumber[0]}`);
  return problems;
}

// サイトマップ・RSS・API・llms.txt・robots.txt が、実際の記事ページと一致すること（消したページへのリンクが残らない）
function feedProblems() {
  const problems = [];
  const readDist = (rel) => fs.readFileSync(path.join(distDir, rel), 'utf8');
  const exists = (rel) => fs.existsSync(path.join(distDir, rel));
  const urlExists = (u) => u.startsWith(SITE + BASE) && exists(localFileFor(u.slice(SITE.length)));
  const articleSlugs = fs.existsSync(path.join(distDir, 'radar'))
    ? fs.readdirSync(path.join(distDir, 'radar')).filter((s) => exists(`radar/${s}/index.html`))
    : [];
  const listed = articleSlugs.filter((s) => !isNoise(s));
  const articleUrl = (s) => `${SITE}${BASE}radar/${s}/`;
  const sameSet = (name, urls, expected) => {
    const a = new Set(urls);
    const missing = expected.filter((u) => !a.has(u));
    const extra = [...a].filter((u) => !expected.includes(u));
    if (missing.length) problems.push(`${name} に載っていない記事: ${missing.join(' ')}`);
    if (extra.length) problems.push(`${name} に記事一覧に無い URL: ${extra.join(' ')}`);
  };

  // サイトマップ: 載っている URL はすべて実在し、ノイズ以外の記事はすべて載っている（ノイズ記事は noindex なので載せない）
  const sitemaps = fs.readdirSync(distDir).filter((f) => /^sitemap-\d+\.xml$/.test(f));
  if (!exists('sitemap-index.xml') || sitemaps.length === 0) problems.push('サイトマップ（sitemap-index.xml / sitemap-0.xml）がありません');
  const locs = sitemaps.flatMap((f) => [...readDist(f).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  for (const u of locs) if (!urlExists(u)) problems.push(`サイトマップの URL が実在しません: ${u}`);
  sameSet('サイトマップ', locs.filter((u) => u.startsWith(`${SITE}${BASE}radar/`)), listed.map(articleUrl));

  // RSS: 項目のリンクは実在し、ノイズ以外の記事（公開日のあるもの）と一致する
  if (!exists('rss.xml')) problems.push('rss.xml がありません');
  else {
    const rssXml = readDist('rss.xml');
    const items = [...rssXml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
    const links = items.map((it) => (it.match(/<link>([^<]+)<\/link>/) || [])[1] || '');
    for (const u of links) if (!urlExists(u)) problems.push(`RSS の項目のリンクが実在しません: ${u}`);
    const dated = listed.filter((s) => /"datePublished":"\d{4}-\d{2}-\d{2}"/.test(readDist(`radar/${s}/index.html`)));
    sameSet('RSS', links, dated.map(articleUrl));
    for (const it of items) if (!/<pubDate>[^<]+<\/pubDate>/.test(it)) problems.push(`RSS の項目に pubDate がありません: ${(it.match(/<link>([^<]+)/) || [])[1]}`);
  }

  // API（api/radar.json）: 件数と URL が記事ページと一致する
  if (!exists('api/radar.json')) problems.push('api/radar.json がありません');
  else {
    let api = null;
    try { api = JSON.parse(readDist('api/radar.json')); } catch (e) { problems.push(`api/radar.json が JSON として読めません: ${e.message}`); }
    if (api) {
      const data = Array.isArray(api.data) ? api.data : [];
      if (api.total_tracked_oss !== data.length) problems.push(`api/radar.json の total_tracked_oss（${api.total_tracked_oss}）が data の件数（${data.length}）と違います`);
      sameSet('api/radar.json', data.map((d) => d.url), listed.map(articleUrl));
      for (const d of data) if (d.pubDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(d.pubDate))) problems.push(`api/radar.json の ${d.slug} の pubDate が YYYY-MM-DD ではありません: ${d.pubDate}`);
    }
  }

  // llms.txt・robots.txt の URL は実在する
  for (const f of ['llms.txt', 'robots.txt']) {
    if (!exists(f)) { problems.push(`${f} がありません`); continue; }
    for (const m of readDist(f).matchAll(/https:\/\/ssk0224\.github\.io\/auto-tech-radar\/[^\s)>"'」）]*/g)) {
      if (!urlExists(m[0])) problems.push(`${f} の URL が実在しません: ${m[0]}`);
    }
  }

  // 一覧ページに出す記事数は、実際の記事ページの数と一致する
  if (exists('index.html')) {
    const n = Number((readDist('index.html').match(/id="post-count"[^>]*>全 (\d+) 本/) || [])[1]);
    if (n !== listed.length) problems.push(`トップページの記事数の表示（${n}）が記事ページの数（${listed.length}）と違います`);
  }

  // 取り下げた記事（scripts/utils/blocklist.mjs）へのリンク・ページが配信物のどこにも無い
  const textFiles = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(html|xml|json|txt)$/.test(e.name)) textFiles.push(p);
  });
  walk(distDir);
  for (const slug of REMOVED_SLUGS) {
    if (exists(`radar/${slug}/index.html`)) problems.push(`取り下げた記事のページが残っています: radar/${slug}/`);
    const re = new RegExp(`/radar/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/|"|$)`);
    for (const f of textFiles) if (re.test(fs.readFileSync(f, 'utf8'))) problems.push(`取り下げた記事 ${slug} へのリンクがあります: ${path.relative(distDir, f)}`);
  }
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
// サイト全体のビルド（トップページがある）では、canonical・構造化データ・サイトマップ・RSS・API まで確かめる
// （テストの一部のページだけの配信物では、その部分は見ない）
const fullSite = fs.existsSync(path.join(distDir, 'index.html'));
console.log(`▶ 全 ${htmlFiles.length} 件の静的生成HTMLをディープスキャン中...\n`);

let errorCount = 0;
let checkedLinksCount = 0;
if (htmlFiles.length === 0) {
  console.error('  ❌ [EMPTY DIST] 配信物に HTML がありません（astro build が途中で失敗した可能性）');
  errorCount++;
}

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

  // 4. 内部リンク・画像・OGP の実在性チェック (404リンク切れの完全撲滅)
  // href・src・meta の content に入ったこのサイトの URL（/auto-tech-radar/… と https://ssk0224.github.io/auto-tech-radar/…）をすべて見る
  for (const match of html.matchAll(/\b(href|src|content)="(?:https:\/\/ssk0224\.github\.io)?(\/auto-tech-radar\/[^"#?]*)(?:[?#][^"]*)?"/g)) {
    checkedLinksCount++;
    const [, attr, linkPath] = match;
    const localPath = localFileFor(linkPath);
    if (!fs.existsSync(path.join(distDir, localPath))) {
      console.error(`  ❌ [404 DEAD LINK] ${relPath} 内の ${attr} ${linkPath} に対応するファイルが存在しません (${localPath})`);
      errorCount++;
    }
    // ページへのリンクは末尾スラッシュ付き（canonical と同じ形。無いと GitHub Pages のリダイレクトを 1 回はさむ）
    if (attr === 'href' && !linkPath.endsWith('/') && !path.extname(linkPath)) {
      console.error(`  ❌ [NO TRAILING SLASH] ${relPath} 内のリンク ${linkPath} の末尾に / がありません（canonical は ${linkPath}/）`);
      errorCount++;
    }
  }

  for (const p of pageStructureProblems(html, relPath)) {
    console.error(`  ❌ [STRUCTURE] ${relPath}: ${p}`);
    errorCount++;
  }
}

if (fullSite) {
  for (const p of feedProblems()) {
    console.error(`  ❌ [FEEDS] ${p}`);
    errorCount++;
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
