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

// 起動時にリモート（GitHub Actionsが朝6時に生成した最新原稿）を自動同期
try {
  process.stdout.write('🔄 最新のリモート原稿・画像を自動同期中 (Git Pull)... ');
  execSync('git pull --rebase origin main', { cwd: rootDir, stdio: 'ignore', timeout: 8000 });
  console.log('✓ 完了');
} catch (e) {
  console.log('(オフライン/スキップ)');
}

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
} else if (mode === 'zenn') {
  console.log('       🚀 【Zenn / Qiita 送客セレクター】無料バズ用記事を出力したい番号を選んでください');
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
    exec(`rundll32 url.dll,FileProtocolHandler "${url}"`, (err) => {
      if (err) {
        exec(`start "" "${url}"`);
      }
    });
  }

  function openFile(filePath) {
    exec(`start "" "${filePath}"`);
  }

  if (mode === 'note') {
    // 1. note新規投稿画面を開く
    openUrl("https://note.com/notes/new");
    // 2. 原稿ファイルをメモ帳等の既定エディタで直接開く
    openFile(selected.noteFile);

    // 3. 記事専用のサムネイルPNGがあればエクスプローラーでハイライト表示
    const thumbPng = path.join(rootDir, 'public', 'ogp', `${selected.slug}.png`);
    if (fs.existsSync(thumbPng)) {
      exec(`explorer /select,"${thumbPng}"`);
    }

    console.log('===============================================================================');
    console.log('✓ noteの新規投稿画面、原稿テキスト、専用サムネイル画像を開きました！');
    console.log('-------------------------------------------------------------------------------');
    console.log('【出品手順（超速1分）】');
    console.log('  1. 開いたエクスプローラーの画像（選択中）を、note画面の「画像を追加」へドラッグ＆ドロップ！');
    console.log('     ※プロ級サイバー調サムネが即時セットされ、クリック率が爆増します');
    console.log('  2. 開いた原稿テキストを [Ctrl + A] → [Ctrl + C] で全コピー');
    console.log('  3. note投稿画面に [Ctrl + V] で貼り付け');
    console.log('  4. 「無料プレビュー」と「有料エリア」の境界で「有料ライン」を挿入');
    console.log('  5. 価格 980円 に設定し、メンバーシップ特典にも追加して公開！');
    console.log('===============================================================================\n');
  } else if (mode === 'zenn') {
    // Zenn / Qiita 送客モード
    const radarMd = path.join(rootDir, 'src', 'pages', 'radar', `${selected.slug}.md`);
    let articleContent = '';
    if (fs.existsSync(radarMd)) {
      articleContent = fs.readFileSync(radarMd, 'utf8');
      articleContent = articleContent.replace(/^---[\s\S]*?---\n*/, '');
    } else {
      articleContent = fs.readFileSync(selected.noteFile, 'utf8');
    }

    const cleanTitle = selected.title.replace(/^#\s*/, '').split(' - ')[0].trim();
    const zennDraft = `---
title: "【徹底解剖】海外急上昇OSS「${cleanTitle}」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ["ai", "oss", "github", "architecture", "プログラミング"]
published: true
---

${articleContent}

---

## 💡 商用化アーキテクチャ ＆ 受託開発提案テンプレートについて
本OSSを活用した**受託開発（単価80万〜250万円）の提案書テンプレート**や、自社マイクロSaaS構築仕様書、コピペで使える本番環境構築手順の完全版は、開発者向け専門メディア「Auto Tech Radar」にて全編公開されています。

👉 **[Auto Tech Radar で完全版レポートを読む（即時アンロック対応）](https://ssk0224.github.io/auto-tech-radar/radar/${selected.slug}/)**
`;

    const zennDir = path.join(rootDir, 'zenn_drafts');
    if (!fs.existsSync(zennDir)) fs.mkdirSync(zennDir, { recursive: true });
    const zennFile = path.join(zennDir, `${selected.slug}_zenn.md`);
    fs.writeFileSync(zennFile, zennDraft, 'utf8');

    try {
      execSync(`powershell -command "Get-Content -LiteralPath '${zennFile}' -Raw -Encoding UTF8 | Set-Clipboard"`);
    } catch (e) {}

    openFile(zennFile);
    openUrl("https://zenn.dev/articles/new");

    console.log('===============================================================================');
    console.log('✓ Zenn/Qiita送客用ドラフトを生成し、クリップボードに自動コピーしました！');
    console.log('-------------------------------------------------------------------------------');
    console.log('【投稿手順（30秒）】');
    console.log('  1. ブラウザで開いたZennの新規投稿画面で [Ctrl + V] を押して貼り付け');
    console.log('  2. 「公開」を押すだけで、ZennからAuto Tech Radarへの恒久的SEO送客リンクが完成！');
    console.log('  ※ Qiitaにも同じ文面を https://qiita.com/drafts/new でそのまま併用可能です');
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
