// [E]（note_browser.mjs）の安全性: 実機の note.com の構造（tests/fixtures/note_mock.mjs の説明）を再現した模擬応答で、
// 公開中と違う下書きを公開しない・有料ラインを動かさない・新規出品にしない・24 時間の本数の上限を超えない・記録に有料部分を残さない、を確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { PAID_HEAD_HTML, mockDraftMd, writeMockDrafts } from "./fixtures/note_mock.mjs";
import { hasNoteTextIssue, noteHtmlText } from "../scripts/utils/note_pending.mjs";
import { renderDraftFree } from "../scripts/utils/free_part.mjs";
import { chrome, ownerEnv, rmDir } from "./helpers/chrome.mjs";

const skip = !chrome && "Chrome が無い環境では未実施";
// [E] で aihot の次に処理される記事。note_urls.json は note の公開状態に合わせて変わるので、記事名を書かずに並び順から取る
const urlSlugs = Object.keys(JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")));
const NEXT = urlSlugs[urlSlugs.indexOf("aihot") + 1];

// cmd: maintain | eyecatch。extraEnv(keys) に note_urls.json の記事キー（slug → key）が渡る。
// history: 以前の [E] の記録（配列なら JSON で、文字列ならそのまま書く）。実行後の記録 fixes、更新された本文 live、実行記録 log を返す
function runNote(cmd, extraEnv, { history, status = {} } = {}) {
  const urls = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"));
  const keys = Object.fromEntries(Object.entries(urls).map(([slug, v]) => [slug, v.url.split("/n/")[1]]));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nbs-"));
  const dump = path.join(home, "live.json");
  const logFile = path.join(home, "note_browser_log.json");
  const historyFile = path.join(home, ".auto-tech-radar", "note_fix_history.json");
  if (history !== undefined) {
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    fs.writeFileSync(historyFile, typeof history === "string" ? history : JSON.stringify(history));
  }
  const statusFile = path.join(home, "note_status.json");
  fs.writeFileSync(statusFile, JSON.stringify({ checkedAt: "2026-10-21T00:00:00.000Z", notes: Object.fromEntries(Object.entries(status).map(([s, issues]) => [s, { issues }])) }));
  // 正本の原稿（模擬の公開中の本文と同じ構成で、直した後の文）
  const extra = extraEnv(keys);
  const drafts = writeMockDrafts(path.join(home, "drafts"), keys, extra);
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", cmd], {
      encoding: "utf8",
      timeout: 240000,
      env: {
        ...process.env, ...ownerEnv(home), CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1",
        ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: "none", ATR_NOTE_MOCK_DUMP: dump,
        ATR_NOTE_WAIT_SCALE: "0.01", ATR_NOTE_STATUS: statusFile, ATR_NOTE_LOG: logFile, ATR_NOTE_DRAFTS: drafts, ...extra,
      },
    });
    const read = (f, d) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8") : d);
    const parse = (s, d) => {
      try {
        return JSON.parse(s);
      } catch (e) {
        return d;
      }
    };
    return { status: r.status, out: r.stdout + r.stderr, live: JSON.parse(read(dump, "{}")), keys, fixes: parse(read(historyFile, "[]"), null), historyRaw: read(historyFile, null), log: read(logFile, "") };
  } finally {
    rmDir(home);
  }
}

test("見出し画像の予備の「更新する」: 編集画面の下書きが公開中と違う記事は公開しない（下書きの別の本文を出さない）", { skip }, () => {
  const r = runNote("eyecatch", (k) => ({ ATR_NOTE_MOCK_TARGET: k.zcode, ATR_NOTE_MOCK_DRIFT: k.zcode }));
  assert.deepEqual(r.live, {}, `公開していない: ${r.out}`);
  assert.match(r.out, /zcode: .*下書き.*公開中の記事.*違う/);
  assert.doesNotMatch(r.out, /✓ 見出し画像を設定: zcode/);
});

test("見出し画像の予備の「更新する」: 無料部分に直す表現が残っている記事も、本文は変えずに公開し、無料部分が更新前と同じことを確かめる", { skip }, () => {
  const r = runNote("eyecatch", (k) => ({ ATR_NOTE_MOCK_TARGET: k.zcode, ATR_NOTE_MOCK_INVOICE: k.zcode }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 見出し画像を設定: zcode/);
  assert.match(noteHtmlText(r.live[r.keys.zcode]), /インボイス対応領収書/, "見出し画像のための更新では本文を変えない");
});

test("見出し画像の予備の「更新する」: 公開されていない記事（最後のボタンが「投稿する」）は押さない（新規出品にしない）", { skip }, () => {
  const r = runNote("eyecatch", (k) => ({ ATR_NOTE_MOCK_TARGET: k.zcode, ATR_NOTE_MOCK_UNPUBLISHED: k.zcode }));
  assert.deepEqual(r.live, {}, `公開していない: ${r.out}`);
  assert.match(r.out, /zcode: .*「投稿する」）。押すと新しく出品することになるため押しません/);
});

test("[E] 公開されていない記事（最後のボタンが「投稿する」）は表現を直しても公開しない", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_MOCK_UNPUBLISHED: k.aihot }));
  assert.deepEqual(r.live, {}, `公開していない: ${r.out}`);
  assert.match(r.out, /✕ aihot: .*投稿する/);
  assert.deepEqual(r.fixes, [], "公開していないので本数に数えない");
});

