// note の見出し画像の自動設定（note_browser.mjs）を、実際の Chrome と note.com の模擬応答で最後まで動かす
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome"].find((p) => p && fs.existsSync(p));

// CI の検査結果（note_status.json）の代わり。実データは CI が毎回書き換える（公開中の記事に要修正の表現があれば issues が入る）ので、
// テストは実データに左右されないよう、記事ごとの問題を指定したファイルを ATR_NOTE_STATUS で渡す
function statusFile(dir, issuesBySlug) {
  const f = path.join(dir, "note_status.json");
  fs.writeFileSync(f, JSON.stringify({ checkedAt: "2026-10-21T00:00:00.000Z", notes: Object.fromEntries(Object.entries(issuesBySlug).map(([slug, issues]) => [slug, { issues }])) }));
  return f;
}

test("見出し画像が未設定の記事だけにアップロードし、下書きなら「更新する」まで押して、記事への反映を確認する", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const key = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")).zcode.url.split("/n/")[1];
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], {
      encoding: "utf8",
      timeout: 240000,
      // zcode に問題が無い検査結果（実データで zcode に問題が見つかっていても、このテストの結果は変わらない）
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key, ATR_NOTE_STATUS: statusFile(home, { zcode: [] }) },
    });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 本文の差し替え待ち 0 \/ 失敗 0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("本文に要修正の問題がある記事は、下書きに画像を付けるだけで自動では再公開しない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const key = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")).zcode.url.split("/n/")[1];
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key, ATR_NOTE_STATUS: statusFile(home, { zcode: ["インボイス対応領収書の案内（インボイス発行事業者に未登録のため事実と異なる）"] }) },
    });
    const out = r.stdout + r.stderr;
    assert.match(out, /本文の差し替え待ち 1 \/ 失敗 0/, out);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("編集画面にログインが必要なら、自動操作なしの Chrome でログインしてもらい、閉じたら同じ記事を続ける", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const key = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")).zcode.url.split("/n/")[1];
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  try {
    const session = path.join(home, "session");
    const hook = path.join(home, "login.mjs");
    // 普通の Chrome の代わり: ログインした印を残して閉じる
    fs.writeFileSync(hook, `import fs from "fs"; fs.writeFileSync(${JSON.stringify(session)}, "1");`);
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key, ATR_NOTE_MOCK_SESSION: session, ATR_NOTE_LOGIN_HOOK: hook, ATR_NOTE_STATUS: statusFile(home, { zcode: [] }) },
    });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /ログインできたら、その Chrome の窓/);
    assert.match(out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 本文の差し替え待ち 0 \/ 失敗 0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("[U]: 差し替えの記録が CI の確認より前なら、問題が残っている記事を一覧に出し続ける", async () => {
  const { hiddenAfterOwnerFix } = await import("../scripts/utils/note_pending.mjs");
  // 同じ日でも、記録（日付だけの旧形式・確認より前の時刻）が確認より前なら隠さない
  assert.equal(hiddenAfterOwnerFix("2026-10-21", "2026-10-21T06:21:50.012Z"), false);
  assert.equal(hiddenAfterOwnerFix("2026-10-21T05:40:00.000Z", "2026-10-21T06:21:50.012Z"), false);
  // 確認より後に差し替えたものは、次の確認までは隠す
  assert.equal(hiddenAfterOwnerFix("2026-10-21T06:30:00.000Z", "2026-10-21T06:21:50.012Z"), true);
  assert.equal(hiddenAfterOwnerFix(undefined, "2026-10-21T06:21:50.012Z"), false);
});

test("[U]: 古い成熟度の表現だけが問題の記事は、その語の置き換えとして扱い、箇所と選ぶ語を示す", async () => {
  const { oldRingWordingSpot, NEW_RING_WORDS } = await import("../scripts/utils/note_pending.mjs");
  const tw = "第三者（ThoughtWorks）の評価のような表現";
  assert.deepEqual(oldRingWordingSpot({ issues: [tw], excerpt: '1a3a0c93">これらの状況を鑑み、ThoughtWorks成熟度リングでは「TRIAL」と判定しま' }), { excerpt: "これらの状況を鑑み、ThoughtWorks成熟度リングでは「TRIAL」と判定しま", words: "ThoughtWorks成熟度リング" });
  assert.equal(oldRingWordingSpot({ issues: [tw], excerpt: 'e1">🎯 ThoughtWorks成熟度リング判定（ADOPT / TRI' }).words, "ThoughtWorks成熟度リング判定");
  // 途中まで直して「ThoughtWorks」だけ残った形（2026-10-21 effectcraft の実例）
  assert.equal(oldRingWordingSpot({ issues: [tw], excerpt: '1a3a0c93">これらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。' }).words, "ThoughtWorks");
  assert.equal(oldRingWordingSpot({ issues: [tw, "受託単価"], excerpt: "ThoughtWorks成熟度リング判定" }), null);
  assert.equal(oldRingWordingSpot({ issues: [] }), null);
  assert.ok(!/🎯/.test(NEW_RING_WORDS), "見出しの 🎯 が二重にならない");
});

test("note のページは出品用アカウントの専用プロファイルで開く（note 以外は普段のブラウザ）", async () => {
  const { isNoteUrl } = await import("../scripts/utils/note_chrome.mjs");
  for (const u of ["https://note.com/notes/new", "https://editor.note.com/notes/n1/edit/", "https://note.com/dashboard/membership"]) assert.equal(isNoteUrl(u), true, u);
  for (const u of ["https://zenn.dev/", "https://evilnote.com/", "https://note.com.example.org/", "not a url"]) assert.equal(isNoteUrl(u), false, u);
  const src = fs.readFileSync("scripts/launcher.mjs", "utf8");
  assert.match(src, /function openUrl\(url\) \{\n[^\n]*\n  if \(isNoteUrl\(url\) && openInNoteChrome\(url\)\) return;/);
});

// [E]（maintain）: 要修正の表現の自動修正。どの記事に何が残っているかは、模擬の note の本文（オーナーが読める全文）で与える。
// extraEnv(keys) には note_urls.json の記事キー（slug → key）が渡る。待ち時間は縮める（記事の間の約 20 秒 → 0.2 秒）。
// history: 以前の [E] で直した記録（オーナー端末の ~/.auto-tech-radar/note_fix_history.json）。実行後の記録を fixes で返す
function runMaintain(extraEnv, { history } = {}) {
  const urls = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"));
  const keys = Object.fromEntries(Object.entries(urls).map(([slug, v]) => [slug, v.url.split("/n/")[1]]));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  const dump = path.join(home, "live.json");
  const historyFile = path.join(home, ".auto-tech-radar", "note_fix_history.json");
  if (history) {
    fs.mkdirSync(path.dirname(historyFile), { recursive: true });
    fs.writeFileSync(historyFile, JSON.stringify(history));
  }
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "maintain"], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: "none", ATR_NOTE_MOCK_DUMP: dump, ATR_NOTE_WAIT_SCALE: "0.01", ATR_NOTE_STATUS: statusFile(home, {}), ...extraEnv(keys) },
    });
    const live = fs.existsSync(dump) ? JSON.parse(fs.readFileSync(dump, "utf8")) : {};
    const fixes = fs.existsSync(historyFile) ? JSON.parse(fs.readFileSync(historyFile, "utf8")) : [];
    return { status: r.status, out: r.stdout + r.stderr, live, keys, fixes };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

