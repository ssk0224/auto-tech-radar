import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec, execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { siteConfig } from '../src/config/site.js';
import { sanitizeAndAttachUrlToTweet, extractTweet1 } from './utils/twitter_formatter.mjs';
import { openNoteForPublishing, loadPrivateKeys, purgeOpenedNotes } from './utils/note_vault.mjs';
import { zennCta } from './utils/funnel_copy.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { commitAndSync, configureMergeDrivers } from './utils/git_sync.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const noteDir = path.join(rootDir, 'note_drafts');
const xDir = path.join(rootDir, 'x_posts');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');
const historyFile = path.join(__dirname, 'publish_history.json');
const noteUpdatesFile = path.join(__dirname, 'note_updates.json');

// 起動時に最新の main（CI が生成した記事・修正されたスクリプト）を取り込む。
// 取り込みでこのランチャー自身が更新されたら、新しいコードで起動し直す（読み込み済みの古いコードのまま動かさない）
if (!process.env.ATR_LAUNCHER_UPDATED) {
  process.stdout.write('🔄 最新の原稿・スクリプトを GitHub から取り込み中 (git pull)... ');
  const head = () => {
    try {
      return execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf8' }).trim();
    } catch (e) {
      return '';
    }
  };
  const before = head();
  try {
    configureMergeDrivers(rootDir);
    execSync('git pull --autostash origin main', { cwd: rootDir, stdio: 'pipe', timeout: 30000 });
    console.log('✓ 完了\n');
  } catch (e) {
    // 失敗の理由を隠さない（古いコードのまま動いていることに気づけるように）
    const why = `${e.stderr || ''}${e.stdout || ''}`.toString().trim().split('\n').slice(-3).join(' / ') || e.message;
    console.log(`\n⚠ 取り込めませんでした（古いままで起動します）: ${why}\n`);
    try { execSync('git rebase --abort', { cwd: rootDir, stdio: 'ignore' }); } catch (e2) {}
  }
  if (before && head() !== before) {
    console.log('🔁 更新を取り込んだため、新しいランチャーで起動し直します...\n');
    const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, ATR_LAUNCHER_UPDATED: '1' } });
    process.exit(r.status ?? 0);
  }
}

// ANSIカラー定数（高級感あるダークターミナルUI）
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  white: "\x1b[37m",
  bgBlue: "\x1b[44m",
  bgDark: "\x1b[40m",
};

// 100%確実にユーザーのGUI画面でブラウザを開く関数（Windows FileProtocolHandler API）
function openUrl(url) {
  exec(`rundll32 url.dll,FileProtocolHandler "${url}"`, (err) => {
    if (err) {
      exec(`start "" "${url}"`);
    }
  });
}

function openFile(filePath) {
  exec(`start "" "${filePath}"`);
}

// テキストをクリップボードにコピー
function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    const escaped = text.replace(/'/g, "''");
    execSync(`powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`, { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch (e) {
    return false;
  }
}

// サムネイル画像をクリップボードに直接コピー（note画面でCtrl+V即貼り付け可能にする）
function copyImageToClipboard(imagePath) {
  if (!fs.existsSync(imagePath)) return false;
  try {
    const escaped = imagePath.replace(/'/g, "''");
    const psCmd = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${escaped}'))`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'ignore', timeout: 4000 });
    return true;
  } catch (e) {
    return false;
  }
}

// 投稿履歴の読み込み・保存
function loadHistory() {
  if (!fs.existsSync(historyFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch (e) {
    return {};
  }
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2), 'utf8');
  } catch (e) {}
}

function recordPublish(slug, type) {
  const history = loadHistory();
  if (!history[slug]) history[slug] = {};
  const todayStr = new Date().toISOString().split('T')[0];
  if (type === 'note') {
    history[slug].note = true;
    history[slug].noteAt = todayStr;
  } else if (type === 'x') {
    history[slug].x = true;
    history[slug].xAt = todayStr;
  } else if (type === 'zenn') {
    history[slug].zenn = true;
    history[slug].zennAt = todayStr;
  } else if (type === 'qiita') {
    history[slug].qiita = true;
    history[slug].qiitaAt = todayStr;
  }
  saveHistory(history);

  syncHistory('chore(history): record published articles');
}

// 出品履歴を GitHub に同期する。失敗は握りつぶさずに表示する（CI が同じ記事を X に二重投稿するのを防ぐため）
function syncHistory(message) {
  const r = commitAndSync(rootDir, ['scripts/publish_history.json'], message);
  if (!r.ok) {
    console.log(`\n${c.red}${c.bold}⚠ 出品履歴を GitHub に同期できませんでした（${r.step}）。メニュー [S] で同期し直してください。${c.reset}`);
    console.log(`${c.dim}${r.message.slice(0, 400)}${c.reset}`);
  }
}

// 記事原稿リスト取得（履歴と紐付け）
function getDrafts() {
  if (!fs.existsSync(noteDir)) return [];
  const history = loadHistory();
  return fs.readdirSync(noteDir)
    .filter(f => f.endsWith('_note.md'))
    // 解説対象外のリポジトリ（ノイズ）は出品・拡散の候補に出さない
    .filter(f => !isNoise(f.replace('_note.md', '')))
    .map(f => {
      const fullPath = path.join(noteDir, f);
      const stat = fs.statSync(fullPath);
      const slug = f.replace('_note.md', '');
      const xFile = path.join(xDir, `${slug}_x.txt`);
      const hasX = fs.existsSync(xFile) && fs.statSync(xFile).size > 200;
      
      let title = slug;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) title = match[1].trim();
      } catch (e) {}

      const h = history[slug] || {};

      return {
        slug,
        title,
        noteFile: fullPath,
        xFile: hasX ? xFile : null,
        mtime: stat.mtimeMs,
        size: stat.size,
        isNotePosted: !!h.note,
        notePostedAt: h.noteAt || null,
        isXPosted: h.x === true,
        xPostedAt: h.xAt || null,
        isZennPosted: !!h.zenn,
        zennPostedAt: h.zennAt || null,
        isQiitaPosted: !!h.qiita,
        qiitaPostedAt: h.qiitaAt || null
      };
    })
    .filter(d => d.size > 500)
    .sort((a, b) => b.mtime - a.mtime);
}

