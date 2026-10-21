// note.com の操作をオーナーの Chrome で自動実行する（DevTools にスクリプトを貼る手作業をなくす）。
// 専用プロファイル（~/.auto-tech-radar/chrome-note）を使うので、初回だけ開いた窓で note にログインする。以後はログイン状態が残る。
// 使い方: node scripts/note_browser.mjs eyecatch
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";
import { buildEyecatchTasks } from "./note_api_server.mjs";
import { eyecatchPng } from "./utils/eyecatch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(os.homedir(), ".auto-tech-radar", "chrome-note");

// Google などのログインは、自動操作中のブラウザを「安全でない」として拒否する。
// そのためログインだけは、自動操作なしの普通の Chrome を同じ専用プロファイルで開いて行い、窓が閉じられたら自動操作に戻る
class LoginRequired extends Error {}

function chromeExe() {
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

async function manualLogin() {
  console.log("\n  📝 note にログインしてください。普通の Chrome の窓を開きます（自動操作の窓では Google がログインを拒否するため）。");
  console.log("     ① 開いた窓で note にログイン（Google でのログインも可）");
  console.log("     ② ログインできたら、その Chrome の窓を右上の × で閉じる → 自動で続きます");
  // テスト用: ATR_NOTE_LOGIN_HOOK に Chrome の代わりに実行する Node スクリプト
  const hook = process.env.ATR_NOTE_LOGIN_HOOK;
  const exe = hook ? process.execPath : chromeExe();
  if (!exe) throw new Error("Chrome が見つかりません（Chrome をインストールするか CHROME_PATH を指定）");
  const args = hook ? [hook] : [`--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", "https://note.com/login"];
  await new Promise((resolve, reject) => {
    const p = spawn(exe, args, { stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", resolve);
  });
}

// ブラウザ内のスクリプトが「ローカルブリッジ」に出す要求を、この Node プロセスが直接返す。
// ページから localhost への通信をしないので、Chrome のローカルネットワーク許可（版により付与できない）に左右されない
const BRIDGE = "http://127.0.0.1:18921";
async function serveBridge(ctx) {
  const root = path.join(__dirname, "..");
  const tasks = buildEyecatchTasks(JSON.parse(fs.readFileSync(path.join(__dirname, "note_urls.json"), "utf8")));
  await ctx.route(`${BRIDGE}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/eyecatch-tasks") return route.fulfill({ json: tasks, headers: { "Access-Control-Allow-Origin": "https://note.com" } });
    const img = u.pathname.match(/^\/eyecatch\/([A-Za-z0-9_.-]+)\.png$/);
    if (img && tasks.some((t) => t.slug === img[1])) {
      return route.fulfill({ body: await eyecatchPng(img[1], root), contentType: "image/png", headers: { "Access-Control-Allow-Origin": "https://note.com" } });
    }
    if (u.pathname === "/log") {
      try {
        console.log(`  ${JSON.parse(route.request().postData() || "{}").text}`);
      } catch (e) {}
    }
    return route.fulfill({ body: "ok", headers: { "Access-Control-Allow-Origin": "https://note.com" } });
  });
  return tasks;
}

async function openNote(afterLogin = false) {
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
  await serveBridge(ctx);
  if (process.env.ATR_NOTE_MOCK) await (await import(process.env.ATR_NOTE_MOCK)).default(ctx);
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto("https://note.com/notes", { waitUntil: "domcontentloaded" });
  if (/login/.test(page.url())) {
    if (afterLogin) throw new Error("note にログインできていません");
    await ctx.close().catch(() => {});
    await manualLogin();
    return openNote(true);
  }
  return { ctx, page };
}

// 1 回の API 呼び出しをページ内で実行する（note.com と同じオリジンで、ログイン状態の Cookie を使うため）。
// 実行中にページが移動すると失敗するので、移動しない JSON のページを土台にし、失敗したら 1 回だけやり直す
async function inPage(page, fn, arg) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (attempt >= 1 || !/Execution context was destroyed|navigation/i.test(e.message)) throw e;
      await page.waitForLoadState("domcontentloaded").catch(() => {});
    }
  }
}