test("[E] 下書きに段落以外の要素（div など）で公開していない文が残っている記事は公開しない", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_MOCK_EXTRA: k.aihot }));
  assert.deepEqual(r.live, {}, `公開していない: ${r.out}`);
  assert.match(r.out, /✕ aihot: 編集画面の下書き（\d+ 字）が公開中の記事（\d+ 字）と違うため、自動では直しません/);
});

test("[E] note_html.mjs の構造（見出し・太字・リンク・改行・箇条書き・表・引用・コード）の記事を直し、公開後の本文は「原稿の無料部分の描画＋公開中の有料部分」と同じ", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_RICH: k.aihot }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 無料部分を原稿の内容に置き換えて更新: aihot/);
  const text = (html) => noteHtmlText(html).replace(/\s+/g, "");
  const html = r.live[r.keys.aihot];
  const published = text(html);
  assert.ok(!hasNoteTextIssue(published), "直す表現が残っていない");
  // 原稿の無料部分を描画したもの＋公開中だった有料部分（変えない）と、文字が 1 字も違わない
  const want = `${renderDraftFree(mockDraftMd(new Set(["ATR_NOTE_MOCK_RICH"])))}<p>有料部分の本文です。導入手順と見積表。</p>`;
  assert.equal(published, text(want));
  // 置き換えた段落の書式（太字・リンク）を残す（文字だけ打ち込むとリンクが消える）
  assert.match(html, /<a href="https:\/\/example\.com"[^>]*>公式サイト<\/a>/);
  assert.match(html, /<strong>概要<\/strong>/);
});

test("[E] 規則表に無い書き方の古い文も、原稿の段落に置き換える。原稿が無い記事は直さず手作業として知らせる", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_STALE: k.aihot, ATR_NOTE_MOCK_NODRAFT: k[NEXT] }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 無料部分を原稿の内容に置き換えて更新: aihot（1 段落）/);
  assert.match(noteHtmlText(r.live[r.keys.aihot]), /需要が伸びている理由を、公開情報から説明します。/);
  assert.doesNotMatch(noteHtmlText(r.live[r.keys.aihot]), /爆発的|断言/);
  assert.match(r.out, new RegExp(`… ${NEXT}: 原稿（正本）が無いため、自動では直しません`));
  assert.deepEqual(Object.keys(r.live), [r.keys.aihot]);
});

test("[E] 「更新する」の直後に窓が閉じられても（オーナーが閉じた・ブラウザが落ちた）、その記事を 24 時間の本数に数える", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_MOCK_CLOSE: k.aihot }));
  assert.deepEqual(Object.keys(r.live), [r.keys.aihot], r.out);
  assert.deepEqual(r.fixes.map((f) => f.slug), ["aihot"], r.out);
});

test("[E] 直した記録のファイルが壊れていたら、本数が分からないので表現の修正を行わない（記録を消して上限を超えない）", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot }), { history: '[{"at":"2026-10-21T00:00:00.000Z","slug":"a"},{"at":' });
  assert.deepEqual(r.live, {}, r.out);
  assert.match(r.out, /記録.*読めない/);
  assert.equal(r.historyRaw, '[{"at":"2026-10-21T00:00:00.000Z","slug":"a"},{"at":', "壊れた記録を上書きしない（オーナーが確かめられるように残す）");
  assert.notEqual(r.status, 0);
});

test("[E] テスト用の上限 ATR_NOTE_FIX_MAX でも 24 時間に 12 本を超えない", { skip }, () => {
  const now = Date.now();
  const history = Array.from({ length: 12 }, (_, i) => ({ at: new Date(now - (60 - i) * 60 * 1000).toISOString(), slug: `s${i}` }));
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_FIX_MAX: "20" }), { history });
  assert.deepEqual(r.live, {}, r.out);
  assert.match(r.out, /直近24時間で 12 本直したため、今回は行いません（上限 12 本/);
});

test("[E] 下書きが公開中と違って直せない記事は、その回の本数の枠を使わない（後ろの記事を直す）", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: `${k.aihot},${k[NEXT]}`, ATR_NOTE_MOCK_DRIFT: k.aihot, ATR_NOTE_FIX_MAX: "1" }));
  assert.match(r.out, /✕ aihot: 編集画面の下書き/);
  assert.match(r.out, new RegExp(`✓ 無料部分を原稿の内容に置き換えて更新: ${NEXT}（1 段落）`));
  assert.deepEqual(Object.keys(r.live), [r.keys[NEXT]]);
});

