import readline from "readline";
import { exec } from "child_process";

// ANSIカラー定義（Claude Code 風のモダンUI）
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgBlue: "\x1b[44m",
  bgCyan: "\x1b[46m",
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function openBrowser(url) {
  exec(`start "" "${url}"`);
}

function prompt(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(`${C.bold}${C.cyan}╔═══════════════════════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║${C.reset}   ${C.bold}📡 Auto Tech Radar - 収益化・受取口セットアップナビゲーター (Claude Edition)${C.reset}  ${C.bold}${C.cyan}║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚═══════════════════════════════════════════════════════════════════════════════╝${C.reset}\n`);
}

// -------------------------------------------------------------
// ステップ1: Stripe 開設ナビ
// -------------------------------------------------------------
async function guideStripe() {
  clearScreen();
  printHeader();
  console.log(`${C.bold}${C.green}▶ [ステップ 1/3] Stripe（自社サイト直接決済・最速入金）の開設${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`Stripe は、世界標準のクレジットカード決済システムです。`);
  console.log(`自社サイト上で読者が記事を購入した際、${C.bold}${C.yellow}noteの手数料を取られずに直接あなたの銀行口座へ入金${C.reset}されます。\n`);

  console.log(`${C.bold}【画面操作の手順】${C.reset}`);
  console.log(`  ① これからブラウザで登録画面が開きます。`);
  console.log(`  ② ${C.cyan}「Google で続行」${C.reset} またはお使いの Gmail アドレスを入力します。`);
  console.log(`  ③ 本人確認画面で、売上を受け取る ${C.bold}あなたの銀行口座（支店名・口座番号）${C.reset} を入力します。`);
  console.log(`  ④ 完了後、ダッシュボードの「開発者」→「APIキー」にある公開可能キー（pk_live_...）または`);
  console.log(`     「支払いリンク（Payment Links）」で980円のリンクを作成します。\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 ブラウザで Stripe 登録画面を開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://dashboard.stripe.com/register");
    console.log(`\n${C.green}✓ ブラウザで Stripe 登録画面を開きました。${C.reset}`);
  }

  console.log(`\n登録作業が終わったら、Enterキーを押してメニューに戻ってください。`);
  await prompt(`[Enter を押して戻る]`);
}

// -------------------------------------------------------------
// ステップ2: note 開設ナビ
// -------------------------------------------------------------
async function guideNote() {
  clearScreen();
  printHeader();
  console.log(`${C.bold}${C.green}▶ [ステップ 2/3] note（有料記事販売・即金化）の開設${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`note は、日本最大の有料コンテンツ販売プラットフォームです。`);
  console.log(`毎朝自動生成されるドラフトを貼り付けるだけで、${C.bold}${C.yellow}1記事500円〜980円で販売${C.reset}できます。\n`);

  console.log(`${C.bold}【画面操作の手順】${C.reset}`);
  console.log(`  ① これからブラウザで note 会員登録画面が開きます。`);
  console.log(`  ② 画面下の ${C.cyan}「Googleで登録」${C.reset} を押して、お使いの Gmail を選ぶだけで即登録完了です。`);
  console.log(`  ③ 登録後、右上のアイコン →「アカウント設定」→「お支払い・振込先」から`);
  console.log(`     売上受取用の ${C.bold}銀行口座${C.reset} を登録してください。\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 ブラウザで note 登録画面を開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://note.com/signup");
    console.log(`\n${C.green}✓ ブラウザで note 登録画面を開きました。${C.reset}`);
  }

  console.log(`\n登録作業が終わったら、Enterキーを押してメニューに戻ってください。`);
  await prompt(`[Enter を押して戻る]`);
}

// -------------------------------------------------------------
// ステップ3: X (Twitter) 開設ナビ
// -------------------------------------------------------------
async function guideX() {
  clearScreen();
  printHeader();
  console.log(`${C.bold}${C.green}▶ [ステップ 3/3] X (Twitter)（最新OSS速報アカウント）の開設${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`X は、最新技術を求めるエンジニア・副業開発者をサイトやnoteへ集客する拡散装置です。\n`);

  console.log(`${C.bold}【画面操作の手順】${C.reset}`);
  console.log(`  ① これからブラウザで X アカウント作成画面が開きます。`);
  console.log(`  ② ${C.cyan}「Google で登録」${C.reset} を押して、お使いの Gmail を選択します。`);
  console.log(`  ③ アカウント名・ユーザー名を決めます（例:「最新OSS速報@AI」「TechRadar_JP」など）。\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 ブラウザで X 登録画面を開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://x.com/signup");
    console.log(`\n${C.green}✓ ブラウザで X 登録画面を開きました。${C.reset}`);
  }

  console.log(`\n登録作業が終わったら、Enterキーを押してメニューに戻ってください。`);
  await prompt(`[Enter を押して戻る]`);
}

