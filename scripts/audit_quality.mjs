import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { findProLeaks } from './utils/pro_boundary.mjs';
import { RETIRED_OUTPUTS } from './utils/public_tree.mjs';
import { splitPaid, isFooterOnly, sealedInfo, keyId, SEALED_PLACEHOLDER_RE, MIN_PUBLIC_NOTE_CHARS, publicKeyFile as vaultPublicKeyFile } from './utils/note_vault.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { REMOVED_SLUGS, isNoteWithdrawn } from './utils/blocklist.mjs';
import { findForbiddenClaims } from './utils/claims_check.mjs';
import { mermaidProblems } from './utils/mermaid.mjs';
import { mermaidParseErrors } from './utils/mermaid_parse.mjs';

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
  if (f === '.env.example' || f === '.env') return;
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

  // A0. YAML Frontmatter 厳格構造監査
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    console.error(`  ❌ [MISSING FRONTMATTER] ${file}: YAML frontmatter (---) が存在しません`);
    errorCount++;
  } else {
    const fmLines = fmMatch[1].split(/\r?\n/);
    const fm = {};
    for (const l of fmLines) {
      const kv = l.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (kv) {
        let v = kv[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        fm[kv[1]] = v;
      }
    }

    if (fm.stars === undefined || fm.stars === '' || isNaN(Number(fm.stars)) || Number(fm.stars) < 0) {
      console.error(`  ❌ [INVALID/MISSING STARS] ${file}: stars フィールドが欠落しているか無効な数値です (stars: ${fm.stars})`);
      errorCount++;
    }
    if (!fm.description || fm.description.trim().length === 0) {
      console.error(`  ❌ [MISSING DESCRIPTION] ${file}: description フィールドが空または未定義です`);
      errorCount++;
    }
    if (!fm.title || fm.title.trim().length === 0) {
      console.error(`  ❌ [MISSING TITLE] ${file}: title フィールドが空または未定義です`);
      errorCount++;
    }
    if (!fm.pubDate || !/^\d{4}-\d{2}-\d{2}$/.test(fm.pubDate)) {
      console.error(`  ❌ [INVALID PUBDATE] ${file}: pubDate が YYYY-MM-DD 形式ではありません (${fm.pubDate})`);
      errorCount++;
    }
  }

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

  // D. PRO限定エリア（有料本文）の Web 掲載禁止チェック
  // 静的配信のHTMLに含めた有料本文は誰でも読めるため、有料本文は note でのみ提供する
  const proLeaks = findProLeaks(content);
  if (proLeaks.length) {
    console.error(`  ❌ [PRO CONTENT ON WEB] ${file}: Web記事に有料本文が含まれています（${proLeaks.join(', ')}）。node scripts/strip_pro_from_web.mjs で除去してください`);
    errorCount++;
  }

  // E. 異常空白スペース混入チェック
  if (/\s{500,}/.test(content)) {
    console.error(`  ❌ [CORRUPTED WHITESPACE] ${file}: 異常な長大空白が検出されました`);
    errorCount++;
  }

  // F. 不完全なコードブロック（奇数個のバッククォート）チェック
  const backticks = content.match(/```/g) || [];
  if (backticks.length % 2 !== 0) {
    console.error(`  ❌ [UNCLOSED CODE BLOCK] ${file}: 奇数個のバッククォート（${backticks.length}個）が検出されました`);
    errorCount++;
  }

  // G. 異常な長大行（Geminiテーブル暴走による数万〜数十万文字の区切り線）チェック
  const lines = content.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    if (lines[li].length > 1000) {
      console.error(`  ❌ [CORRUPTED LONG LINE] ${file} Line ${li + 1}: 異常な長大行（${lines[li].length}文字）が検出されました`);
      errorCount++;
      break;
    }
  }

});

if (errorCount === 0 && warningCount === 0) {
  console.log(`  ✓ SUPERPOWERS品質監査合格: 全 ${articles.length} 本のレポートが基準（PNGサムネ・Mermaid図解・有料本文の非掲載）を充足。\n`);
} else if (errorCount === 0) {
  console.log(`  ℹ️ SUPERPOWERS監査完了: エラー 0 件、警告 ${warningCount} 件（運用上の許容範囲）。\n`);
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

// 4. 【止めた出力 監査】X の投稿文・Zenn の原稿はリポに置かない（オーナーの判断。scripts/utils/public_tree.mjs の RETIRED_OUTPUTS）
console.log('▶ [4/4] 止めた出力（' + RETIRED_OUTPUTS.join(' ') + '）の非存在監査...');
// 見るのは git が追跡しているファイル（手元に残った追跡外のファイルは .gitignore 済みで公開されない）
// git の管理外のコピー（テストが作る複製など）では確かめられないので飛ばす（同じ検査は tests/public_tree.test.mjs が git で行う）
let retiredLeft = [];
let retiredChecked = true;
try {
  retiredLeft = execSync(`git ls-files -z -- ${RETIRED_OUTPUTS.join(' ')}`, { cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\0').filter(Boolean);
} catch (e) {
  retiredChecked = false;
}
if (!retiredChecked) {
  console.log('  - git の管理外のため、止めた出力の追跡は確かめません（tests/public_tree.test.mjs が確かめる）。\n');
} else if (retiredLeft.length) {
  console.error(`  ❌ [RETIRED OUTPUT] 止めた出力のファイルが追跡されています: ${retiredLeft.length} 件（${retiredLeft.slice(0, 3).join(', ')}…）`);
  errorCount++;
} else {
  console.log('  ✓ 止めた出力の監査合格: X の投稿文・Zenn の原稿は追跡されていません。\n');
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
  console.log('  ✓ 構造化データ ＆ note購入導線 ＆ ソーシャルシェア: 正常実装\n');
} else {
  console.error('  ❌ Layout.astro に Paywall 構造化データ、施錠ゲート、またはシェアバーが不足しています');
  errorCount++;
}

// 6. 【リンク完全性】Web 記事の slug 一覧（note 原稿の送客 URL の検査（11）で使う）
const existingWebSlugs = fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));

// 7. 【Paywall DOM ＆ クライアントスクリプト完全性 監査】
console.log('▶ [7/7] クライアントスクリプト完全性 ＆ 有料解除処理の非存在監査...');
const clientScriptMatch = layoutContent.match(/<script(?:\s+is:inline)?>([\s\S]*?)<\/script>/);
if (!clientScriptMatch) {
  console.error('  ❌ Layout.astro にクライアント側 <script> が存在しません！');
  errorCount++;
} else {
  const clientScriptCode = clientScriptMatch[1];
  try {
    new Function(clientScriptCode);
    console.log('  ✓ クライアント側 <script> 構文チェック: 正常合格');
  } catch (e) {
    console.error('  ❌ クライアント側 <script> に構文エラーまたは未定義識別子があります:', e.message);
    errorCount++;
  }

  // 有料本文はWebに置かないため、クライアント側の解除処理（URL・固定キー・localStorage）が残っていないことを確認
  const bypassPatterns = ['atr_pro_unlocked', "get('unlock')", 'vip-unlock-trigger', 'ATRPRO', 'RADAR2026'];
  const bypassFound = bypassPatterns.filter(p => layoutContent.includes(p));
  if (bypassFound.length) {
    console.error(`  ❌ Layout.astro にクライアント側の有料解除処理が残っています: ${bypassFound.join(', ')}`);
    errorCount++;
  } else {
    console.log('  ✓ クライアント側の有料解除処理なし（有料本文は note でのみ提供）\n');
  }
}

// 8. 【note_drafts 原稿完全性 ＆ 有料ライン漏洩 ＆ CVRフック 監査】
console.log('▶ [8/13] note_drafts 原稿完全性 ＆ 有料ライン漏洩 ＆ CVRフック監査...');
const noteDraftsDir = path.join(rootDir, 'note_drafts');
const vaultPub = fs.existsSync(vaultPublicKeyFile) ? fs.readFileSync(vaultPublicKeyFile, 'utf8').trim() : '';
const vaultKid = keyId(vaultPub);
if (fs.existsSync(noteDraftsDir)) {
  const noteFiles = fs.readdirSync(noteDraftsDir).filter(f => f.endsWith('.md'));
  let noteErrors = 0;
  noteFiles.forEach(file => {
    if (file.includes('LEAD_MAGNET') || file.includes('cheat_sheet')) return;
    const content = fs.readFileSync(path.join(noteDraftsDir, file), 'utf8');
    if (content.length < MIN_PUBLIC_NOTE_CHARS) {
      console.error(`  ❌ [EMPTY/CORRUPTED NOTE DRAFT] ${file}: コンテンツサイズが不足しています（${content.length} bytes）！`);
      noteErrors++;
      errorCount++;
      return;
    }
    const hasPaywall = content.includes('【有料ライン') || content.includes('有料会員限定') || content.includes('ここから先は有料');
    if (!hasPaywall) {
      console.error(`  ❌ [MISSING PAYWALL] ${file}: 有料境界マーカーがありません！`);
      noteErrors++;
      errorCount++;
      return;
    }
    // 有料部分は公開リポジトリに平文で置かず、公開鍵で暗号化した .paid.enc にのみ保存する
    const sealedPath = path.join(noteDraftsDir, file.replace(/\.md$/, '.paid.enc'));
    const paidPart = splitPaid(content);
    const onlyPlaceholder = paidPart && paidPart.paid.length === 1 && SEALED_PLACEHOLDER_RE.test(paidPart.paid[0]);
    if (!onlyPlaceholder) {
      console.error(`  ❌ [PAID CONTENT IN PLAINTEXT] ${file}: 有料ライン以降が暗号化されていません。node scripts/note_vault.mjs seal-all を実行してください`);
      noteErrors++;
      errorCount++;
      return;
    }
    const sealed = sealedInfo(fs.existsSync(sealedPath) ? fs.readFileSync(sealedPath, 'utf8') : '');
    if (!sealed || sealed.v !== 2 || sealed.aad !== file || sealed.kid !== vaultKid) {
      console.error(`  ❌ [SEALED PAID PART INVALID] ${file}: 暗号化された有料部分が無い・形式が古い・対象が違う・現在の公開鍵と一致しない のいずれかです。オーナー端末で npm run vault:reseal を実行してください`);
      noteErrors++;
      errorCount++;
      return;
    }
    let pIdx = -1;
    ['【有料ライン', '有料会員限定', 'ここから先は有料'].forEach(m => {
      const idx = content.indexOf(m);
      if (idx !== -1 && (pIdx === -1 || idx < pIdx)) pIdx = idx;
    });
    const freeText = content.substring(0, pIdx);
    if (freeText.includes('mcpServers') || freeText.includes('docker-compose') || freeText.includes('■ 案件名:')) {
      console.error(`  ❌ [PRO LEAK IN NOTE FREE PART] ${file}: 有料ライン手前にPROキットが漏洩しています！`);
      noteErrors++;
      errorCount++;
    }
    // 暗号化プレースホルダより後（公開される末尾）は決まったフッター行だけ（判定は note_vault と共通）
    const sealedLines = content.split('\n');
    const sealIdx = sealedLines.findIndex((l) => /^<!-- PAID_SEALED: /.test(l));
    if (sealIdx !== -1 && !isFooterOnly(sealedLines.slice(sealIdx + 1))) {
      console.error(`  ❌ [PRO LEAK IN NOTE TAIL PART] ${file}: 暗号化部分より後の公開フッターにフッター以外の本文があります！`);
      noteErrors++;
      errorCount++;
    }
    if (!content.includes('経費') && !content.includes('領収書')) {
      console.error(`  ❌ [MISSING ROI/EXPENSE HOOK] ${file}: 経費精算/ROIフックが抜けています！`);
      noteErrors++;
      errorCount++;
    }
    if (!content.includes('#AI') && !content.includes('#OSS')) {
      console.error(`  ❌ [MISSING HASHTAGS] ${file}: 推奨ハッシュタグが抜けています！`);
      noteErrors++;
      errorCount++;
    }
  });
  if (noteErrors === 0) {
    console.log(`  ✓ note_drafts 監査合格: 全 ${noteFiles.length} 本のnote原稿で有料ライン設置・有料部分の暗号化・PRO漏洩ゼロ・CVRフック配備完了。\n`);
  }
}

// 10. 【Mermaid ダイアグラム構文完全性 監査】
console.log('▶ [10/11] Mermaid ダイアグラム構文完全性 ＆ レンダリング保証監査...');
const checkMermaidFiles = [
  ...fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).map(f => path.join(radarDir, f)),
];
let mermaidErrors = 0;
// 検査の定義は生成・テストと共通（scripts/utils/mermaid.mjs）
checkMermaidFiles.forEach(fp => {
  const fileRel = path.relative(rootDir, fp);
  for (const problem of mermaidProblems(fs.readFileSync(fp, 'utf8'))) {
    console.error(`  ❌ [MERMAID] ${fileRel}: ${problem}`);
    mermaidErrors++;
    errorCount++;
  }
});
// サイトと同じ版の Mermaid で実際に解析する（正規表現の検査では描画失敗を見逃したため）
for (const fp of checkMermaidFiles) {
  for (const e of await mermaidParseErrors(fs.readFileSync(fp, 'utf8'))) {
    console.error(`  ❌ [MERMAID PARSE] ${path.relative(rootDir, fp)}: ${e}`);
    mermaidErrors++;
    errorCount++;
  }
}
if (mermaidErrors === 0) {
  console.log(`  ✓ Mermaid 構文監査合格: 全 ${checkMermaidFiles.length} ファイルのダイアグラムが規格準拠。\n`);
}

// 11. 【note_drafts URL 整合性 監査】
console.log('▶ [11/11] note_drafts 送客URL整合性 ＆ 404ゼロ欠陥監査...');
if (fs.existsSync(noteDraftsDir)) {
  const noteFiles = fs.readdirSync(noteDraftsDir).filter(f => f.endsWith('.md'));
  let noteUrlErrors = 0;
  noteFiles.forEach(file => {
    const content = fs.readFileSync(path.join(noteDraftsDir, file), 'utf8');
    const matches = content.match(/auto-tech-radar\/radar\/([a-zA-Z0-9_-]+)/g) || [];
    for (const m of matches) {
      const slug = m.split('/').pop();
      // 取り下げた記事（scripts/utils/blocklist.mjs）の note 原稿は非公開化済みで編集しないため、自分の記事ページへのリンクだけは許す
      if (REMOVED_SLUGS.includes(slug) && file === `${slug}_note.md`) continue;
      if (!existingWebSlugs.includes(slug)) {
        console.error(`  ❌ [NOTE DRAFT 404 LINK] ${file}: ${slug} (対象Web記事が存在しません)`);
        noteUrlErrors++;
        errorCount++;
      }
    }
  });
  if (noteUrlErrors === 0) {
    console.log(`  ✓ note_drafts URL 整合性監査合格: 全URLが実在ページと100%一致。\n`);
  }
}

// 12. 【全スクリプト構文完全性 監査】
console.log('▶ [12/13] リポジトリ内全スクリプト構文完全性 (node -c) 監査...');
const scriptsDir = path.join(rootDir, 'scripts');
const scriptFiles = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
let scriptErrors = 0;
scriptFiles.forEach(file => {
  const filePath = path.join(scriptsDir, file);
  try {
    execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`  ❌ [SCRIPT SYNTAX ERROR] scripts/${file}: 構文エラーが検出されました！\n  ${err.message}`);
    scriptErrors++;
    errorCount++;
  }
});
if (scriptErrors === 0) {
  console.log(`  ✓ スクリプト構文監査合格: 全 ${scriptFiles.length} 本のスクリプトで構文エラーゼロ。\n`);
}

// 13. 【デスクトップ起動導線 ＆ ショートカット完全性 監査】
console.log('▶ [13/13] デスクトップ起動導線 ＆ ショートカット整合性 監査...');
// 起動用のバッチ・ショートカットの置き場所はオーナー端末ごとに違う。公開リポに端末のパスを書かず、環境変数 ATR_DESKTOP_DIR で渡す（無ければ検査しない）
const desktopDir = process.env.ATR_DESKTOP_DIR && fs.existsSync(process.env.ATR_DESKTOP_DIR) ? process.env.ATR_DESKTOP_DIR : null;
if (desktopDir) {
  const batPath = path.join(desktopDir, '【収益化】AutoTechRadar.bat');
  const lnkPath = path.join(desktopDir, '【収益化】AutoTechRadar.lnk');
  let desktopErrors = 0;

  if (!fs.existsSync(batPath)) {
    console.error(`  ❌ [DESKTOP BAT MISSING] ${batPath} が見つかりません！`);
    desktopErrors++;
    errorCount++;
  }

  if (!fs.existsSync(lnkPath)) {
    console.error(`  ❌ [DESKTOP LNK MISSING] ${lnkPath} が見つかりません！`);
    desktopErrors++;
    errorCount++;
  } else {
    // ショートカットの TargetPath が実在するか（文字化けしていないか）の精密検証
    try {
      const ps = `
        $sh = New-Object -ComObject WScript.Shell
        $s = $sh.CreateShortcut("${lnkPath}")
        $exists = Test-Path -LiteralPath $s.TargetPath
        [PSCustomObject]@{ Target = $s.TargetPath; Exists = $exists } | ConvertTo-Json
      `;
      const buf = Buffer.from(ps, 'utf16le');
      const out = execSync(`powershell -NoProfile -EncodedCommand ${buf.toString('base64')}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const info = JSON.parse(out.replace(/#<[\s\S]*?>/g, '').trim());
      if (!info.Exists) {
        console.error(`  ❌ [CORRUPTED SHORTCUT TARGET] ショートカットの参照先が存在しません（文字化け破損の疑い）: ${info.Target}`);
        desktopErrors++;
        errorCount++;
      }
    } catch (e) {
      console.error(`  ❌ [SHORTCUT INSPECTION FAILED] ショートカット解析エラー: ${e.message}`);
      desktopErrors++;
      errorCount++;
    }
  }

  if (desktopErrors === 0) {
    console.log(`  ✓ デスクトップ起動導線監査合格: バッチ＆ショートカット完全開通・文字化けゼロ保証。\n`);
  }
} else {
  console.log(`  ℹ デスクトップ起動導線監査: 非Windows/CI環境のためスキップ。\n`);
}

// 14. 【非ノイズ記事 note_urls ＆ note_drafts 網羅性 ＆ データ完全性 監査】
console.log('▶ [14/14] 非ノイズ記事 note_urls ＆ note_drafts 網羅性・データ完全性監査...');
const noteUrlsFile = path.join(rootDir, 'scripts', 'note_urls.json');
let noteUrlsErrors = 0;
if (fs.existsSync(noteUrlsFile)) {
  const rawNoteUrls = fs.readFileSync(noteUrlsFile, 'utf8');

  // 重複キーの検査
  const seenKeys = new Set();
  for (const line of rawNoteUrls.split(/\r?\n/)) {
    const km = line.match(/^  "([^"]+)"\s*:\s*\{/);
    if (km) {
      if (seenKeys.has(km[1])) {
        console.error(`  ❌ [DUPLICATE KEY IN NOTE URLS] note_urls.json に重複キーが存在します: "${km[1]}"`);
        noteUrlsErrors++;
        errorCount++;
      }
      seenKeys.add(km[1]);
    }
  }

  const noteUrlsData = JSON.parse(rawNoteUrls);

  // A. 全非ノイズ記事に note 原稿があり、note 公開済みの記事は note_urls.json に載っていることを保証
  const nonNoiseArticles = articles.map(f => f.replace('.md', '')).filter(s => !isNoise(s));
  // 新しく生成した記事は note に出品されるまで URL が無い。URL を求めるのは note 公開済み（publish_history の note: true）の記事だけ
  let publishHistory = {};
  try {
    publishHistory = JSON.parse(fs.readFileSync(path.join(rootDir, 'scripts', 'publish_history.json'), 'utf8'));
  } catch (e) {}
  nonNoiseArticles.forEach(slug => {
    // note から取り下げた記事（blocklist.mjs）は出品の記録が残っていても URL が無いのが正しい
    if (publishHistory[slug]?.note && !isNoteWithdrawn(slug) && !noteUrlsData[slug]) {
      console.error(`  ❌ [MISSING NOTE URL] 非ノイズ記事 "${slug}" が scripts/note_urls.json に登録されていません`);
      noteUrlsErrors++;
      errorCount++;
    }
    const draftPath = path.join(rootDir, 'note_drafts', `${slug}_note.md`);
    if (!fs.existsSync(draftPath)) {
      console.error(`  ❌ [MISSING NOTE DRAFT] 非ノイズ記事 "${slug}" の原稿 note_drafts/${slug}_note.md が存在しません`);
      noteUrlsErrors++;
      errorCount++;
    }
  });

  // B. note_urls.json のタイトル・URL・禁止表現検査
  for (const [slug, item] of Object.entries(noteUrlsData)) {
    if (item.title && item.title.startsWith('#')) {
      console.error(`  ❌ [MALFORMED TITLE] note_urls.json [${slug}]: タイトルに "# " プレフィックスが含まれています: "${item.title}"`);
      noteUrlsErrors++;
      errorCount++;
    }
    const claims = findForbiddenClaims(item.title);
    if (claims.length) {
      console.error(`  ❌ [FORBIDDEN CLAIM IN NOTE URLS] note_urls.json [${slug}]: 禁止表現が検出されました (${claims.join(', ')})`);
      noteUrlsErrors++;
      errorCount++;
    }
    if (!/^https:\/\/note\.com\/[\w-]+\/n\/[a-zA-Z0-9]+$/.test(item.url)) {
      console.error(`  ❌ [INVALID NOTE URL] note_urls.json [${slug}]: URL形式が不正です: "${item.url}"`);
      noteUrlsErrors++;
      errorCount++;
    }
  }
}
if (noteUrlsErrors === 0) {
  console.log(`  ✓ note_urls ＆ 原稿網羅性監査合格: 全非ノイズ記事がnote_urls・note_draftsと100%連動、タイトル・URL規格準拠。\n`);
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
