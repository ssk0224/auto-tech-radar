// Chrome を使うテスト用の Chrome の探し方。Linux の CI の置き場所だけでなく、Windows・macOS の通常のインストール先も探す
// （scripts/utils/note_chrome.mjs の chromeExe と同じ。固定の Linux パスだけを見ると、owner PC では全部 skip になり、緑のまま何も検証されない）。
// ATR_REQUIRE_CHROME=1（Windows の CI が設定）なら、見つからないことを skip でなく失敗にする
import fs from "fs";
import path from "path";
import { chromeExe } from "../../scripts/utils/note_chrome.mjs";

export const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", "/usr/bin/google-chrome"].find((p) => p && fs.existsSync(p)) || chromeExe();

if (!chrome && process.env.ATR_REQUIRE_CHROME) {
  throw new Error("ATR_REQUIRE_CHROME=1 なのに Chrome が見つかりません（skip で緑にしない）。CHROME_PATH を指定するか Chrome をインストールしてください");
}

// 子プロセスが本物の ~/.auto-tech-radar（秘密鍵・note 用の Chrome プロファイル）に触れないよう、置き場所を一時ディレクトリへ向ける。
// HOME / USERPROFILE を差し替えない: Windows では USERPROFILE を変えると、起動した Chrome が応答しなくなる（ATR_OWNER_DIR は scripts/utils/owner_dir.mjs）
export const ownerEnv = (home) => ({ HOME: home, ATR_OWNER_DIR: path.join(home, ".auto-tech-radar") });

// Chrome を使ったテストの一時ディレクトリを消す。Windows では終了直後の Chrome がプロファイルのファイルを少しの間つかんでいて、
// すぐ消すと EPERM になる（後片付けの失敗で、本来の検証結果が隠れる）ので、少し待って繰り返す
export const rmDir = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 30, retryDelay: 300 });
