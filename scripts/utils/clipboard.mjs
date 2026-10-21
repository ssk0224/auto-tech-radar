// オーナー端末（Windows）のクリップボードにテキストをコピーする。
// 本文をコマンドラインに入れない: cmd.exe のコマンドラインは改行で切れ、8191 文字を超えると実行できず、" で引数が壊れる。
// そのため X の投稿文（必ず改行を含む）や Qiita 用の記事（数千字）はコピーできず、オーナーは前にコピーした内容
// （[U] で コピーした有料記事の全文のこともある）を貼り付けてしまう。本文は UTF-8 のファイルに書き、そのパスも環境変数で渡す
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";

export const CLIPBOARD_PS = "Get-Content -Raw -Encoding UTF8 -LiteralPath $env:ATR_CLIP_FILE | Set-Clipboard";

const defaultRun = (exe, args, opts) => {
  const r = spawnSync(exe, args, { stdio: "ignore", timeout: 8000, windowsHide: true, ...opts });
  return r.status === 0;
};

// ファイルの中身（UTF-8）をコピーする。コピーできたら true
export function copyFileToClipboard(filePath, { run = defaultRun } = {}) {
  try {
    return Boolean(run("powershell", ["-NoProfile", "-NonInteractive", "-Command", CLIPBOARD_PS], { env: { ...process.env, ATR_CLIP_FILE: filePath } }));
  } catch (e) {
    return false;
  }
}

// テキストをコピーする。コピーできたら true（できなければ、呼び出し側は「コピーした」と表示しない）
export function copyTextToClipboard(text, { run = defaultRun, dir = os.tmpdir() } = {}) {
  if (!text) return false;
  const tmp = path.join(dir, `atr_clip_${process.pid}_${Date.now()}.txt`);
  try {
    fs.writeFileSync(tmp, text, "utf8");
    return copyFileToClipboard(tmp, { run });
  } catch (e) {
    return false;
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch (e) {}
  }
}
