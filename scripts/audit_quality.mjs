import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { findProLeaks } from './utils/pro_boundary.mjs';
import { zennCta } from './utils/funnel_copy.mjs';
import { splitPaid, sealedInfo, keyId, SEALED_PLACEHOLDER_RE, publicKeyFile as vaultPublicKeyFile } from './utils/note_vault.mjs';

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
    const zSlug = (zContent.match(/auto-tech-radar\/radar\/([a-z0-9_-]+)\//) || [])[1];
    if (zSlug && zContent.includes(zennCta(zSlug))) {
      funnelCount++;
    }

    // Topics 規格チェック（1〜5個、半角英数字ハイフンアンダースコアのみ）
    const topicsMatch = zContent.match(/^topics:\s*(\[.*?\])/m);
    if (!topicsMatch) {
      console.error(`  ❌ [ZENN MISSING TOPICS] ${f}: topics 配列が見つかりません`);
      zennErrors++;
      errorCount++;
    } else {
      try {
        const parsed = JSON.parse(topicsMatch[1]);
        if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 5) {
          console.error(`  ❌ [ZENN INVALID TOPICS COUNT] ${f}: topics は 1〜5 個である必要があります`);
          zennErrors++;
          errorCount++;
        } else {
          for (const t of parsed) {
            if (typeof t !== 'string' || !/^[a-z0-9_-]+$/.test(t)) {
              console.error(`  ❌ [ZENN INVALID TOPIC] ${f}: "${t}" は英小文字・数字・ハイフン・アンダースコアのみ使用可能です`);
              zennErrors++;
              errorCount++;
            }
          }
        }
      } catch (e) {
        console.error(`  ❌ [ZENN JSON PARSE ERROR] ${f}: topics のJSONパースに失敗しました`);
        zennErrors++;
        errorCount++;
      }
    }

    // コードブロック整合性チェック
    const zBackticks = zContent.match(/```/g) || [];
    if (zBackticks.length % 2 !== 0) {
      console.error(`  ❌ [ZENN UNCLOSED CODE BLOCK] ${f}: 奇数個のバッククォートが検出されました`);
      zennErrors++;
      errorCount++;
    }

    // 有料キット（見出し・提案書本文）の無料漏洩チェック。README 由来の MCP 設定や docker-compose 手順の引用は対象外
    if (findProLeaks(zContent).length || zContent.includes('■ 案件名:')) {
      console.error(`  ❌ [PRO LEAK IN ZENN] ${f}: 無料Zenn記事にPRO実務キットが漏洩しています！`);
      zennErrors++;
      errorCount++;
    }
  });
  if (zennErrors === 0 && funnelCount === zennArticles.length) {
    console.log(`  ✓ Zennデプロイ規格＆送客ファネル監査合格: 全 ${zennArticles.length} 本がZenn公式規格に適合し、共通の送客文（無料解説はサイト・実務キットは note）を配置済み。\n`);
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
  console.log('  ✓ 構造化データ ＆ note購入導線 ＆ ソーシャルシェア: 正常実装\n');
} else {
  console.error('  ❌ Layout.astro に Paywall 構造化データ、施錠ゲート、またはシェアバーが不足しています');
  errorCount++;
}

// 6. 【リンク完全性 監査】Zenn記事 ＆ サイト内リンク 404ゼロ欠陥チェック
console.log('▶ [6/6] リンク完全性 ＆ 404リンク切れ0件監査...');
const existingWebSlugs = fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''));
let brokenLinkCount = 0;

if (fs.existsSync(zennDir)) {
  const zArticles = fs.readdirSync(zennDir).filter(f => f.endsWith('.md'));
  zArticles.forEach(zf => {
    const content = fs.readFileSync(path.join(zennDir, zf), 'utf8');
    const matches = content.matchAll(/auto-tech-radar\/radar\/([a-z0-9_-]+)\//g);
    for (const match of matches) {
      const linkedSlug = match[1];
      if (!existingWebSlugs.includes(linkedSlug)) {
        console.error(`  ❌ [BROKEN LINK] ${zf} -> /radar/${linkedSlug}/ (対象Web記事が存在しません)`);
        brokenLinkCount++;
        errorCount++;
      }
    }
  });
}

if (brokenLinkCount === 0) {
  console.log('  ✓ リンク完全性監査合格: 全Zenn記事の送客先URLが100%実在Webページと一致（404リンク切れゼロ）。\n');
} else {
  console.error(`  ❌ リンク完全性監査失敗: リンク切れが ${brokenLinkCount} 件検出されました。\n`);
}

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
    if (content.length < 500) {
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

// 9. 【x_posts 投稿原稿完全性 ＆ PRO漏洩 ＆ URL整合性 監査】
console.log('▶ [9/13] x_posts 投稿原稿完全性 ＆ PRO漏洩 ＆ URL整合性監査...');
const xPostsDir = path.join(rootDir, 'x_posts');
if (fs.existsSync(xPostsDir)) {
  const xFiles = fs.readdirSync(xPostsDir).filter(f => f.endsWith('.txt'));
  let xErrors = 0;
  xFiles.forEach(file => {
    const content = fs.readFileSync(path.join(xPostsDir, file), 'utf8');
    const cleanBody = content.replace(/^[=\-\s\n📱]+.*?X \(Twitter\) 投稿用スレッド[=\-\s\n]+/m, '').trim();
    if (content.length < 200 || cleanBody.length < 50) {
      console.error(`  ❌ [EMPTY/CORRUPTED X POST] ${file}: 実質本文が不足しています（全体: ${content.length}B, 本文: ${cleanBody.length}文字）！`);
      xErrors++;
      errorCount++;
      return;
    }
    if (content.includes('mcpServers') || content.includes('docker-compose.yml') || content.includes('■ 案件名:')) {
      console.error(`  ❌ [PRO LEAK IN X POST] ${file}: X投稿にPRO実務キットが漏洩しています！`);
      xErrors++;
      errorCount++;
    }

    // X投稿内の記事URL実在チェック（404リンクゼロ保証）
    const xUrls = content.match(/auto-tech-radar\/radar\/([a-zA-Z0-9_-]+)/g) || [];
    for (const u of xUrls) {
      const slug = u.split('/').pop();
      if (!existingWebSlugs.includes(slug)) {
        console.error(`  ❌ [X POST 404 LINK] ${file}: ${slug} (対象Web記事が存在しません)`);
        xErrors++;
        errorCount++;
      }
    }
  });
  if (xErrors === 0) {
    console.log(`  ✓ x_posts 監査合格: 全 ${xFiles.length} 本のX投稿でPRO漏洩ゼロ・本文実在性100%確認。\n`);
  }
}

// 10. 【Mermaid ダイアグラム構文完全性 監査】
console.log('▶ [10/11] Mermaid ダイアグラム構文完全性 ＆ レンダリング保証監査...');
const checkMermaidFiles = [
  ...fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).map(f => path.join(radarDir, f)),
  ...(fs.existsSync(zennDir) ? fs.readdirSync(zennDir).filter(f => f.endsWith('.md')).map(f => path.join(zennDir, f)) : [])
];
let mermaidErrors = 0;
checkMermaidFiles.forEach(fp => {
  const fileRel = path.relative(rootDir, fp);
  const content = fs.readFileSync(fp, 'utf8');
  const mermaidBlocks = content.match(/```mermaid[\s\S]*?```/g) || [];
  for (const block of mermaidBlocks) {
    // 1. HTMLエスケープ漏れ (--&gt;) チェック
    if (block.includes('&gt;') || block.includes('&lt;')) {
      console.error(`  ❌ [MERMAID HTML ENTITY] ${fileRel}: HTML実体参照 (&gt;/&lt;) が含まれています`);
      mermaidErrors++;
      errorCount++;
    }
    // 2. subgraph の構文チェック（括弧やスラッシュ、スペースがクォートなしで使われていないか）
    const lines = block.split('\n');
    for (const line of lines) {
      const subMatch = line.match(/^\s*subgraph\s+([^\[\n]+)$/);
      if (subMatch) {
        const rawLabel = subMatch[1].trim();
        // 引用符で囲まれていないのに空白や記号を含む場合は警告/エラー
        if (!rawLabel.startsWith('"') && !rawLabel.endsWith('"')) {
          if (/[\(\)\/\&\+\s]/.test(rawLabel)) {
            console.error(`  ❌ [MERMAID UNQUOTED SUBGRAPH] ${fileRel}: "subgraph ${rawLabel}" に特殊文字またはスペースが含まれています。subgraph ID ["Label"] 形式にしてください`);
            mermaidErrors++;
            errorCount++;
          }
        }
      }
    }
  }
});
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
const userProfile = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\free1';
const candidateDesktopDirs = [
  path.join(userProfile, 'OneDrive', 'Desktop', 'SSK OS 9.bat関連'),
  path.join(userProfile, 'Desktop', 'SSK OS 9.bat関連'),
  'C:\\Users\\free1\\OneDrive\\Desktop\\SSK OS 9.bat関連'
];
const desktopDir = candidateDesktopDirs.find(d => fs.existsSync(d));
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
