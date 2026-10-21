// note の見出し画像の自動設定（note_browser.mjs）を、実際の Chrome と note.com の模擬応答で最後まで動かす
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome"].find((p) => p && fs.existsSync(p));

test("見出し画像が未設定の記事だけにアップロードし、反映を確認して終了する", { skip: !chrome && "Chrome が無い環境では未実施" }, () => {
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
    assert.match(out, /設定 1 \/ 設定済みのため変更なし \d+ \/ 失敗 0/);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
