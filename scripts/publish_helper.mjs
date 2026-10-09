import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const noteDir = path.join(rootDir, 'note_drafts');
const xDir = path.join(rootDir, 'x_posts');

const mode = process.argv[2] || 'note'; // 'note' or 'x'

// 下書き一覧を取得
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
      
      // 記事タイトルを1行目から抽出
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

const drafts = getDrafts();

if (drafts.length === 0) {
  console.log('\n❌ まだ生成された記事原稿がありません。メニューの [3] でクロールを実行してください。\n');
  process.exit(0);
}

console.clear();
console.log('===============================================================================');
if (mode === 'note') {
  console.log('       📗 【note 出品セレクター】出品したい記事の番号を選んでください');
} else {
  console.log('       📱 【X 拡散セレクター】投稿・拡散したい記事の番号を選んでください');
}
console.log('===============================================================================\n');

drafts.forEach((d, idx) => {
  const num = `[${idx + 1}]`.padEnd(5, ' ');
  const xMark = d.xFile ? '✓ X文あり' : '  (X文無)';
  const shortTitle = d.title.length > 40 ? d.title.slice(0, 40) + '...' : d.title;
  console.log(`  ${num} ${shortTitle}  (${xMark})`);
});

console.log('\n  [0] メニューに戻る\n');
console.log('-------------------------------------------------------------------------------');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('番号を入力して Enter > ', (answer) => {
  rl.close();
  const choice = parseInt(answer.trim(), 10);
  if (isNaN(choice) || choice === 0) {
    process.exit(0);
  }

  const selected = drafts[choice - 1];
  if (!selected) {
    console.log('無効な番号です。');
    process.exit(1);
  }

  console.log(`\n選択された記事: ${selected.title}\n`);

  function openUrl(url) {
    const safeUrl = url.replace(/'/g, "''");
    exec(`powershell -NoProfile -Command "Start-Process '${safeUrl}'"`);
  }

  function openFile(filePath) {
    const safePath = filePath.replace(/'/g, "''");
    exec(`powershell -NoProfile -Command "Start-Process '${safePath}'"`);
  }

  if (mode === 'note') {
    // 1. note新規投稿画面を開く
    openUrl("https://note.com/notes/new");
    // 2. 原稿ファイルをメモ帳等の既定エディタで直接開く
    openFile(selected.noteFile);

    console.log('===============================================================================');
    console.log('✓ noteの新規投稿画面と、選択した原稿テキストを開きました！');
    console.log('-------------------------------------------------------------------------------');
    console.log('【出品手順】');
    console.log('  1. 開いた原稿テキストを [Ctrl + A] → [Ctrl + C] で全コピー');
    console.log('  2. note投稿画面に [Ctrl + V] で貼り付け');
    console.log('  3. 「無料プレビュー」と「有料エリア」の境界で「有料ライン」を挿入');
    console.log('  4. 価格 980円 に設定し、メンバーシップ特典にも追加して公開！');
    console.log('===============================================================================\n');
  } else {
    // X拡散モード
    if (selected.xFile) {
      openFile(selected.xFile);
      // Xスレッドの第1ツイートからIntent URLを抽出して自動起動
      try {
        const xText = fs.readFileSync(selected.xFile, 'utf8');
        const match = xText.match(/https:\/\/twitter\.com\/intent\/tweet\?text=[^\s\n\r]+/);
        if (match) {
          openUrl(match[0]);
        } else {
          openUrl("https://twitter.com/intent/tweet");
        }
      } catch (e) {
        openUrl("https://twitter.com/intent/tweet");
      }

      console.log('===============================================================================');
      console.log('✓ Xの投稿画面と、全スレッドテキスト（x_posts）を開きました！');
      console.log('-------------------------------------------------------------------------------');
      console.log('ブラウザの投稿画面で「ポストする」を押すだけで完了です。');
      console.log('（2ツイート目以降のリプライ用テキストもファイル内に用意されています）');
      console.log('===============================================================================\n');
    } else {
      console.log('⚠️ この記事の専用X投稿文がありません。共通告知画面を開きます...');
      const fallbackUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('最新OSS徹底解剖レポートを公開しました！\nhttps://ssk0224.github.io/auto-tech-radar/\n#OSS #AutoTechRadar')}`;
      openUrl(fallbackUrl);
    }
  }
});