// note に公開済みで、原稿の修正を note 側へ反映する必要がある記事（scripts/note_updates.json）。
// 反映したら publish_history の noteUpdatedAt に記録し、一覧から消える
function getPendingNoteUpdates() {
  let spec = { since: '9999', items: {} };
  try {
    spec = JSON.parse(fs.readFileSync(noteUpdatesFile, 'utf8'));
  } catch (e) {}
  const history = loadHistory();
  const noteUrls = loadNoteUrls();
  const fileOf = (slug) => path.join(noteDir, slug === 'LEAD_MAGNET_CHEAT_SHEET' ? `${slug}.md` : `${slug}_note.md`);
  const items = Object.entries(spec.items || {})
    .filter(([slug]) => !(history[slug]?.noteUpdatedAt >= spec.since))
    .map(([slug, item]) => ({ slug, ...item }));
  // CI が公開中の note 本文を検査して見つけた問題（scripts/note_status.json）。
  // 差し替えたあと次に CI が確認するまでの間は、差し替え済みとして出さない
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, 'note_status.json'), 'utf8'));
    for (const [slug, v] of Object.entries(st.notes || {})) {
      if (!v.issues?.length || items.some((i) => i.slug === slug)) continue;
      if (history[slug]?.noteUpdatedAt && history[slug].noteUpdatedAt >= st.checkedAt.slice(0, 10)) continue;
      items.push({ slug, action: 'replace', reason: `公開中の note に問題があります: ${v.issues.join(' / ')}` });
    }
  } catch (e) {}
  // CI が見つけた重複出品（scripts/note_urls.json の duplicates）も、片付けるまで一覧に出す
  for (const [slug, v] of Object.entries(noteUrls)) {
    if (!v.duplicates?.length || history[slug]?.noteDedupedAt || items.some((i) => i.slug === slug)) continue;
    items.push({ slug, action: 'replace', reason: '修正版への差し替えと重複出品の整理' });
  }
  return items
    .map((item) => ({ ...item, noteFile: fileOf(item.slug), url: noteUrls[item.slug]?.url || null, duplicates: noteUrls[item.slug]?.duplicates || [] }))
    // 非公開にするもの → 重複出品があるもの → その他（note_updates.json の並び順、後回しにした記事は末尾）
    .sort((a, b) => {
      const rank = (i) => (i.action === 'unpublish' ? 0 : i.duplicates.length > 0 ? 1 : 2);
      return rank(a) - rank(b);
    });
}

function loadNoteUrls() {
  const knownNoiseUrls = {
    'crates-io-index': { url: 'https://note.com/vast_ixora7005/n/na4995221c9ec', price: 980 },
    'homebrew-core': { url: 'https://note.com/vast_ixora7005/n/n78b928e2598d', price: 980 },
    'internships-2027': { url: 'https://note.com/vast_ixora7005/n/n8b1178d06273', price: 980 },
    'mediawiki': { url: 'https://note.com/dashboard/contents', price: 980 },
  };
  try {
    return { ...knownNoiseUrls, ...JSON.parse(fs.readFileSync(path.join(__dirname, 'note_urls.json'), 'utf8')) };
  } catch (e) {
    return knownNoiseUrls;
  }
}

function recordNoteUpdated(slug, deduped) {
  const history = loadHistory();
  const today = new Date().toISOString().split('T')[0];
  history[slug] = { ...(history[slug] || {}), noteUpdatedAt: today, ...(deduped ? { noteDedupedAt: today } : {}) };
  saveHistory(history);
  syncHistory('chore(history): record note updates');
}

// 長い本文は PowerShell の引数に渡せない（コマンドライン長の上限）ため、ファイルから読み込んでコピーする
function copyFileToClipboard(filePath) {
  try {
    const escaped = filePath.replace(/'/g, "''");
    execSync(`powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 -LiteralPath '${escaped}' | Set-Clipboard"`, { stdio: 'ignore', timeout: 8000 });
    return true;
  } catch (e) {
    return false;
  }
}

// 記事総数
function getPublishedCount() {
  if (!fs.existsSync(radarDir)) return 0;
  return fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).length;
}

function renderHeader() {
  const publishedCount = getPublishedCount();
  const drafts = getDrafts();
  const noteUnpostedCount = drafts.filter(d => !d.isNotePosted).length;
  const xUnpostedCount = drafts.filter(d => !d.isXPosted).length;

  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.yellow}⚡ Auto Tech Radar${c.reset}  ${c.white}${c.bold}|  海外急上昇OSS 徹底解剖 ＆ 商用化・実務導入支援コンソール${c.reset}`);
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  // 動いているランチャーの版（GitHub の最新と比べられるように）と、CI が確認した note の公開状態
  let version = '';
  try {
    version = execSync('git log -1 --format="%h %cd" --date=format:"%m/%d %H:%M"', { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (e) {}
  let noteStatusLine = '';
  try {
    const st = JSON.parse(fs.readFileSync(path.join(__dirname, 'note_status.json'), 'utf8'));
    const v = Object.values(st.notes || {});
    const noImg = v.filter((n) => n.eyecatch === false).length;
    const bad = v.filter((n) => n.issues?.length).length;
    noteStatusLine = `note 公開状態（${st.checkedAt.slice(5, 16).replace('T', ' ')} UTC 確認）: 見出し画像なし ${noImg} 本 / 要修正の表現 ${bad} 本`;
  } catch (e) {}
  console.log(`  ${c.dim}ランチャーの版: ${version}${c.reset}`);
  if (noteStatusLine) console.log(`  ${c.dim}${noteStatusLine}${c.reset}`);
  console.log(`  ${c.dim}システム稼働状況:${c.reset} ${c.green}● 全世界LIVE配信中${c.reset}  |  ${c.white}総レポート数:${c.reset} ${c.cyan}${c.bold}${publishedCount} 本${c.reset}  |  ${c.magenta}GitHub Actions 自動巡回中${c.reset}`);
  console.log(`  ${c.dim}収益化アクション残:${c.reset} note出品: ${noteUnpostedCount > 0 ? c.yellow + c.bold + noteUnpostedCount + ' 本' + c.reset : c.green + '0(完了)' + c.reset} | 𝕏拡散: ${xUnpostedCount > 0 ? c.blue + c.bold + xUnpostedCount + ' 本' + c.reset : c.green + '0(完了)' + c.reset}`);
  console.log(`  ${c.dim}販売:${c.reset} note（有料記事・メンバーシップ）  |  ${c.dim}公式Web:${c.reset} ${c.cyan}https://ssk0224.github.io/auto-tech-radar/${c.reset}`);
  console.log(`  ${c.dim}3大収益ピラー   :${c.reset} ①単発レポート (¥980)  ②noteサブスク (¥1,980/月)  ③B2B受託 (¥800,000〜)`);

  const pendingUpdates = getPendingNoteUpdates();
  if (pendingUpdates.length > 0) {
    console.log(`${c.red}--------------------------------------------------------------------------------${c.reset}`);
    console.log(`  ${c.red}${c.bold}⚠ note に公開済みの記事 ${pendingUpdates.length} 本が古い内容のままです（購入者が読む有料部分を含む）${c.reset}`);
    console.log(`     👉 メニュー ${c.red}${c.bold}[U]${c.reset} で1本ずつ差し替えられます（全文のコピーと編集画面の表示は自動）`);
  }

  const unpostedDraft = drafts.find(d => !d.isNotePosted || !d.isXPosted);
  if (unpostedDraft) {
    const unpostedStatus = (!unpostedDraft.isNotePosted && !unpostedDraft.isXPosted) 
      ? 'note出品 ＆ 𝕏拡散 未完了' 
      : (!unpostedDraft.isNotePosted ? 'note未出品' : '𝕏未拡散');
    console.log(`${c.yellow}--------------------------------------------------------------------------------${c.reset}`);
    console.log(`  ${c.yellow}${c.bold}★ 本日推奨の未処理レポート:${c.reset} ${c.white}${c.bold}【${unpostedDraft.title.slice(0, 36)}】${c.reset} ${c.yellow}(${unpostedStatus})${c.reset}`);
    console.log(`     👉 メニュー ${c.magenta}${c.bold}[A]${c.reset} を押すだけで最短30秒で一括出品アシストが起動します！`);
  }
  console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
}

