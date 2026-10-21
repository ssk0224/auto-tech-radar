// note.com を開く Chrome。出品用の note アカウントでログインした専用プロファイルを、[E]（自動操作）と [U]・[N] など（手作業）で共有する。
// 普段のブラウザは別の note アカウントでログインしていることがあり、そこで編集画面を開くと入れない（2026-10-21 に実際に起きた）
import fs from "fs";
import { ownerDir } from "./owner_dir.mjs";
import path from "path";
import { spawn } from "child_process";

export const NOTE_PROFILE = path.join(ownerDir, "chrome-note");

export function chromeExe() {
  const env = process.env;
  const candidates = [
    env.CHROME_PATH,
    env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
    env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
    env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find((p) => p && fs.existsSync(p));
}

export const isNoteUrl = (url) => {
  try {
    return /(^|\.)note\.com$/.test(new URL(url).hostname);
  } catch (e) {
    return false;
  }
};

// 専用プロファイルの普通の Chrome（自動操作なし）で url を開く。開けたら true（Chrome が無ければ false）
export function openInNoteChrome(url) {
  const exe = chromeExe();
  if (!exe) return false;
  fs.mkdirSync(NOTE_PROFILE, { recursive: true });
  try {
    const p = spawn(exe, [`--user-data-dir=${NOTE_PROFILE}`, "--no-first-run", "--no-default-browser-check", url], { detached: true, stdio: "ignore" });
    p.on("error", () => {});
    p.unref();
    return true;
  } catch (e) {
    return false;
  }
}