const noteInfo = (page, key) =>
  inPage(page, async (k) => {
    const r = await fetch(`/api/v3/notes/${k}`, { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
    if (!r.ok) return { error: `記事情報の取得に失敗 HTTP ${r.status}` };
    const d = (await r.json()).data || {};
    return { id: d.id, eyecatch: d.eyecatch || "", updatedAt: d.updated_at || d.updatedAt || "" };
  }, key);

const uploadEyecatch = (page, args) =>
  inPage(page, async ({ id, width, height, b64, name }) => {
    const xsrf = decodeURIComponent((document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/) || [])[1] || "");
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("note_id", String(id));
    form.append("width", String(width));
    form.append("height", String(height));
    // ファイル部分の Content-Type が無いと 500 になるため、型付きの File で送る
    form.append("file", new File([bin], name, { type: "image/png" }));
    const r = await fetch("/api/v1/image_upload/note_eyecatch", {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest", ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}) },
      body: form,
    });
    return { ok: r.ok, status: r.status, text: r.ok ? "" : (await r.text()).slice(0, 200) };
  }, args);

const buttonTexts = (p) => p.$$eval("button, a[role=button]", (els) => els.map((e) => e.textContent.trim()).filter(Boolean).slice(0, 40)).catch(() => []);

// 公開中の記事は、見出し画像が下書きに付くだけなので、編集画面で「公開に進む」→「更新する」を押して反映する。
// 押すのは文言が一致するボタンだけ。各段階の URL とボタンの文言を記録する（画面構成が違ったときに原因を確認するため）
// 編集画面（editor.note.com）は note.com のログイン画面（?redirectPath=編集画面）を経由することがある。
// ログイン済みなら自動で戻るのを待ち、戻らなければログインが必要（LoginRequired）として呼び出し元に知らせる
async function openEditor(ed, key, steps) {
  const editUrl = `https://editor.note.com/notes/${key}/edit/`;
  const onEditor = () => new URL(ed.url()).hostname === "editor.note.com" && ed.url().includes(`/notes/${key}/edit`);
  await ed.goto(editUrl, { waitUntil: "domcontentloaded" });
  if (!onEditor()) await ed.waitForURL(() => onEditor(), { timeout: 20000 }).catch(() => {});
  if (onEditor()) return;
  steps.push({ at: "login", url: ed.url(), buttons: await buttonTexts(ed) });
  throw new LoginRequired("note の編集画面を開くにはログインが必要です");
}

async function publishDraft(ctx, key, steps) {
  const ed = await ctx.newPage();
  try {
    await openEditor(ed, key, steps);
    const next = ed.getByRole("button", { name: /公開に進む/ }).first();
    await next.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    steps.push({ at: "editor", url: ed.url(), buttons: await buttonTexts(ed) });
    if ((await next.count()) === 0) throw new Error("編集画面に「公開に進む」ボタンが見つかりません");
    await next.click();
    const update = ed.getByRole("button", { name: /^\s*更新する\s*$/ }).first();
    await update.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    steps.push({ at: "publish", url: ed.url(), buttons: await buttonTexts(ed) });
    if ((await update.count()) === 0) throw new Error("公開設定画面に「更新する」ボタンが見つかりません");
    await update.click();
    // 公開設定画面（/publish）から離れるか、20 秒たつまで待つ
    await ed.waitForURL((u) => !/\/publish/.test(u.toString()), { timeout: 20000 }).catch(() => {});
    await ed.waitForTimeout(2000);
    steps.push({ at: "after-update", url: ed.url() });
  } finally {
    await ed.close().catch(() => {});
  }
}

async function eyecatch() {
  let ctx;
  const result = { set: [], skipped: [], failed: [], manual: [], steps: {} };
  try {
    let { ctx: c, page } = await openNote();
    ctx = c;
    let loggedIn = false;
    const root = path.join(__dirname, "..");
    const tasks = buildEyecatchTasks(JSON.parse(fs.readFileSync(path.join(__dirname, "note_urls.json"), "utf8")));
    // 本文に要修正の問題がある記事（CI の検査結果）は、下書きの中身が分からないので自動で再公開しない
    let flagged = new Set();
    try {
      const st = JSON.parse(fs.readFileSync(path.join(__dirname, "note_status.json"), "utf8"));
      flagged = new Set(Object.entries(st.notes || {}).filter(([, v]) => v.issues?.length).map(([k]) => k));
    } catch (e) {}
    const base = async () => tasks.length && page.goto(`https://note.com/api/v3/notes/${tasks[0].key}`, { waitUntil: "domcontentloaded" });
    await base();
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      try {
        const info = await noteInfo(page, t.key);
        if (info.error) throw new Error(info.error);
        if (info.eyecatch) {
          result.skipped.push(t.slug);
          continue;
        }
        const b64 = (await eyecatchPng(t.slug, root)).toString("base64");
        const up = await uploadEyecatch(page, { id: info.id, width: t.width, height: t.height, b64, name: `${t.slug}.png` });
        if (!up.ok) throw new Error(`アップロード失敗 HTTP ${up.status} ${up.text}`);
        let after = await noteInfo(page, t.key);
        if (!after.eyecatch) {
          if (flagged.has(t.slug)) {
            result.manual.push(`${t.slug}: 見出し画像は下書きに設定済み。本文を修正版に差し替えてから note の編集画面で「更新する」を押すと反映されます`);
            continue;
          }
          result.steps[t.slug] = [];
          await publishDraft(ctx, t.key, result.steps[t.slug]);
          after = await noteInfo(page, t.key);
          if (!after.eyecatch) throw new Error("「更新する」の後も見出し画像が記事に反映されていません");
        }
        result.set.push(t.slug);
        console.log(`  ✓ 見出し画像を設定: ${t.slug}`);
      } catch (e) {
        // 編集画面にログインが必要なら、普通の Chrome でログインしてもらってから同じ記事をやり直す（1 回だけ）
        if (e instanceof LoginRequired && !loggedIn) {
          loggedIn = true;
          await ctx.close().catch(() => {});
          await manualLogin();
          ({ ctx, page } = await openNote(true));
          await base();
          i--;
          continue;
        }
        result.failed.push(`${t.slug}: ${e.message.split("\n")[0]}`);
        console.log(`  ✕ ${t.slug}: ${e.message.split("\n")[0]}`);
        break; // 画面構成の想定違いなどで同じ失敗を繰り返さないよう、最初の失敗で止める
      }
      await new Promise((r) => setTimeout(r, 1500)); // note への連続アクセスを避ける
    }
    console.log(`\n🖼 見出し画像: 設定 ${result.set.length} / 設定済みのため変更なし ${result.skipped.length} / 本文の差し替え待ち ${result.manual.length} / 失敗 ${result.failed.length}`);
    result.manual.forEach((m) => console.log(`  … ${m}`));
    return result;
  } finally {
    await ctx?.close().catch(() => {});
  }
}

// 実行結果を scripts/note_browser_log.json に残す（ランチャーが GitHub に送り、遠隔で原因を確認できるように）
function writeLog(entry) {
  if (process.env.ATR_NOTE_MOCK) return; // テスト（模擬応答）の結果は残さない
  try {
    fs.writeFileSync(path.join(__dirname, "note_browser_log.json"), JSON.stringify({ at: new Date().toISOString(), ...entry }, null, 2) + "\n", "utf8");
  } catch (e) {}
}

if (process.argv[1] && process.argv[1].endsWith("note_browser.mjs")) {
  const cmd = process.argv[2];
  const run = cmd === "eyecatch" ? eyecatch : null;
  if (!run) {
    console.log("使い方: node scripts/note_browser.mjs eyecatch");
    process.exit(2);
  }
  run().then(
    (result) => {
      writeLog({ cmd, ok: result.failed.length === 0, result });
      process.exit(result.failed.length === 0 ? 0 : 1);
    },
    (e) => {
      console.error(`❌ ${e.message}`);
      writeLog({ cmd, ok: false, error: String(e.stack || e.message).slice(0, 2000) });
      process.exit(1);
    },
  );
}