test("[E] 古い表現だけ置き換えて「更新する」まで行い、公開中の本文で反映を確かめる。閲覧数も取得する", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_WORDING: k.zcode }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 要修正の表現を直して更新: zcode（ring-leftover）/);
  assert.match(r.out, /要修正の表現の修正: 修正 1 \/ 失敗 0\n/);
  assert.match(r.out, /note の閲覧数: 合計 12 \/ スキ 1/);
});

test("[E] 編集画面の下書きが公開中と違う記事は、置き換えも公開もしない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_WORDING: k.zcode, ATR_NOTE_MOCK_DRIFT: k.zcode }));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /下書き（\d+ 字）が公開中の記事（\d+ 字）と違うため、自動では直しません/);
  assert.doesNotMatch(r.out, /✓ 要修正の表現を直して/);
  assert.deepEqual(r.live, {}, "何も公開していない");
});

test("[E] インボイス対応領収書の案内と「コピペで本番一発起動」を、太字で分かれていても置き換えて公開し、1 回の上限を超えた分は次回に回す", { skip: !chrome && "Chrome が無い環境では未実施" }, async () => {
  // aihot と anatomy の 2 本に残っているが、上限を 1 本にして実行する（note_urls.json の順で aihot が先）
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: `${k.aihot},${k.anatomy}`, ATR_NOTE_MOCK_COPIPE: k.aihot, ATR_NOTE_FIX_MAX: "1" }));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /✓ 要修正の表現を直して更新: aihot（invoice, copipe-kit）/);
  // 上限（24 時間に 1 本）を使い切ったので、残りは次に直せる時刻以降の [E] で
  assert.match(r.out, /要修正の表現の修正: 修正 1 \/ 失敗 0 \/ 残り 1 本は\d\d-\d\d \d\d:\d\d（日本時間） 以降の \[E\]で直します（24時間に 1 本まで）/);
  assert.deepEqual(r.fixes.map((f) => f.slug), ["aihot"], "直した記事と時刻をオーナー端末に記録する");
  assert.doesNotMatch(r.out, /✓ 要修正の表現を直して更新: anatomy/);
  const { noteHtmlText } = await import("../scripts/utils/note_pending.mjs");
  const aihot = noteHtmlText(r.live[r.keys.aihot]);
  assert.match(aihot, /※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。/);
  assert.match(aihot, /公式READMEに基づく導入手順（動作未検証の例を含む）の「Docker Compose & \.env 設定キット」/);
  assert.doesNotMatch(aihot, /インボイス|コピペで本番一発起動|技術調査費/);
  assert.deepEqual(Object.keys(r.live), [r.keys.aihot], "上限を超えた anatomy は更新しない");
});

