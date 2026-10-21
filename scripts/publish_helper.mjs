import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { sanitizeAndAttachUrlToTweet, extractTweet1 } from './utils/twitter_formatter.mjs';
import { isNoise } from './utils/noise_filter.mjs';
import { pullLatest } from './utils/git_sync.mjs';
import { copyTextToClipboard } from './utils/clipboard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const noteDir = path.join(rootDir, 'note_drafts');
const xDir = path.join(rootDir, 'x_posts');

const mode = process.argv[2] || 'note'; // 'note' or 'x'

// note の新規出品はランチャー（【収益化】AutoTechRadar.bat）のメニュー [4]・[A]・[M] からだけ行う。
// ランチャーは出品の上限（1日1本・直近7日で3本。utils/note_listing.mjs）を確かめてから出品画面を開き、出品を publish_history.json に記録する。
// ここで出品画面を開くと、上限を確かめず、出品の記録もしない（上限の本数に数えられず、重複出品も防げない）
if (mode === 'note') {
  console.log('note の新規出品は、ランチャー（【収益化】AutoTechRadar.bat）のメニュー [4] から行ってください（出品の上限の確認と出品の記録のため）。');
  process.exit(1);
}

// 起動時にリモート（GitHub Actionsが朝6時に生成した最新原稿）を自動同期（失敗したら rebase を中止して元に戻す）
process.stdout.write('🔄 最新のリモート原稿・画像を自動同期中 (Git Pull)... ');
console.log(pullLatest(rootDir, 'main', { timeout: 30000 }).ok ? '✓ 完了' : '(オフライン/スキップ)');

// 下書き一覧を取得
function getDrafts() {
  if (!fs.existsSync(noteDir)) return [];
  return fs.readdirSync(noteDir)
    .filter(f => f.endsWith('_note.md') || f === 'LEAD_MAGNET_CHEAT_SHEET.md')
    .filter(f => {
      const s = f === 'LEAD_MAGNET_CHEAT_SHEET.md' ? 'LEAD_MAGNET_CHEAT_SHEET' : f.replace('_note.md', '');
      return s === 'LEAD_MAGNET_CHEAT_SHEET' || !isNoise(s);
    })
    .map(f => {
      const fullPath = path.join(noteDir, f);
      const stat = fs.statSync(fullPath);
      const isLeadMagnet = f === 'LEAD_MAGNET_CHEAT_SHEET.md';
      const slug = isLeadMagnet ? 'LEAD_MAGNET_CHEAT_SHEET' : f.replace('_note.md', '');
      const xFile = path.join(xDir, `${slug}_x.txt`);
      const hasX = fs.existsSync(xFile) && fs.statSync(xFile).size > 100;
      
      // 記事タイトルを1行目から抽出
      let title = isLeadMagnet ? '【無料集客用】2026年最新 急上昇OSS 15選商用化早見表' : slug;
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
        mtime: isLeadMagnet ? Date.now() + 100000000 : stat.mtimeMs, // 無料リードマグネットを常に最上位に表示
        size: stat.size,
        isLeadMagnet
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

  if (mode === 'zenn') {
    // Zenn への投稿は停止中（2026-10-21）。自動生成した記事は Zenn の規約・ガイドライン（機械的に生成した文章・宣伝目的の投稿）に沿わないため、
    // 原稿は published: false の下書きのままにし、クリップボードへのコピーや投稿画面を開くことはしない
    console.error('Zenn への投稿は停止しています（自動生成した記事は Zenn の規約に沿わないため）。articles/ と zenn_drafts/ の原稿は published: false のままにしてください。');
    process.exit(1);
  } else {
    // X拡散モード
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
      const copied = copyTextToClipboard(safeData.tweet);

      console.log('===============================================================================');
      console.log('✓ Xの投稿画面を開きました（記事リンク自動挿入 ＆ 文字数安全チェック済み）！');
      console.log(`  ・投稿文字数: ${safeData.charsJp} 文字 / 140 文字制限 (安全マージン: ${((280 - safeData.weight) / 2).toFixed(1)}文字)`);
      console.log(`  ・挿入リンク: https://ssk0224.github.io/auto-tech-radar/radar/${selected.slug}/`);
      console.log('-------------------------------------------------------------------------------');
      console.log('ブラウザの投稿画面で「ポストする」を押すだけで完了です。');
      if (copied) console.log('（クリップボードにもポスト本文を自動コピーしてあります）');
      console.log('===============================================================================\n');
    } else {
      console.log('⚠️ この記事の専用X投稿文がありません。共通告知画面を開きます...');
      const safeData = sanitizeAndAttachUrlToTweet('最新OSS徹底解剖レポートを公開しました！', selected.slug);
      openUrl(safeData.intentUrl);
    }
  }
});