function promptMenu() {
  renderHeader();
  const drafts = getDrafts();
  const topDraft = drafts.find(d => !d.isNotePosted || !d.isXPosted);
  const targetLabel = topDraft ? `（最新: ${topDraft.slug}）` : '';

  console.log(`\n  ${c.yellow}${c.bold}【🔥 日々の収益化アクション（note ＆ 𝕏 最速ルーティン）】${c.reset}`);
  console.log(`   ${c.magenta}${c.bold}[A]${c.reset} ${c.magenta}${c.bold}🚀 【最速一括アシスト】note有料出品 ＋ 𝕏拡散を連続パブリッシュ${c.reset} ${c.cyan}${targetLabel}${c.reset} ${c.dim}(最短30秒で完了)${c.reset}`);
  console.log(`   ${c.green}${c.bold}[4]${c.reset} ${c.bold}生成済み有料レポートを note に出品する${c.reset} ${c.dim}(未出品の推奨記事を最優先サジェスト)${c.reset}`);
  console.log(`   ${c.blue}${c.bold}[5]${c.reset} ${c.bold}最新レポートを X でワンクリック拡散する${c.reset} ${c.dim}(URLなし高インプ設計)${c.reset}`);
  console.log(`   ${c.cyan}${c.bold}[6]${c.reset} ${c.bold}全世界公開サイト（自社HP）を確認する${c.reset} ${c.dim}(GitHub Pages)${c.reset}`);
  console.log(`   ${c.red}${c.bold}[U]${c.reset} ${c.bold}note 公開済み記事を修正版に差し替える${c.reset} ${c.dim}(残り ${getPendingNoteUpdates().length} 本)${c.reset}`);
  console.log(`   ${c.dim}[N] (本文の一括自動更新: 現在は使えないため [U] に案内します)${c.reset}`);
  console.log(`   ${c.cyan}${c.bold}[E]${c.reset} ${c.bold}🖼 note の見出し画像を一括設定する${c.reset} ${c.dim}(自動・未設定の記事だけ。初回のみ note にログイン)${c.reset}`);

  console.log(`\n  ${c.magenta}${c.bold}【🚀 トラフィック爆発 ＆ 集客ブースト（無料撒き餌）】${c.reset}`);
  console.log(`   ${c.yellow}${c.bold}[M]${c.reset} ${c.yellow}${c.bold}📗 【無料集客リードマグネット】「OSS 15選商用化チートシート」を note に無料出品${c.reset} ${c.dim}(スキ・閲覧爆発)${c.reset}`);
  console.log(`   ${c.cyan}${c.bold}[Z]${c.reset} ${c.cyan}${c.bold}⚡ 【Zenn自動デプロイ】GitHub公式連携コンソール（全36記事・完全全自動化）${c.reset} ${c.dim}(0クリック自動公開)${c.reset}`);
  console.log(`   ${c.yellow}${c.bold}[7]${c.reset} ${c.bold}X用「今週の急上昇OSSまとめスレッド」を発行する${c.reset} ${c.dim}(ブックマーク爆弾投下)${c.reset}`);
  console.log(`   ${c.green}${c.bold}[Q]${c.reset} ${c.green}${c.bold}⚡ 【Qiitaマルチポスト】技術記事をQiitaに出品${c.reset} ${c.dim}(国内2大巨頭完全制覇)${c.reset}`);
  console.log(`   ${c.green}${c.bold}[S]${c.reset} ${c.bold}☁️ 【クラウド同期】変更を自動コミット＆GitHubへ安全同期${c.reset} ${c.dim}(AGENT_RULES準拠)${c.reset}`);

  console.log(`\n  ${c.magenta}${c.bold}【📊 収益ダッシュボード ＆ 運用管理】${c.reset}`);
  console.log(`   ${c.white}[1] note を開いて売上を確認する ${c.dim}(入金確認)${c.reset}`);
  console.log(`   ${c.white}[2] note メンバーシップ管理画面を開く ${c.dim}(月額1,980円の会員管理)${c.reset}`);
  console.log(`   ${c.white}[3] 今すぐ手動で最新OSSをクロール＆記事生成する ${c.dim}(緊急・テスト実行)${c.reset}`);

  console.log(`\n  ${c.dim}[0] 終了${c.reset}`);
  console.log(`${c.cyan}================================================================================${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n${c.yellow}${c.bold}番号を選んで Enter を押してください (0-9 / M / A / S / Z / Q / U / N / E) > ${c.reset}`, (choice) => {
    rl.close();
    handleChoice(choice.trim());
  });
}

function handleChoice(choice) {
  const norm = (choice || '').trim().toLowerCase();
  switch (norm) {
    case 'a':
      runAllInOnePublish();
      break;
    case 'e':
      runNoteEyecatch();
      break;
    case 'n':
      runNoteApiSync();
      break;
    case 'q':
      runPublishHelper('qiita');
      break;
    case 'u':
      runNoteUpdates();
      break;
    case 'm':
      runLeadMagnetPublish();
      break;
    case 's':
      runCloudSync();
      break;
    case 'z':
      runZennConsole();
      break;
    case '4':
      runPublishHelper('note');
      break;
    case '5':
      runPublishHelper('x');
      break;
    case '6':
      console.log(`\n${c.cyan}自社HPを開きます...${c.reset}`);
      openUrl("https://ssk0224.github.io/auto-tech-radar/");
      waitBack();
      break;
    case '7':
      runWeeklyThread();
      break;
    case '9':
      runPublishHelper('zenn');
      break;
    case '1':
      console.log(`\n${c.cyan}note を開きます（右上メニューの「売上管理」から入金を確認できます）...${c.reset}`);
      openUrl("https://note.com/");
      waitBack();
      break;
    case '2':
      console.log(`\n${c.cyan}note メンバーシップ管理画面（ダッシュボード）を開きます...${c.reset}`);
      openUrl("https://note.com/dashboard/membership");
      waitBack();
      break;
    case '3':
      runCrawlerManual();
      break;
    case '0':
      console.log(`\n${c.green}終了しました。${c.reset}\n`);
      process.exit(0);
      break;
    default:
      promptMenu();
      break;
  }
}

function waitBack() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question(`\n${c.dim}Enterキーを押すとメニューに戻ります...${c.reset}`, () => {
    rl.close();
    promptMenu();
  });
}

