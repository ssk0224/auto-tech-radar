import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const noteDir = path.join(rootDir, 'note_drafts');
const xDir = path.join(rootDir, 'x_posts');
const radarDir = path.join(rootDir, 'src', 'pages', 'radar');

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

// 記事原稿リスト取得
function getDrafts() {
  if (!fs.existsSync(noteDir)) return [];
  return fs.readdirSync(noteDir)
    .filter(f => f.endsWith('_note.md'))
    .map(f => {
      const fullPath = path.join(noteDir, f);
      const stat = fs.statSync(fullPath);
      const slug = f.replace('_note.md', '');
      const xFile = path.join(xDir, `${slug}_x.txt`);
      const hasX = fs.existsSync(xFile) && fs.statSync(xFile).size > 100;
      
      let title = slug;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(/^#\s+(.+)$/m);
        if (match) title = match[1].trim();
      } catch (e) {}

      return {
        slug,
        title,
        noteFile: fullPath,
        xFile: hasX ? xFile : null,
        mtime: stat.mtimeMs,
        size: stat.size
      };
    })
    .filter(d => d.size > 500)
    .sort((a, b) => b.mtime - a.mtime);
}

// 記事総数
function getPublishedCount() {
  if (!fs.existsSync(radarDir)) return 0;
  return fs.readdirSync(radarDir).filter(f => f.endsWith('.md')).length;
}

function renderHeader() {
  const publishedCount = getPublishedCount();
  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  console.log(`   ${c.yellow}⚡ Auto Tech Radar${c.reset}  ${c.white}${c.bold}|  海外急上昇OSS 徹底解剖 ＆ 【月収100万円】収益化コンソール${c.reset}`);
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  console.log(`  ${c.dim}システム稼働状況:${c.reset} ${c.green}● 全世界LIVE配信中${c.reset}  |  ${c.white}解剖レポート総数:${c.reset} ${c.cyan}${c.bold}${publishedCount} 本${c.reset}  |  ${c.magenta}GitHub Actions 自動巡回中${c.reset}`);
  console.log(`  ${c.dim}公式Webメディア :${c.reset} ${c.cyan}https://ssk0224.github.io/auto-tech-radar/${c.reset}`);
  console.log(`  ${c.dim}3大収益ピラー   :${c.reset} ①Stripe単発 (¥980)  ②noteサブスク (¥1,980/月)  ③B2B協賛 (¥100,000〜)`);
  console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
}

function promptMenu() {
  renderHeader();

  console.log(`\n  ${c.yellow}${c.bold}【🔥 日々の収益化アクション（1分ルーティン）】${c.reset}`);
  console.log(`   ${c.green}${c.bold}[4]${c.reset} ${c.bold}生成済み有料レポートを note に出品する${c.reset} ${c.dim}(最新原稿選択 ＆ 投稿画面自動起動)${c.reset}`);
  console.log(`   ${c.blue}${c.bold}[5]${c.reset} ${c.bold}最新レポートを X でワンクリック拡散する${c.reset} ${c.dim}(Gemini生成ツイート画面を即起動)${c.reset}`);
  console.log(`   ${c.cyan}${c.bold}[6]${c.reset} ${c.bold}全世界公開サイト（自社HP）を確認する${c.reset} ${c.dim}(GitHub Pages)${c.reset}`);

  console.log(`\n  ${c.magenta}${c.bold}【📊 収益ダッシュボード ＆ 運用管理】${c.reset}`);
  console.log(`   ${c.white}[1] Stripe 売上管理ダッシュボードを開く ${c.dim}(単発980円の入金確認)${c.reset}`);
  console.log(`   ${c.white}[2] note メンバーシップ管理画面を開く ${c.dim}(月額1,980円の会員管理)${c.reset}`);
  console.log(`   ${c.white}[3] 今すぐ手動で最新OSSをクロール＆記事生成する ${c.dim}(緊急・テスト実行)${c.reset}`);

  console.log(`\n  ${c.dim}[0] 終了${c.reset}`);
  console.log(`${c.cyan}================================================================================${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n${c.yellow}${c.bold}番号を選んで Enter を押してください (0-6) > ${c.reset}`, (choice) => {
    rl.close();
    handleChoice(choice.trim());
  });
}