test("[E] の実行記録に入る値（steps・失敗の理由）に、本文の文字列を入れない（数・規則の id・URL・ボタンの文言だけ）", () => {
  const src = fs.readFileSync("scripts/note_browser.mjs", "utf8");
  const pushes = [...src.matchAll(/steps\.push\(\{[\s\S]*?\}\);/g)].map((m) => m[0]);
  assert.ok(pushes.length >= 8);
  for (const p of pushes) {
    // 値として使う識別子（キー名と「.length」の数は除く）に、本文を持つ変数が無い
    const values = p.replace(/"[^"]*"/g, '""').replace(/\b[\w.]+(\([^()]*\))?\.length\b/g, "0").replace(/\b\w+\s*:/g, "");
    assert.doesNotMatch(values, /\b(body|text|after|fullAfter|draftBlocks|afterBlocks|blocks|want|got|live|free)\b/, `本文を記録に入れている: ${p}`);
  }
  // 例外の理由は 1 行目だけ（Playwright の例外は 2 行目以降に画面の要素の HTML と文字を含む）
  for (const m of src.matchAll(/(failed|manual)\.push\(([^;]*)\);/g)) {
    if (/e\.message/.test(m[2])) assert.match(m[2], /e\.message\.split\("\\n"\)\[0\]/, m[0]);
  }
  assert.doesNotMatch(src, /writeLog\(\{[^}]*e\.stack/, "例外の全文を記録に残さない");
});

// 専用プロファイルの Chrome の窓（[U] などで開いた note の画面）が開いたままだと、自動操作の Chrome はそのプロファイルで起動できない。
// 画面のある Chrome が要る（画面なしの Chrome はプロファイルを占有しない）ので、仮想ディスプレイ（xvfb-run）がある環境だけで確かめる
const xvfb = ["/usr/bin/xvfb-run"].find((p) => fs.existsSync(p));
test("note 用の Chrome の窓が開いたままなら、閉じるよう案内して待ち、閉じたら続ける（「Chrome をインストール」と誤って案内しない）", { skip: skip || (!xvfb && "xvfb-run が無い環境では未実施") }, () => {
  const urls = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nbs-"));
  const driver = path.join(home, "driver.mjs");
  const profile = path.join(home, ".auto-tech-radar", "chrome-note");
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(driver, `
import fs from "fs"; import { spawn } from "child_process";
const holder = spawn(${JSON.stringify(chrome)}, ["--user-data-dir=${profile}", "--no-sandbox", "--no-first-run", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 100 && !fs.readdirSync(${JSON.stringify(profile)}).includes("SingletonLock"); i++) await new Promise((r) => setTimeout(r, 100));
const nb = spawn(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], { cwd: ${JSON.stringify(process.cwd())}, env: process.env });
let out = "";
const on = (d) => { out += d; if (/開いたまま/.test(out) && !holder.killed) setTimeout(() => holder.kill(), 1000); };
nb.stdout.on("data", on); nb.stderr.on("data", on);
nb.on("exit", (code) => { holder.kill(); console.log(JSON.stringify({ code, out })); });
`);
  try {
    const key = urls.zcode.url.split("/n/")[1];
    // 問題の無い CI の検査結果（検査結果が無い・読めないときは、どの記事も自動では再公開しない）
    const status = path.join(home, "note_status.json");
    fs.writeFileSync(status, JSON.stringify({ checkedAt: "2026-10-21T00:00:00.000Z", notes: {} }));
    const r = spawnSync(xvfb, ["-a", process.execPath, driver], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, ...ownerEnv(home), CHROME_PATH: chrome, ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key, ATR_NOTE_STATUS: status, ATR_NOTE_PROFILE_WAIT_MS: "60000" },
    });
    const res = JSON.parse(r.stdout.trim().split("\n").pop());
    assert.match(res.out, /note 用の Chrome の窓が開いたままです/);
    assert.doesNotMatch(res.out, /Chrome をインストール/);
    assert.equal(res.code, 0, res.out);
    assert.match(res.out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 本文の差し替え待ち 0 \/ 失敗 0/);
  } finally {
    rmDir(home);
  }
});

test("[E] 実行記録（GitHub に送る公開の記録）に有料部分の文が入らない。有料ラインを動かすボタンは押さない", { skip }, () => {
  const r = runNote("maintain", (k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_MOCK_PAIDHEAD: k.aihot }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 無料部分を原稿の内容に置き換えて更新: aihot/);
  assert.ok(r.log.length > 0, "記録を書いた");
  assert.match(r.log, /"after-update"/);
  const paidTexts = [...`<p>有料部分の本文です。導入手順と見積表。</p>${PAID_HEAD_HTML}`.matchAll(/>([^<]+)</g)].map((m) => m[1]);
  for (const t of paidTexts) assert.ok(!r.log.includes(t), `記録に有料部分の文「${t}」が入っている`);
  assert.equal(r.live.__movedLine, undefined, "「ラインをこの場所に変更」を押していない");
});
