// note.com の操作をオーナーの Chrome で自動実行する（DevTools にスクリプトを貼る手作業をなくす）。
// 専用プロファイル（~/.auto-tech-radar/chrome-note）を使うので、初回だけ開いた窓で note にログインする。以後はログイン状態が残る。
// 使い方: node scripts/note_browser.mjs eyecatch
import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(os.homedir(), ".auto-tech-radar", "chrome-note");
const ask = (q) => new Promise((r) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => (rl.close(), r(a)));
});

async function startBridge() {
  const proc = spawn(process.execPath, [path.join(__dirname, "note_api_server.mjs"), "--eyecatch-only"], { cwd: path.join(__dirname, ".."), stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ローカルブリッジが起動しません")), 15000);
    proc.stdout.on("data", (d) => {
      process.stdout.write(d);
      if (String(d).includes("待機中")) (clearTimeout(t), resolve());
    });
  });
  return proc;
}

async function openNote() {
  fs.mkdirSync(PROFILE, { recursive: true });
  // テスト用: ATR_NOTE_HEADLESS=1 で画面なし、ATR_NOTE_MOCK に note.com の応答を差し替えるモジュール
  const opts = { headless: process.env.ATR_NOTE_HEADLESS === "1", viewport: null };
  let ctx;
  try {
    ctx = await chromium.launchPersistentContext(PROFILE, { ...opts, channel: "chrome" });
  } catch (e) {
    if (!process.env.CHROME_PATH) throw new Error(`Chrome を起動できません（Chrome をインストールするか CHROME_PATH を指定）: ${e.message.split("\n")[0]}`);
    ctx = await chromium.launchPersistentContext(PROFILE, { ...opts, executablePath: process.env.CHROME_PATH });
  }
  // このPCのブリッジから画像を受け取るためのローカルネットワーク許可（未対応の版では無視）
  await ctx.grantPermissions(["local-network-access"], { origin: "https://note.com" }).catch(() => {});
  if (process.env.ATR_NOTE_MOCK) await (await import(process.env.ATR_NOTE_MOCK)).default(ctx);
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto("https://note.com/notes", { waitUntil: "domcontentloaded" });
  if (/login/.test(page.url())) {
    console.log("\n開いた Chrome の窓で note にログインしてください（初回だけ。次回からは不要）。");
    await ask("ログインできたら Enter > ");
    await page.goto("https://note.com/notes", { waitUntil: "domcontentloaded" });
    if (/login/.test(page.url())) throw new Error("note にログインできていません");
  }
  return { ctx, page };
}

async function eyecatch() {
  const bridge = await startBridge();
  let ctx;
  try {
    const opened = await openNote();
    ctx = opened.ctx;
    const script = fs.readFileSync(path.join(__dirname, "browser", "note_eyecatch.js"), "utf8");
    const result = await opened.page.evaluate(script);
    console.log(`\n🖼 見出し画像: 設定 ${result.set.length} / 設定済みのため変更なし ${result.skipped.length} / 失敗 ${result.failed.length}`);
    result.failed.forEach((f) => console.log(`  ✕ ${f}`));
    return result.failed.length === 0;
  } finally {
    await ctx?.close().catch(() => {});
    bridge.kill();
  }
}

if (process.argv[1] && process.argv[1].endsWith("note_browser.mjs")) {
  const cmd = process.argv[2];
  const run = cmd === "eyecatch" ? eyecatch : null;
  if (!run) {
    console.log("使い方: node scripts/note_browser.mjs eyecatch");
    process.exit(2);
  }
  run().then(
    (ok) => process.exit(ok ? 0 : 1),
    (e) => {
      console.error(`❌ ${e.message}`);
      process.exit(1);
    },
  );
}