function handleChoice(choice) {
  switch (choice) {
    case '4':
      runPublishHelper('note');
      break;
    case '5':
      runPublishHelper('x');
      break;
    case '6':
      console.log(`\n${c.cyan}自社HPを開きます...${c.reset}`);
      exec('start "" "https://ssk0224.github.io/auto-tech-radar/"');
      waitBack();
      break;
    case '1':
      console.log(`\n${c.cyan}Stripe ダッシュボードを開きます...${c.reset}`);
      exec('start "" "https://dashboard.stripe.com/"');
      waitBack();
      break;
    case '2':
      console.log(`\n${c.cyan}note メンバーシップ管理画面を開きます...${c.reset}`);
      exec('start "" "https://note.com/membership"');
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

function runPublishHelper(mode) {
  const drafts = getDrafts();
  console.clear();
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}`);
  if (mode === 'note') {
    console.log(`   ${c.green}${c.bold}📗 【note 有料記事出品セレクター】 出品したいレポートを選んでください${c.reset}`);
  } else {
    console.log(`   ${c.blue}${c.bold}📱 【𝕏 ワンクリック拡散セレクター】 ポストしたいレポートを選んでください${c.reset}`);
  }
  console.log(`${c.cyan}${c.bold}================================================================================${c.reset}\n`);

  if (drafts.length === 0) {
    console.log(`  ${c.red}まだ生成された記事がありません。メニュー[3]で生成してください。${c.reset}\n`);
    waitBack();
    return;
  }

  drafts.forEach((d, idx) => {
    const num = `[${idx + 1}]`.padEnd(5, ' ');
    const xMark = d.xFile ? `${c.green}✓ X文あり${c.reset}` : `${c.dim}(X文なし)${c.reset}`;
    const cleanTitle = d.title.replace(/^【最新OSS解体新書】/, '');
    const shortTitle = cleanTitle.length > 42 ? cleanTitle.slice(0, 42) + '...' : cleanTitle;
    console.log(`  ${c.yellow}${num}${c.reset} ${c.white}${c.bold}${shortTitle}${c.reset}  ${xMark}`);
  });

  console.log(`\n  ${c.dim}[0] メニューに戻る${c.reset}`);
  console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n${c.yellow}${c.bold}記事番号を入力して Enter > ${c.reset}`, (ans) => {
    rl.close();
    const idx = parseInt(ans.trim(), 10);
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

    if (mode === 'note') {
      exec('start "" "https://note.com/notes/new"');
      exec(`start "" "${selected.noteFile}"`);

      console.log(`\n${c.green}${c.bold}================================================================================${c.reset}`);
      console.log(`  ${c.green}✓ note新規投稿画面 と 原稿テキスト（${selected.slug}）を開きました！${c.reset}`);
      console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
      console.log(`  ${c.bold}【出品手順 (約30秒)】${c.reset}`);
      console.log(`  1. 開いたメモ帳で ${c.cyan}[Ctrl + A]${c.reset} → ${c.cyan}[Ctrl + C]${c.reset} で全コピー`);
      console.log(`  2. note投稿画面に ${c.cyan}[Ctrl + V]${c.reset} で貼り付け`);
      console.log(`  3. 「有料エリア」の手前で「有料ライン」を挿入`);
      console.log(`  4. 価格を ${c.yellow}¥980${c.reset} に設定し、メンバーシップ特典にも追加して公開！`);
      console.log(`${c.green}${c.bold}================================================================================${c.reset}\n`);
      waitBack();
    } else {
      if (selected.xFile) {
        exec(`start "" "${selected.xFile}"`);
        try {
          const xText = fs.readFileSync(selected.xFile, 'utf8');
          const match = xText.match(/https:\/\/twitter\.com\/intent\/tweet\?text=[^\s\n\r]+/);
          if (match) {
            exec(`start "" "${match[0]}"`);
          } else {
            exec('start "" "https://twitter.com/intent/tweet"');
          }
        } catch (e) {
          exec('start "" "https://twitter.com/intent/tweet"');
        }

        console.log(`\n${c.blue}${c.bold}================================================================================${c.reset}`);
        console.log(`  ${c.blue}✓ X投稿画面（本文自動入力済み） と 全スレッドテキストを開きました！${c.reset}`);
        console.log(`${c.cyan}--------------------------------------------------------------------------------${c.reset}`);
        console.log(`  ブラウザの画面で ${c.cyan}「ポストする」${c.reset} を押すだけで拡散完了です。`);
        console.log(`  （2ツリー目以降のテキストも開いたファイル内に記載されています）`);
        console.log(`${c.blue}${c.bold}================================================================================${c.reset}\n`);
        waitBack();
      } else {
        const fallbackUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('最新OSS徹底解剖レポートを公開しました！\nhttps://ssk0224.github.io/auto-tech-radar/\n#OSS #AutoTechRadar')}`;
        exec(`start "" "${fallbackUrl}"`);
        waitBack();
      }
    }
  });
}

function runCrawlerManual() {
  console.clear();
  console.log(`${c.yellow}${c.bold}=== 最新OSS手動クロール ＆ 記事自動生成パイプライン ===${c.reset}\n`);
  console.log(`GitHub Trending API直結 ＆ Gemini 3.8 Flashによる日本語解剖を即時実行します...\n`);
  try {
    execSync('node scripts/crawl_and_generate.mjs', { stdio: 'inherit' });
    console.log(`\n${c.green}${c.bold}✓ クロールと記事生成が正常に完了しました！${c.reset}\n`);
  } catch (err) {
    console.log(`\n${c.red}エラーが発生しました: ${err.message}${c.reset}\n`);
  }
  waitBack();
}

// 起動
promptMenu();