function runLeadMagnetPublish() {
  const leadMagnetPath = path.join(noteDir, 'LEAD_MAGNET_CHEAT_SHEET.md');
  if (!fs.existsSync(leadMagnetPath)) {
    try {
      execSync('node scripts/generate_lead_magnet_note.mjs', { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {}
  }

  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.yellow}${c.bold}📗 【無料集客リードマグネット】 note 無料記事 出品アシスト${c.reset}`);
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`);

  // 公開済みなら新規投稿しない（過去に同じ記事が 5 本公開された）。内容の更新はメニュー [U]
  if (loadHistory().LEAD_MAGNET_CHEAT_SHEET?.note || loadNoteUrls().LEAD_MAGNET_CHEAT_SHEET) {
    console.log(`  ${c.yellow}このチートシートは note に公開済みです。新しく投稿すると重複になります。${c.reset}`);
    console.log(`  内容を最新にするときは、メニュー ${c.red}${c.bold}[U]${c.reset} から既存の記事を差し替えてください。`);
    waitBack();
    return;
  }
  recordPublish('LEAD_MAGNET_CHEAT_SHEET', 'note');
  openUrl("https://note.com/notes/new");
  openFile(leadMagnetPath);

  const thumbPng = path.join(rootDir, 'public', 'ogp', 'LEAD_MAGNET_CHEAT_SHEET.png');
  if (fs.existsSync(thumbPng)) {
    exec(`explorer /select,"${thumbPng}"`);
    copyImageToClipboard(thumbPng);
  }

  console.log(`  ${c.green}✓ note新規投稿画面、原稿テキスト、専用アイキャッチ画像（PNG）を開きました！${c.reset}\n`);
  console.log(`  ${c.white}${c.bold}【重要：出品手順（1分で完了）】${c.reset}`);
  console.log(`  1. 開いたエクスプローラーの画像（選択中）を、note画面の「画像を追加」へドラッグ＆ドロップ！`);
  console.log(`     ※超高視認性サイバー調アイキャッチがセットされ、クリック率とスキが爆増します`);
  console.log(`  2. 開いたメモ帳を ${c.yellow}[Ctrl + A]${c.reset} → ${c.yellow}[Ctrl + C]${c.reset} で全コピー`);
  console.log(`  3. note投稿画面に ${c.yellow}[Ctrl + V]${c.reset} で貼り付け`);
  console.log(`  4. ${c.bold}「無料公開」${c.reset}（有料設定なし）のまま「投稿」をクリック！`);
  console.log(`\n  ${c.dim}※この記事は完全無料で読ませることで、note内の「スキ」や検索（SEO）から大量の読者を集め、${c.reset}`);
  console.log(`  ${c.dim}  記事内に配置された各OSSの有料レポートやメンバーシップ（月額1,980円）へ自動送客する【最強の集客ダム】です。${c.reset}\n`);

  waitBack();
}

// note 公開済み記事の差し替えアシスト。1本ずつ、復号した全文をクリップボードへコピーし、
// note の記事一覧と原稿を開く。オーナーが note で差し替えて Enter を押したら反映済みとして記録する
function runNoteUpdates() {
  const pending = getPendingNoteUpdates();
  console.clear();
  console.log(`${c.red}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.red}${c.bold}🛠 note 公開済み記事の差し替え（残り ${pending.length} 本）${c.reset}`);
  console.log(`${c.red}${c.bold}================================================================================${c.reset}`);
  if (pending.length === 0) {
    console.log(`\n  ${c.green}✓ すべて反映済みです。${c.reset}`);
    waitBack();
    return;
  }
  const item = pending[0];
  const title = (() => {
    try {
      return fs.readFileSync(item.noteFile, 'utf8').match(/^#\s+(.+)$/m)?.[1].trim() || item.slug;
    } catch (e) {
      return item.slug;
    }
  })();
  console.log(`\n  ${c.white}${c.bold}【${title}】${c.reset} (${item.slug})`);
  console.log(`  ${c.dim}理由: ${item.reason}${c.reset}\n`);
  if (item.duplicates.length > 0) {
    console.log(`  ${c.red}${c.bold}⚠ note に同じ記事が ${item.duplicates.length + 1} 本あります。いちばん古い 1 本を残し、次の ${item.duplicates.length} 本を「非公開」にしてください:${c.reset}`);
    item.duplicates.forEach((u) => console.log(`     ${c.red}✕ ${u}${c.reset}`));
    console.log(`     ${c.green}○ 残す: ${item.url}${c.reset}\n`);
  }

  if (item.action === 'unpublish') {
    console.log(`  ${c.bold}手順:${c.reset} note の記事一覧でこの記事を開き、「非公開」にするか削除してください。`);
    console.log(`  ${c.dim}（購入済みの方がいる場合、削除すると読めなくなります。返金方針は note の規約に従ってください）${c.reset}`);
  } else {
    let fullPath;
    try {
      fullPath = openNoteForPublishing(item.noteFile);
    } catch (e) {
      console.log(`\n${c.red}❌ ${e.message}${c.reset}`);
      waitBack();
      return;
    }
    const copied = copyFileToClipboard(fullPath);
    openFile(fullPath);
    console.log(`  ${copied ? c.cyan + '📋 修正版の全文をクリップボードにコピーしました。' : c.yellow + '開いたメモ帳で [Ctrl + A] → [Ctrl + C] で全文をコピーしてください。'}${c.reset}`);
    console.log(`  ${c.bold}手順:${c.reset}`);
    console.log(`  1. 開いた note の記事一覧でこの記事を探し、編集画面を開く`);
    console.log(`  2. 本文をすべて選択して削除し、${c.cyan}[Ctrl + V]${c.reset} で貼り付け`);
    console.log(`  3. タイトルも原稿 1 行目（# の後ろ）に合わせる（「受託80万〜250万」等の旧タイトルを残さない）`);
    console.log(`  4. 「有料エリア」の手前に有料ラインを入れ直し、価格・メンバーシップ設定を確認して更新`);
  }
  // CI が取得した記事 URL（scripts/note_urls.json）があればその記事を直接開く。無ければ記事一覧
  const noteUrl = item.url;
  openUrl(noteUrl || 'https://note.com/dashboard/contents');
  item.duplicates.forEach((u) => openUrl(u));
  if (noteUrl) console.log(`  ${c.cyan}🔗 この記事の note ページを開きました（右上のメニューから編集できます）${c.reset}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(`\n${c.yellow}${c.bold}note で反映したら Enter（後回し: s / メニューに戻る: 0） > ${c.reset}`, (ans) => {
    rl.close();
    const a = ans.trim().toLowerCase();
    if (a === '0') return promptMenu();
    if (a === 's') {
      // 後回しにした記事は今回のループでは末尾へ回す
      const spec = JSON.parse(fs.readFileSync(noteUpdatesFile, 'utf8'));
      const { [item.slug]: moved, ...rest } = spec.items;
      spec.items = { ...rest, [item.slug]: moved };
      fs.writeFileSync(noteUpdatesFile, JSON.stringify(spec, null, 2) + '\n', 'utf8');
      return runNoteUpdates();
    }
    recordNoteUpdated(item.slug, item.duplicates.length > 0);
    runNoteUpdates();
  });
}

function runPublishHelper(mode) {
  const drafts = getDrafts();
  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  if (mode === 'note') {
    console.log(`   ${c.green}${c.bold}📗 【note 有料記事出品セレクター】 出品したいレポートを選んでください${c.reset}`);
  } else if (mode === 'zenn') {
    console.log(`   ${c.cyan}${c.bold}🚀 【Zenn / Qiita 送客セレクター】 送客ドラフトを出力したいレポートを選んでください${c.reset}`);
  } else {
    console.log(`   ${c.blue}${c.bold}📱 【𝕏 ワンクリック拡散セレクター】 ポストしたいレポートを選んでください${c.reset}`);
  }
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`);

  if (drafts.length === 0) {
    console.log(`  ${c.red}まだ生成された記事がありません。メニュー[3]で生成してください。${c.reset}\n`);
    waitBack();
    return;
  }

  // 自動レコメンド対象（該当モードで未処理の一番上の記事）
  let recommendedIdx = -1;

  drafts.forEach((d, idx) => {
    const num = `[${idx + 1}]`.padEnd(5, ' ');
    const isPosted = mode === 'note' ? d.isNotePosted : (mode === 'zenn' ? d.isZennPosted : (mode === 'qiita' ? d.isQiitaPosted : d.isXPosted));
    
    // バッジ表示
    let statusBadge = '';
    if (isPosted) {
      statusBadge = `${c.dim}[✓ 完了]${c.reset}`;
    } else {
      if (recommendedIdx === -1) {
        recommendedIdx = idx;
        statusBadge = `${c.yellow}${c.bold}[★ 次の推奨]${c.reset}`;
      } else {
        statusBadge = `${c.green}[● 未完了]${c.reset}`;
      }
    }

    const cleanTitle = d.title.replace(/^【最新OSS解体新書】/, '');
    const shortTitle = cleanTitle.length > 36 ? cleanTitle.slice(0, 36) + '...' : cleanTitle;
    
    if (isPosted) {
      console.log(`  ${c.dim}${num} ${shortTitle.padEnd(40, ' ')}  ${statusBadge}${c.reset}`);
    } else {
      console.log(`  ${c.white}${c.bold}${num}${c.reset} ${c.white}${c.bold}${shortTitle.padEnd(40, ' ')}${c.reset}  ${statusBadge}`);
    }
  });

  console.log(`\n  ${c.dim}[0] メニューに戻る${c.reset}`);
  if (recommendedIdx !== -1) {
    console.log(`  ${c.yellow}💡 おすすめ: そのまま [${recommendedIdx + 1}] を選ぶと未完了の最新レポートを投稿できます。${c.reset}`);
  }
  console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptDefault = recommendedIdx !== -1 ? ` (${recommendedIdx + 1})` : '';
  rl.question(`\n${c.yellow}${c.bold}記事番号を入力して Enter${promptDefault} > ${c.reset}`, (ans) => {
    rl.close();
    let idx = parseInt(ans.trim(), 10);
    if (ans.trim() === '' && recommendedIdx !== -1) {
      idx = recommendedIdx + 1;
    }
    if (isNaN(idx) || idx === 0) {
      promptMenu();
      return;
    }

    const selected = drafts[idx - 1];
    if (!selected) {
      console.log(`${c.red}無効な番号です。${c.reset}`);
      setTimeout(promptMenu, 1500);
      return;
    }

    // 公開済みの記事を選んだら、新規投稿（重複出品・重複ポスト）になる前に確認する
    const alreadyPosted = mode === 'note' ? selected.isNotePosted : mode === 'x' ? selected.isXPosted : false;
    if (alreadyPosted) {
      const rlc = readline.createInterface({ input: process.stdin, output: process.stdout });
      rlc.question(`\n${c.red}${c.bold}この記事は公開済みです。もう一度出すと重複になります（note の修正はメニュー [U]）。それでも開きますか？ (y/N) > ${c.reset}`, (yn) => {
        rlc.close();
        if (yn.trim().toLowerCase() === 'y') proceed();
        else promptMenu();
      });
      return;
    }
    proceed();

    function proceed() {
    // 有料部分を復号した出品用の完全版（リポジトリ外に保存）を用意。鍵が無ければ記録せずに戻る
    let noteOpenPath = null;
    if (mode === 'note') {
      try {
        noteOpenPath = openNoteForPublishing(selected.noteFile);
      } catch (e) {
        console.log(`\n${c.red}❌ ${e.message}${c.reset}`);
        waitBack();
        return;
      }
    }

    // 投稿履歴の記録（note 以外は即時、note は出品完了確認後に記録）
    if (mode !== 'note') {
      recordPublish(selected.slug, mode);
    }

    if (mode === 'note') {
      openUrl("https://note.com/notes/new");
      openFile(noteOpenPath);

      // 記事専用のサムネイルPNG（OGPカード）
      const thumbPng = path.join(rootDir, 'public', 'ogp', `${selected.slug}.png`);
      let hasImage = false;
      let copiedToClip = false;

      if (fs.existsSync(thumbPng)) {
        hasImage = true;
        // 1. 画像ビューアで直接プレビュー表示
        openFile(thumbPng);
        // 2. エクスプローラーで画像ファイルを自動選択・ハイライト
        exec(`explorer /select,"${thumbPng}"`);
        // 3. クリップボードに画像を自動コピー（note見出し画像でCtrl+V即貼り付け可能）
        copiedToClip = copyImageToClipboard(thumbPng);
      }

      console.log(`\n${c.green}${c.bold}================================================================================${c.reset}`);
      console.log(`  ${c.green}✓ note新規投稿画面 と 原稿テキスト（${selected.slug}）を開きました！${c.reset}`);
      if (hasImage) {
        console.log(`  ${c.yellow}🖼️  専用サムネイル画像（${selected.slug}.png）も自動オープン ＆ エクスプローラー選択完了！${c.reset}`);
        if (copiedToClip) {
          console.log(`  ${c.cyan}📋 【神機能】サムネイル画像をクリップボードに自動コピーしました！${c.reset}`);
        }
      }
      console.log(`  ${c.dim}※ ブラウザで出品完了後、Enterキーを押すと「出品済み [✓]」として記録され、URL対応表が同期されます。${c.reset}`);
      console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
      console.log(`  ${c.bold}【出品手順 (最短30秒)】${c.reset}`);
      if (hasImage) {
        console.log(`  ${c.yellow}0. [見出し画像の設定]${c.reset}`);
        console.log(`     ・noteの「画像を追加」をクリックして ${c.cyan}[Ctrl + V]${c.reset}（クリップボードから即貼付け）`);
        console.log(`     ・または、自動で開いたフォルダから画像をドラッグ＆ドロップ！`);
      }
      console.log(`  1. 開いたメモ帳でタイトル（1行目の # の後ろ）をタイトル欄にコピー`);
      console.log(`  2. 2行目以降の本文を全選択して note 本文欄に ${c.cyan}[Ctrl + V]${c.reset} で貼り付け`);
      console.log(`  3. 「有料エリア」の手前で「有料ライン」を挿入`);
      console.log(`  4. 価格を ${c.yellow}¥980${c.reset} に設定し、メンバーシップ特典にも追加して公開！`);
      console.log(`${c.green}${c.bold}================================================================================${c.reset}\n`);

      const rlConfirm = readline.createInterface({ input: process.stdin, output: process.stdout });
      rlConfirm.question(`\n${c.yellow}${c.bold}note での出品が完了したら Enter を押してください（スキップ: s / メニューへ: 0） > ${c.reset}`, (cAns) => {
        rlConfirm.close();
        if (cAns.trim() !== '0' && cAns.trim().toLowerCase() !== 's') {
          recordPublish(selected.slug, 'note');
          console.log(`\n  ${c.green}✓ note出品完了を記録しました。note_urls.json を同期中...${c.reset}`);
          try {
            execSync('node scripts/sync_note_urls.mjs', { cwd: rootDir, stdio: 'inherit' });
          } catch (e) {}
        } else {
          console.log(`\n  ${c.yellow}出品をスキップしました（ステータスは未完了のまま保持されます）。${c.reset}`);
        }
        waitBack();
      });
    } else if (mode === 'zenn') {
      const zennDir = path.join(rootDir, 'zenn_drafts');
      if (!fs.existsSync(zennDir)) fs.mkdirSync(zennDir, { recursive: true });
      const zennFile = path.join(zennDir, `${selected.slug}_zenn.md`);

      // Zennドラフトが存在しない場合はオンデマンド生成
      if (!fs.existsSync(zennFile)) {
        const radarMd = path.join(rootDir, 'src', 'pages', 'radar', `${selected.slug}.md`);
        let articleContent = '';
        if (fs.existsSync(radarMd)) {
          articleContent = fs.readFileSync(radarMd, 'utf8');
          articleContent = articleContent.replace(/^---[\s\S]*?---\n*/, '');
        } else {
          // note 原稿は有料部分が暗号化済みのため Zenn には流用しない
          console.log(`\n${c.red}❌ Web記事（src/pages/radar/${selected.slug}.md）が無いため Zenn 原稿を作れません。${c.reset}`);
          waitBack();
          return;
        }
        const cleanTitle = selected.title.replace(/^#\s*/, '').split(' - ')[0].trim();
        const zennDraft = `---
title: "【徹底解剖】海外急上昇OSS「${cleanTitle}」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["ai", "oss", "github", "architecture", "programming"]
published: true
---

${articleContent}

---

${zennCta(selected.slug)}`;
        fs.writeFileSync(zennFile, zennDraft, 'utf8');
      }

      // クリップボードに原稿をUTF-8で自動コピー
      try {
        execSync(`powershell -NoProfile -Command "Get-Content -LiteralPath '${zennFile.replace(/'/g, "''")}' -Raw -Encoding UTF8 | Set-Clipboard"`, { stdio: 'ignore' });
      } catch (e) {}

      openFile(zennFile);
      openUrl("https://zenn.dev/");

      console.log(`\n${c.cyan}${c.bold}================================================================================${c.reset}`);
      console.log(`  ${c.cyan}✓ Zennホーム画面 と 送客ドラフト（${selected.slug}_zenn.md）を開きました！${c.reset}`);
      console.log(`  ${c.green}📋 【神機能】記事全文をクリップボードに自動コピーしました！${c.reset}`);
      console.log(`  ${c.dim}※ この記事は「Zenn送客済み [✓]」としてステータスを自動記録しました。${c.reset}`);
      console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
      console.log(`  ${c.bold}【投稿手順 (最短20秒)】${c.reset}`);
      console.log(`  1. ブラウザ右上の青い ${c.cyan}「投稿する」${c.reset} ボタンをクリック`);
      console.log(`  2. エディタが開いたら ${c.cyan}[Ctrl + V]${c.reset} を押して貼り付け（クリップボードから即貼付け）`);
      console.log(`  3. 「公開」を押すだけで、Auto Tech Radarへの恒久的SEO被リンクが完成！`);
      console.log(`  ※ Qiitaにも同じ文面を https://qiita.com/drafts/new でそのまま貼り付け可能です。`);
      console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`);
      waitBack();
    } else if (mode === 'qiita') {
      const radarMd = path.join(rootDir, 'src', 'pages', 'radar', `${selected.slug}.md`);
      let articleContent = '';
      if (fs.existsSync(radarMd)) {
        articleContent = fs.readFileSync(radarMd, 'utf8');
        articleContent = articleContent.replace(/^---[\s\S]*?---\n*/, '');
      } else {
        // note 原稿は有料部分が暗号化済みのため Qiita には流用しない
        console.log(`\n${c.red}❌ Web記事（src/pages/radar/${selected.slug}.md）が無いため Qiita 原稿を作れません。${c.reset}`);
        waitBack();
        return;
      }
      const cleanTitle = selected.title.replace(/^#\s*/, '').split(' - ')[0].trim();
      const qiitaText = `# 【徹底解剖】海外急上昇OSS「${cleanTitle}」のアーキテクチャと商用展開\n\n` +
        articleContent + '\n\n---\n\n' + zennCta(selected.slug);

      copyTextToClipboard(qiitaText);
      openUrl("https://qiita.com/drafts/new");

      console.log(`\n${c.green}${c.bold}================================================================================${c.reset}`);
      console.log(`  ${c.green}✓ Qiita新規投稿画面を開きました！${c.reset}`);
      console.log(`  ${c.cyan}📋 【神機能】Qiita用送客記事（${selected.slug}）をクリップボードに自動コピーしました！${c.reset}`);
      console.log(`  ${c.dim}※ この記事は「Qiita送客済み [✓]」としてステータスを自動記録しました。${c.reset}`);
      console.log(`${c.green}--------------------------------------------------------------------------------${c.reset}`);
      console.log(`  【投稿手順 (最短15秒)】`);
      console.log(`  1. ブラウザの本文欄で ${c.cyan}[Ctrl + V]${c.reset} を押して貼り付け`);
      console.log(`  2. タグ欄に ${c.yellow}Python, OSS, GitHub, AI, アーキテクチャ${c.reset} 等を入力`);
      console.log(`  3. 「Qiitaに投稿」をクリックするだけで、国内最大の技術コミュニティからアクセスを独占！`);
      console.log(`${c.green}${c.bold}================================================================================${c.reset}\n`);
      waitBack();
    } else {
      if (selected.xFile) {
        openFile(selected.xFile);
        let safeData = null;
        try {
          const xText = fs.readFileSync(selected.xFile, 'utf8');
          const rawTweet = extractTweet1(xText, selected.title);
          safeData = sanitizeAndAttachUrlToTweet(rawTweet, selected.slug);
        } catch (e) {
          safeData = sanitizeAndAttachUrlToTweet(selected.title, selected.slug);
        }

        openUrl(safeData.intentUrl);
        copyTextToClipboard(safeData.tweet);

        console.log(`\n${c.blue}${c.bold}================================================================================${c.reset}`);
        console.log(`  ${c.blue}✓ X投稿画面を開きました（記事リンク自動挿入 ＆ 文字数安全チェック済み）！${c.reset}`);
        console.log(`  ${c.cyan}  ・投稿文字数: ${safeData.charsJp} 文字 / 140 文字制限 (安全マージン: ${((280 - safeData.weight) / 2).toFixed(1)}文字)${c.reset}`);
        console.log(`  ${c.yellow}  ・挿入リンク: https://ssk0224.github.io/auto-tech-radar/radar/${selected.slug}/${c.reset}`);
        console.log(`  ${c.green}📋 【安全】ポスト本文をクリップボードにも自動コピーしました！${c.reset}`);
        console.log(`  ${c.white}👉 ブラウザでそのまま青い「ポストする」を押すだけで投稿完了です！${c.reset}`);
        console.log(`${c.blue}${c.bold}================================================================================${c.reset}\n`);
        waitBack();
      } else {
        const safeData = sanitizeAndAttachUrlToTweet('最新OSS徹底解剖レポートを公開しました！', selected.slug);
        openUrl(safeData.intentUrl);
        waitBack();
      }
    }
    }
  });
}

// ⚡ Zenn 公式GitHub自動連携コンソール
function runZennConsole() {
  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.yellow}⚡ Zenn 公式GitHub自動連携コンソール${c.reset}  ${c.white}${c.bold}|  完全自動デプロイ管理${c.reset}`);
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);

  const articlesDir = path.join(rootDir, 'articles');
  const count = fs.existsSync(articlesDir) ? fs.readdirSync(articlesDir).filter(f => f.endsWith('.md')).length : 0;

  console.log(`  ${c.dim}連携ステータス:${c.reset} ${c.green}${c.bold}● 完全全自動化対応済み (GitHub Actions連動)${c.reset}`);
  console.log(`  ${c.dim}対象リポジトリ:${c.reset} ${c.cyan}ssk0224/auto-tech-radar${c.reset}  |  ${c.dim}ブランチ:${c.reset} ${c.white}main${c.reset}`);
  console.log(`  ${c.dim}連携ディレクトリ:${c.reset} ${c.yellow}articles/*.md${c.reset}  (${c.white}${c.bold}全 ${count} 本のレポート待機中${c.reset})`);
  console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
  console.log(`  ${c.bold}【完全自動化の仕組み】${c.reset}`);
  console.log(`  1. 毎朝6:17 JSTにGitHub Actionsが急上昇OSSを自動巡回・日本語記事化。`);
  console.log(`  2. 自動的に ${c.yellow}articles/xxx.md${c.reset} を生成し、GitHubに自動プッシュ。`);
  console.log(`  3. Zenn公式GitHub連携が検知し、${c.green}${c.bold}ユーザーの操作不要で自動公開${c.reset}されます！`);
  console.log(`${c.yellow}--------------------------------------------------------------------------------${c.reset}`);
  console.log(`  ${c.yellow}${c.bold}💡 【完全自動同期（完全放置）の重要設定】:${c.reset}`);
  console.log(`     GitHubのセキュリティ仕様上、標準GITHUB_TOKENのPushはZennの自動検知が抑制される場合があります。`);
  console.log(`     リポジトリの Secrets に ${c.cyan}${c.bold}GH_PAT${c.reset} (Personal Access Token) を登録すると、100%完全放置でZennへ自動同期されます。`);
  console.log(`     ※未登録の場合でも、Zennデプロイ画面で「同期」を押すだけでいつでも最新記事が一括反映されます！`);
  console.log(`${c.cyan}================================================================================${c.reset}`);

  console.log(`\n  ${c.white}${c.bold}[1]${c.reset} ${c.cyan}${c.bold}Zenn公式 GitHub連携設定画面を開く${c.reset} ${c.dim}(https://zenn.dev/dashboard/deploys - 初回1回のみ)${c.reset}`);
  console.log(`  ${c.white}${c.bold}[2]${c.reset} ${c.white}Zenn ダッシュボードを開く${c.reset} ${c.dim}(https://zenn.dev/dashboard - 公開状況・閲覧数チェック)${c.reset}`);
  console.log(`  ${c.white}${c.bold}[3]${c.reset} ${c.white}Qiitaや他媒体に手動でマルチポストする${c.reset} ${c.dim}(個別記事をクリップボードコピー)${c.reset}`);
  console.log(`  ${c.dim}[0] メインメニューに戻る${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n${c.yellow}${c.bold}番号を選んで Enter > ${c.reset}`, (ans) => {
    rl.close();
    const a = ans.trim();
    if (a === '1') {
      console.log(`\n${c.cyan}ZennのGitHub連携設定画面を開きます...${c.reset}`);
      openUrl("https://zenn.dev/dashboard/deploys");
      waitBack();
    } else if (a === '2') {
      console.log(`\n${c.cyan}Zennのダッシュボードを開きます...${c.reset}`);
      openUrl("https://zenn.dev/dashboard");
      waitBack();
    } else if (a === '3') {
      runPublishHelper('zenn');
    } else {
      promptMenu();
    }
  });
}

// 🚀 【全チャネル一括アシスト】Turboフロー
function runAllInOnePublish() {
  const drafts = getDrafts();
  const target = drafts.find(d => !d.isNotePosted || !d.isXPosted) || drafts[0];

  if (!target) {
    console.log(`\n${c.red}処理対象の記事がありません。${c.reset}\n`);
    waitBack();
    return;
  }

  console.clear();
  console.log(`${c.magenta}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.yellow}🚀 【最速一括アシスト（Turbo）】${c.reset} 対象: ${c.white}${target.title}${c.reset}`);
  console.log(`${c.magenta}${c.bold}================================================================================${c.reset}\n`);
  console.log(`最短30秒で「note有料出品」→「𝕏拡散」のマネタイズパイプラインを連続実行します。\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // note に公開済みの記事を再び新規投稿すると重複出品になる（過去に 7 本が二重に公開された原因）。X だけ進める
  const step1 = target.isNotePosted
    ? `${c.dim}[Step 1/2] note は公開済みのためスキップします（修正版への差し替えはメニュー [U]）。Enter で次へ > ${c.reset}`
    : `${c.green}${c.bold}[Step 1/2] note出品画面と原稿を開きますか？ (Enterで実行 / sでスキップ) > ${c.reset}`;
  rl.question(step1, (ans) => {
    rl.close();
    let noteOpenPath = null;
    if (!target.isNotePosted && ans.trim().toLowerCase() !== 's') {
      try {
        noteOpenPath = openNoteForPublishing(target.noteFile);
      } catch (e) {
        console.log(`  ${c.red}❌ ${e.message}${c.reset}`);
      }
    }
    if (noteOpenPath) {
      recordPublish(target.slug, 'note');
      openUrl("https://note.com/notes/new");
      openFile(noteOpenPath);
      const thumbPng = path.join(rootDir, 'public', 'ogp', `${target.slug}.png`);
      if (fs.existsSync(thumbPng)) {
        openFile(thumbPng);
        exec(`explorer /select,"${thumbPng}"`);
        copyImageToClipboard(thumbPng);
      }
      console.log(`  ${c.green}✓ note画面・原稿・サムネイルを開き、クリップボードにコピーしました！${c.reset}`);
    }

    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl2.question(`\n${c.blue}${c.bold}[Step 2/2] X投稿画面とスレッドを開きますか？ (Enterで実行 / sでスキップ) > ${c.reset}`, (ans2) => {
      rl2.close();
      if (ans2.trim().toLowerCase() !== 's' && target.xFile) {
        recordPublish(target.slug, 'x');
        openFile(target.xFile);
        let safeData = null;
        try {
          const xText = fs.readFileSync(target.xFile, 'utf8');
          const rawTweet = extractTweet1(xText, target.title);
          safeData = sanitizeAndAttachUrlToTweet(rawTweet, target.slug);
        } catch (e) {
          safeData = sanitizeAndAttachUrlToTweet(target.title, target.slug);
        }

        openUrl(safeData.intentUrl);
        copyTextToClipboard(safeData.tweet);

        console.log(`  ${c.blue}✓ X投稿画面を開きました（記事リンク自動挿入 ＆ 文字数安全チェック済み）！${c.reset}`);
        console.log(`  ${c.cyan}  ・投稿文字数: ${safeData.charsJp} 文字 / 140 文字制限 (安全マージン: ${((280 - safeData.weight) / 2).toFixed(1)}文字)${c.reset}`);
        console.log(`  ${c.yellow}  ・挿入リンク: https://ssk0224.github.io/auto-tech-radar/radar/${target.slug}/${c.reset}`);
        console.log(`  ${c.green}📋 【安全】ポスト本文をクリップボードにも自動コピーしました！${c.reset}`);
        console.log(`  ${c.white}👉 ブラウザでそのまま青い「ポストする」を押すだけで投稿完了です！${c.reset}`);
      }

      console.log(`\n${c.green}${c.bold}🎉 note出品 ＆ 𝕏拡散の準備がすべて完了しました！最短マネタイズ実行完了です！${c.reset}\n`);
      waitBack();
    });
  });
}

// ☁️ 【クラウド同期】
function runCloudSync() {
  console.clear();
  console.log(`${c.green}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.green}${c.bold}☁️ 【クラウド同期】変更を自動コミット＆GitHubへ安全同期${c.reset}`);
  console.log(`${c.green}${c.bold}================================================================================${c.reset}\n`);
  try {
    console.log('1. サイトの静的ビルド (npm run build)...');
    execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
    console.log('\n2. 変更ファイルをステージング (git add)...');
    execSync('git add .', { cwd: rootDir, stdio: 'inherit' });
    console.log('\n3. コミットを作成中...');
    const today = new Date().toISOString().split('T')[0];
    try {
      execSync(`git commit -m "feat(radar): auto-sync intelligence, drafts, and assets (${today})"`, { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {
      console.log('コミット対象の新規変更はありませんでした。');
    }
    console.log('\n4. 最新のクラウド側の変更を取り込み中 (git pull --rebase)...');
    // 出品履歴・note の URL 対応表は CI と同じマージドライバで統合する（.gitattributes 参照）
    configureMergeDrivers(rootDir);
    try {
      execSync('git pull --rebase --autostash origin main', { cwd: rootDir, stdio: 'inherit' });
    } catch (e) {
      // 取り込みに失敗したら rebase を中止して元の状態に戻す（途中の状態で放置しない）
      try { execSync('git rebase --abort', { cwd: rootDir, stdio: 'ignore' }); } catch (e2) {}
      throw e;
    }
    console.log('\n5. リモートへプッシュ中 (git push)...');
    execSync('git push origin main', { cwd: rootDir, stdio: 'inherit' });
    console.log(`\n${c.green}${c.bold}✓ クラウド同期（GitHub Pages自動デプロイ開始）が完了しました！${c.reset}\n`);
  } catch (err) {
    console.log(`\n${c.red}同期中にエラーが発生しました: ${err.message}${c.reset}\n`);
  }
  waitBack();
}

function runCrawlerManual() {
  console.clear();
  console.log(`${c.yellow}${c.bold}=== 最新OSS手動クロール ＆ 記事自動生成パイプライン ===${c.reset}\n`);
  console.log(`GitHub Search API ＆ Gemini 2.5 Flashによる日本語解剖を即時実行します...\n`);
  try {
    execSync('node scripts/crawl_and_generate.mjs', { stdio: 'inherit' });
    console.log(`\n${c.green}${c.bold}✓ クロールと記事生成が正常に完了しました！${c.reset}\n`);
  } catch (err) {
    console.log(`\n${c.red}エラーが発生しました: ${err.message}${c.reset}\n`);
  }
  waitBack();
}

function runWeeklyThread() {
  console.clear();
  console.log(`${c.yellow}${c.bold}=== 【集客ブースト】X用 週次まとめスレッド発行 ===${c.reset}\n`);
  console.log(`ストックされた急上昇OSSからTop 7を厳選し、週次まとめスレッドテキストを生成します...\n`);
  try {
    execSync('node scripts/generate_weekly_thread.mjs', { stdio: 'inherit' });
    console.log(`\n${c.green}${c.bold}✓ スレッド生成とX投稿画面の起動が完了しました！${c.reset}\n`);
  } catch (err) {
    console.log(`\n${c.red}エラーが発生しました: ${err.message}${c.reset}\n`);
  }
  waitBack();
}

// 本文の一括自動更新は、ブラウザで実行するスクリプトがリポジトリに無いため使えない（開くだけでは何も更新されない）。
// CI が公開中の note を検査して見つけた要修正の記事を、[U] で 1 本ずつ差し替える流れに案内する
function runNoteApiSync() {
  console.clear();
  console.log(`${c.yellow}${c.bold}[N] の本文一括更新は現在使えません。${c.reset}`);
  console.log(`  note 側で実行するスクリプトが保存されておらず、画面を開くだけでは記事は更新されません。`);
  console.log(`  かわりに [U] で、GitHub が note の公開内容を検査して見つけた要修正の記事を 1 本ずつ開きます（全文はクリップボードに自動コピー）。\n`);
  runNoteUpdates();
}

// note の見出し画像（アイキャッチ）を、公開済みで未設定の記事に一括で設定する。
// ローカルブリッジ（--eyecatch-only は秘密鍵不要）を起動し、ブラウザで実行するスクリプトをクリップボードへコピーする
function runNoteEyecatch() {
  console.clear();
  console.log(`${c.cyan}${c.bold}=== 🖼 note 見出し画像の一括設定（自動） ===${c.reset}\n`);
  console.log(`専用の Chrome が開きます。初回だけ、その窓で note にログインしてください（以後は不要）。\n`);
  try {
    execSync('node scripts/note_browser.mjs eyecatch', { cwd: rootDir, stdio: 'inherit' });
    console.log(`\n${c.green}✓ 完了しました。次の GitHub の実行で note 側の反映を確認し、ヘッダーの「見出し画像なし」の本数が更新されます。${c.reset}`);
  } catch (e) {
    console.log(`\n${c.red}見出し画像を設定できなかった記事があります（上の ✕ を確認）。${c.reset}`);
  }
  waitBack();
}

// 起動時と終了時に、24時間より古い出品用の完全版（平文の有料本文）を消す。終了時はすべて消す
purgeOpenedNotes();
process.on('exit', () => purgeOpenedNotes(0));

// 起動
promptMenu();
