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
  console.log(`${C.bold}${C.green}▶ [ステップ 1/3] Stripe（自社サイト直接決済・最速入金）の設定と支払いリンク発行${C.reset}`);
  console.log(`${C.dim}─────────────────────────────────────────────────────────────────────────────${C.dim}${C.reset}`);
  console.log(`Stripe は、世界標準のクレジットカード決済システムです。`);
  console.log(`自社サイト上で読者が記事を購入した際、${C.bold}${C.yellow}noteの手数料を取られずに直接あなたの銀行口座へ入金${C.reset}されます。\n`);

  console.log(`${C.bold}【🎉 ビジネスプロフィール作成完了後の最終手順（3分で開通）】${C.reset}`);
  console.log(`  ① Stripeダッシュボード（https://dashboard.stripe.com/）にアクセスします。`);
  console.log(`  ② 左メニューの「支払い」→ ${C.cyan}「支払いリンク (Payment Links)」${C.reset} を開きます。`);
  console.log(`  ③ 右上の ${C.bold}「＋ 新規」${C.reset} をクリックします。`);
  console.log(`  ④ 商品設定:`);
  console.log(`     - 商品名: ${C.yellow}Auto Tech Radar PRO${C.reset}`);
  console.log(`     - 金額: ${C.yellow}980 円${C.reset}（1回限り）`);
  console.log(`  ⑤ 「支払い後（確認ページ）」の設定:`);
  console.log(`     - 「お客様を自分のウェブサイトにリダイレクト」を選択`);
  console.log(`     - URL: ${C.cyan}https://ssk0224.github.io/auto-tech-radar/success/${C.reset}`);
  console.log(`  ⑥ 右上の「リンクを作成」を押し、発行されたURL（https://buy.stripe.com/...）をコピー！`);
  console.log(`  ⑦ ランチャーの ${C.bold}${C.green}メニュー[8]${C.reset} に貼り付ければ、自社サイトが全世界LIVE課金モードに突入します！\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 ブラウザで Stripe ダッシュボードを開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://dashboard.stripe.com/");
    console.log(`\n${C.green}✓ ブラウザで Stripe ダッシュボードを開きました。${C.reset}`);
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

  const answer = await prompt(`${C.bold}${C.yellow}👉 note 投稿画面と完成原稿（メモ帳）を開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    openBrowser("https://note.com/notes/new");
    exec(`start notepad "C:\\Users\\free1\\auto-tech-radar\\note_drafts\\answer-me-with-html_note.md"`);
    console.log(`\n${C.green}✓ note 投稿画面と完成原稿（メモ帳）を開きました！${C.reset}`);
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
  console.log(`親ツイートの投稿画面をブラウザで直接起動します。\n`);

  const answer = await prompt(`${C.bold}${C.yellow}👉 X 投稿画面とスレッド全文を開きますか？ (y/n) [デフォルト: y]: ${C.reset}`);
  if (answer.toLowerCase() !== "n") {
    const tweetUrl = "https://twitter.com/intent/tweet?text=GitHub%E3%81%A7%E6%80%A5%E4%B8%8A%E6%98%87%E4%B8%AD%E3%81%AEOSS%E3%80%8Canswer-me-with-html%E3%80%8D%E3%81%8C%E5%87%84%E3%81%99%E3%81%8E%E3%82%8B%E3%80%82%0AAnswer%20me%20with%20HTML%20%E2%80%94%20an%20agent%20skill%20that%20answers%20hard%20questions%20with%20a%20one-page%20HTML%20you%20can%20actually%20read.%20%E8%AE%A9%20AI%20Agent%20%E7%94%A8%E4%B8%80%E9%A1%B5%20HTML%20%E5%9B%9E%E7%AD%94%E5%A4%8D%E6%9D%82%E9%97%AE%E9%A2%98%E3%80%82%0A%E2%AD%90%20%E3%82%B9%E3%82%BF%E3%83%BC%E6%95%B0%3A%202358%0A%E4%B8%BB%E8%A6%81%E6%8A%80%E8%A1%93%3A%20%23JavaScript%20%23OSS%20%23AI%E9%96%8B%E7%99%BA%0A%E2%96%BC%20%E8%A9%B3%E7%B4%B0%E3%81%A8%E3%83%93%E3%82%B8%E3%83%8D%E3%82%B9%E6%B4%BB%E7%94%A8%E3%81%AE%E8%80%83%E5%AF%9F%E3%81%AF%E3%83%84%E3%83%AA%E3%83%BC%E3%81%B8%E2%86%93%0Ahttps%3A%2F%2Fgithub.com%2FQingYunA%2Fanswer-me-with-html";
    openBrowser(tweetUrl);
    exec(`start notepad "C:\\Users\\free1\\auto-tech-radar\\x_posts\\answer-me-with-html_x.txt"`);
    console.log(`\n${C.green}✓ X 投稿画面とスレッド全文（メモ帳）を開きました！${C.reset}`);
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