test("[E] 前回の実行で下書きだけ直してある記事はそのまま公開し、下書きが公開中と違う文になっている記事は公開しない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: `${k.aihot},${k.anatomy}`, ATR_NOTE_MOCK_RESUME: k.aihot, ATR_NOTE_MOCK_OTHER: k.anatomy }));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /✓ 要修正の表現を直して更新: aihot（invoice）/);
  assert.match(r.out, /✕ anatomy: 編集画面の下書き（\d+ 字）が公開中の記事（\d+ 字）と違うため、自動では直しません（3 段落目が違います。公開はしていません）/);
  assert.deepEqual(Object.keys(r.live), [r.keys.aihot]);
  assert.match(r.live[r.keys.aihot], /「購入・チップ履歴」から領収書を発行できます。/);
});

test("[E] 下書きが公開中と違う記事は飛ばし、次の記事は直す", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: `${k.aihot},${k.anatomy}`, ATR_NOTE_MOCK_DRIFT: k.aihot }));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /✕ aihot: 編集画面の下書き（\d+ 字）が公開中の記事（\d+ 字）と違うため、自動では直しません/);
  assert.match(r.out, /✓ 要修正の表現を直して更新: anatomy（invoice）/);
  assert.match(r.out, /要修正の表現の修正: 修正 1 \/ 失敗 1\n/);
  assert.deepEqual(Object.keys(r.live), [r.keys.anatomy], "anatomy だけ更新する");
});

test("[E] 下書きに公開していない文が残っている記事は、ほかに直す表現（コピペで本番一発起動）があっても置き換えず公開しない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  // 下書きでは領収書の案内が公開されたことのない別の文になっていて、「コピペで本番一発起動」は公開中と同じく残っている
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot, ATR_NOTE_MOCK_COPIPE: k.aihot, ATR_NOTE_MOCK_OTHER: k.aihot }));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /✕ aihot: 編集画面の下書き（\d+ 字）が公開中の記事（\d+ 字）と違うため、自動では直しません/);
  assert.doesNotMatch(r.out, /✓ 要修正の表現を直して/);
  assert.deepEqual(r.live, {}, "何も公開していない");
  assert.deepEqual(r.fixes, []);
});

test("[E] 「更新する」の後に無料部分が変わった（有料ラインの位置が変わった）ら、その場で止めて残りの記事を直さない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: `${k.aihot},${k.anatomy}`, ATR_NOTE_MOCK_PAIDMOVE: k.aihot }));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /✕ aihot: 「更新する」の後、無料部分（ログインなしで読める部分）が更新前と違います（4 段落目、更新前 3 段落 \/ 更新後 4 段落）。有料ラインの位置が変わった可能性があります/);
  assert.doesNotMatch(r.out, /anatomy/, "残りの記事は開かない");
  assert.deepEqual(Object.keys(r.live), [r.keys.aihot]);
  assert.deepEqual(r.fixes.map((f) => f.slug), ["aihot"], "「更新する」まで押した記事は 24 時間の本数に数える");
});

test("[E] 直近 24 時間に上限の本数を直していれば、記事を読まずに表現の修正を行わず、次に直せる時刻を示す", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const now = Date.now();
  const history = Array.from({ length: 12 }, (_, i) => ({ at: new Date(now - (60 - i) * 60 * 1000).toISOString(), slug: `s${i}` }));
  const r = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot }), { history });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /要修正の表現の修正: 直近24時間で 12 本直したため、今回は行いません（上限 12 本。次は \d\d-\d\d \d\d:\d\d（日本時間） 以降の \[E\] で直します）/);
  assert.doesNotMatch(r.out, /✓ 要修正の表現を直して/);
  assert.deepEqual(r.live, {});
  // 24 時間を過ぎた記録は数えない
  const old = history.map((h) => ({ ...h, at: new Date(Date.parse(h.at) - 24 * 3600 * 1000).toISOString() }));
  const r2 = runMaintain((k) => ({ ATR_NOTE_MOCK_INVOICE: k.aihot }), { history: old });
  assert.equal(r2.status, 0, r2.out);
  assert.match(r2.out, /✓ 要修正の表現を直して更新: aihot（invoice）/);
});
