// note の見出し画像の自動設定（note_browser.mjs）を、実際の Chrome と note.com の模擬応答で最後まで動かす
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome"].find((p) => p && fs.existsSync(p));

test("見出し画像が未設定の記事だけにアップロードし、下書きなら「更新する」まで押して、記事への反映を確認する", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const key = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")).zcode.url.split("/n/")[1];
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key },
    });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 本文の差し替え待ち 0 \/ 失敗 0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("本文に要修正の問題がある記事は、下書きに画像を付けるだけで自動では再公開しない", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
  const st = JSON.parse(fs.readFileSync("scripts/note_status.json", "utf8"));
  const flagged = Object.keys(st.notes).find((k) => st.notes[k].issues?.length);
  if (!flagged) return;
  const key = JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8"))[flagged].url.split("/n/")[1];
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "atr-nb-"));
  try {
    const r = spawnSync(process.execPath, ["scripts/note_browser.mjs", "eyecatch"], {
      encoding: "utf8",
      timeout: 240000,
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key },
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
      env: { ...process.env, HOME: home, USERPROFILE: home, CHROME_PATH: chrome, ATR_NOTE_HEADLESS: "1", ATR_NOTE_MOCK: path.resolve("tests/fixtures/note_mock.mjs"), ATR_NOTE_MOCK_TARGET: key, ATR_NOTE_MOCK_SESSION: session, ATR_NOTE_LOGIN_HOOK: hook },
    });
    const out = r.stdout + r.stderr;
    assert.equal(r.status, 0, out);
    assert.match(out, /ログインできたら、その Chrome の窓/);
    assert.match(out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 本文の差し替え待ち 0 \/ 失敗 0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