// -------------------------------------------------------------
// note 有料記事を出品する手順案内
// -------------------------------------------------------------
async function guidePublishNote() {
  clearScreen();
  printHeader();
  console.log(`${C.bold}${C.magenta}📝 今朝生成された有料記事を note で販売する（3分で完了）${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`すでに今朝、最高品質の有料記事ドラフト（answer-me-with-html 等）が生成されています。\n`);

  console.log(`${C.bold}【出品手順】${C.reset}`);
  console.log(`  ① note の「投稿」→「テキスト」を開く。`);
  console.log(`  ② ドラフトフォルダ内の記事テキストを ${C.bold}全選択（Ctrl+A）してコピー（Ctrl+C）${C.reset}、note に貼り付け。`);
  console.log(`  ③ 途中の ${C.yellow}「【有料ライン（推奨販売価格: 500円〜980円）ここから先は有料会員限定】」${C.reset} の位置で`);
  console.log(`     noteの「＋」ボタンから ${C.bold}「有料エリア設定」${C.reset} を挿入。`);
  console.log(`  ④ 販売価格（例: 500円〜980円）を設定して「公開」をクリック！\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 note 投稿画面とドラフトフォルダを同時に開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://note.com/notes/new");
    exec(`start "" explorer "C:\\Users\\free1\\auto-tech-radar\\note_drafts"`);
    console.log(`\n${C.green}✓ note 投稿画面とドラフト保存フォルダを開きました。${C.reset}`);
  }

  await prompt(`\n[Enter を押して戻る]`);
}

// -------------------------------------------------------------
// X でワンクリック集客ポスト
// -------------------------------------------------------------
async function guideTweet() {
  clearScreen();
  printHeader();
  console.log(`${C.bold}${C.blue}📱 X (Twitter) で最新記事を拡散する（ワンクリック）${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`記事の投稿用スレッドが最初から作成されています。\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 X 投稿スレッドフォルダを開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    exec(`start "" explorer "C:\\Users\\free1\\auto-tech-radar\\x_posts"`);
    console.log(`\n${C.green}✓ X投稿スレッドフォルダを開きました。ファイル内のリンクを押すだけで投稿画面が出ます。${C.reset}`);
  }

  await prompt(`\n[Enter を押して戻る]`);
}

// -------------------------------------------------------------
// メインメニュー
// -------------------------------------------------------------
async function mainMenu() {
  while (true) {
    clearScreen();
    printHeader();
    console.log(`  ${C.bold}【収益受取口のセットアップ（初回のみ・Gmailで1クリック）】${C.reset}`);
    console.log(`    ${C.cyan}1${C.reset}. ${C.bold}Stripe 開設ナビ${C.reset}  (自社サイト直接決済・手数料最安・最短振込)`);
    console.log(`    ${C.cyan}2${C.reset}. ${C.bold}note 開設ナビ${C.reset}    (有料記事販売・即金化)`);
    console.log(`    ${C.cyan}3${C.reset}. ${C.bold}X (Twitter) 開設ナビ${C.reset} (拡散・集客用アカウント)`);
    console.log("");
    console.log(`  ${C.bold}【日々の収益アクション】${C.reset}`);
    console.log(`    ${C.magenta}4${C.reset}. ${C.bold}生成された有料記事を note に出品する (コピペ用画面を開く)${C.reset}`);
    console.log(`    ${C.blue}5${C.reset}. ${C.bold}X でワンクリック拡散する (投稿フォルダを開く)${C.reset}`);
    console.log(`    ${C.green}6${C.reset}. ${C.bold}全世界公開サイトを見る (GitHub Pages)${C.reset}`);
    console.log("");
    console.log(`    ${C.dim}0. 終了${C.reset}`);
    console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);

    const choice = await prompt(`${C.bold}${C.yellow}番号を選んで Enter を押してください (0-6): ${C.reset}`);

    if (choice === "1") await guideStripe();
    else if (choice === "2") await guideNote();
    else if (choice === "3") await guideX();
    else if (choice === "4") await guidePublishNote();
    else if (choice === "5") await guideTweet();
    else if (choice === "6") {
      openBrowser("https://ssk0224.github.io/auto-tech-radar/");
      console.log(`\n${C.green}✓ ブラウザでサイトを開きました。${C.reset}`);
      await prompt(`\n[Enter を押して戻る]`);
    } else if (choice === "0") {
      console.log(`\n${C.green}終了しました。${C.reset}`);
      rl.close();
      process.exit(0);
    }
  }
}

mainMenu().catch((err) => {
  console.error("エラー:", err);
  rl.close();
});
