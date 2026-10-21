// Google Search Console と Cloudflare Web Analytics の登録を、オーナーの PC の Chrome で自動操作する。
// 専用プロファイル（~/.auto-tech-radar/chrome-webmaster）を使う。ログインだけは、自動操作の窓だと Google が拒否するため、
// 普通の Chrome の窓を同じプロファイルで開いて行ってもらい、窓が閉じられたら自動操作に戻る（scripts/note_browser.mjs と同じ方式。
// Chrome の場所は utils/note_chrome.mjs の chromeExe を使う）。画面の要素が見つからないときは止めずに、窓の中で押すものを表示して待つ。
// scripts/setup_wizard.mjs は note・X の手順を文字で案内して既定のブラウザを開くだけで、自動操作・値の取り出しが無いため流用しない。
//
// 使い方:
//   node scripts/webmaster_setup.mjs gsc         Search Console にサイトを追加し、確認コードを src/config/site.js に書く
//   node scripts/webmaster_setup.mjs gsc-verify  （確認コードがデプロイされた後）「確認」を押し、サイトマップを送信する
//   node scripts/webmaster_setup.mjs cf          Cloudflare Web Analytics にサイトを追加し、token を src/config/site.js に書く
import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";
import { chromeExe } from "./utils/note_chrome.mjs";
import { GSC_PROPERTY, SITEMAP_URL, CF_HOST, extractGoogleVerification, extractCloudflareToken, setSiteConfigValue } from "./utils/webmaster.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_CONFIG = path.join(ROOT, "src", "config", "site.js");
const PROFILE = path.join(os.homedir(), ".auto-tech-radar", "chrome-webmaster");
const STEP_TIMEOUT_MS = 10 * 60 * 1000;
const HINT_AFTER_MS = 40 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function openLoginWindow(url, lines) {
  console.log("");
  lines.forEach((l) => console.log(`  ${l}`));
  const exe = chromeExe();
  if (!exe) throw new Error("Chrome が見つかりません（Chrome をインストールするか CHROME_PATH を指定）");
  return new Promise((resolve, reject) => {
    const p = spawn(exe, [`--user-data-dir=${PROFILE}`, "--no-first-run", "--no-default-browser-check", url], { stdio: "ignore" });
    p.on("error", reject);
    p.on("exit", resolve);
  });
}

// ログイン用の窓が開いたままだと、同じプロファイルで自動操作の Chrome を起動できない（Chrome の ProcessSingleton）
const PROFILE_BUSY = /ProcessSingleton|profile (directory )?is already in use|SingletonLock/i;

async function launchOnce(opts) {
  try {
    return await chromium.launchPersistentContext(PROFILE, { ...opts, channel: "chrome" });
  } catch (e) {
    if (PROFILE_BUSY.test(e.message) || !process.env.CHROME_PATH) throw e;
    return chromium.launchPersistentContext(PROFILE, { ...opts, executablePath: process.env.CHROME_PATH });
  }
}

async function launch() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const opts = { headless: false, viewport: null };
  for (let start = Date.now(), told = false; ; ) {
    try {
      return await launchOnce(opts);
    } catch (e) {
      if (!PROFILE_BUSY.test(e.message)) throw new Error(`Chrome を起動できません: ${e.message.split("\n")[0]}`);
      if (Date.now() - start > STEP_TIMEOUT_MS) throw new Error("専用の Chrome の窓が開いたままです。窓を閉じてから、もう一度実行してください");
      if (!told) console.log("\n  ⏸ 専用の Chrome の窓が開いたままです。その窓を右上の × で閉じてください → 閉じると自動で続きます");
      told = true;
      await sleep(3000);
    }
  }
}

// ページ（iframe を含む）の HTML・表示文字・入力欄の値をまとめて返す
async function pageText(page) {
  const parts = await Promise.all(page.frames().map((f) => f.evaluate(() => [
    document.documentElement.outerHTML,
    document.body ? document.body.innerText : "",
    ...[...document.querySelectorAll("input, textarea")].map((e) => e.value),
  ].join("\n")).catch(() => "")));
  return parts.join("\n");
}

// 自動で進めなかったときの画面（スクリーンショットと、入力欄・ボタンの一覧）を残す。画面が変わったときに直すため
async function saveDebug(page) {
  const dir = path.join(path.dirname(PROFILE), "webmaster_debug");
  try {
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, "screen.png") });
    const controls = await page.evaluate(() => [...document.querySelectorAll("input, textarea, button, [role=button], [role=tab], [role=option]")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ tag: e.tagName, type: e.type || "", role: e.getAttribute("role") || "", name: e.getAttribute("aria-label") || "", placeholder: e.placeholder || "", text: (e.innerText || "").trim().slice(0, 60) })));
    fs.writeFileSync(path.join(dir, "controls.json"), JSON.stringify({ url: page.url(), controls }, null, 2), "utf8");
    console.log(`  （画面の記録: ${dir}）`);
  } catch (e) {
    console.log(`  （画面の記録に失敗: ${e.message.split("\n")[0]}）`);
  }
}

// 見えていれば 1 回だけ押す（押せたら true）
async function clickOnce(locator, done, key) {
  if (done.has(key)) return false;
  try {
    const el = locator.first();
    if (!(await el.isVisible({ timeout: 500 }))) return false;
    await el.click({ timeout: 3000 });
    done.add(key);
    console.log(`  ✓ ${key}`);
    return true;
  } catch (e) {
    return false;
  }
}

async function fillOnce(locator, value, done, key) {
  if (done.has(key)) return false;
  try {
    const el = locator.first();
    if (!(await el.isVisible({ timeout: 500 }))) return false;
    await el.fill(value, { timeout: 3000 });
    await el.press("Enter");
    done.add(key);
    console.log(`  ✓ ${key}`);
    return true;
  } catch (e) {
    return false;
  }
}

// 1 段階を、成功の判定が出るまで繰り返す。actions は毎回試す操作（同じ操作は 1 回だけ）。一定時間たっても進まなければ案内を出す
async function untilDone(page, { check, actions, hint }) {
  const done = new Set();
  const start = Date.now();
  let hinted = false;
  while (Date.now() - start < STEP_TIMEOUT_MS) {
    // 窓が閉じられたら、待ち続けずに止める（閉じた窓の文字は空になり、永久に「進めない」状態になるため）
    if (page.isClosed()) throw new Error("自動操作の窓が閉じられました。もう一度実行してください（自動操作の窓は閉じずに、そのままにしてください）");
    const result = check(await pageText(page), page.url());
    if (result) return result;
    for (const act of actions) if (await act(done)) break;
    if (!hinted && Date.now() - start > HINT_AFTER_MS) {
      console.log(`\n  👉 自動では進めませんでした。開いている自動操作の窓で: ${hint}\n     （操作すると自動で続きます）`);
      await saveDebug(page);
      hinted = true;
    }
    await sleep(2000);
  }
  throw new Error(`時間切れ（${STEP_TIMEOUT_MS / 60000} 分）: ${hint}`);
}

async function withPage(loginUrl, isLoginPage, loginLines, startUrl, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctx = await launch();
    const page = ctx.pages()[0] || (await ctx.newPage());
    try {
      await page.goto(startUrl, { waitUntil: "domcontentloaded" });
      await page.bringToFront();
      console.log("  🤖 自動操作の窓を開きました（上部に「自動テスト ソフトウェアによって制御されています」と出る窓）。この窓は閉じないでください");
      await sleep(3000);
      if (isLoginPage(page.url())) {
        await ctx.close();
        if (attempt > 0) throw new Error("ログインできていません。もう一度実行してください");
        await openLoginWindow(loginUrl, loginLines);
        continue;
      }
      return await fn(page);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
  throw new Error("ログインできていません");
}

function writeConfig(key, value) {
  const src = fs.readFileSync(SITE_CONFIG, "utf8");
  const next = setSiteConfigValue(src, key, value);
  if (next !== src) fs.writeFileSync(SITE_CONFIG, next, "utf8");
  console.log(`  ✓ src/config/site.js の ${key} を設定しました`);
}

const GSC_LOGIN = ["🔑 Google にログインしてください（自動操作の窓では Google がログインを拒否するため、普通の Chrome の窓を開きます）。",
  "   ① 開いた窓で、Search Console に使う Google アカウントでログイン",
  "   ② Search Console の画面が出たら、その Chrome の窓を右上の × で閉じる → 自動で続きます"];
const isGoogleLogin = (url) => /accounts\.google\.com|\/about\b|search-console\/about/.test(url);
const WELCOME = "https://search.google.com/search-console/welcome?hl=ja";
const OWNED = /所有権を(自動)?(確認|証明)しました|Ownership (auto )?verified/i;

// Search Console のようこそ画面で URL プレフィックスにサイトを入れる操作
// （2026-10 の画面は、最初に「ウェブサイトを追加」を押すと「ドメイン」「URL プレフィックス」の入力欄が出る）
// 入力欄の目印は placeholder ではなく aria-label（2026-10-21 の画面の記録 controls.json で確認）。「続行」は入力欄と同じ枠の中のボタン
const URL_PREFIX_INPUT = 'input[aria-label="https://www.example.com"], input[placeholder="https://www.example.com"]';
const enterProperty = (page) => async (done) => {
  const input = page.locator(URL_PREFIX_INPUT);
  if (await fillOnce(input, GSC_PROPERTY, done, `URL プレフィックスに ${GSC_PROPERTY} を入力`)) {
    await sleep(1000);
    // 入力欄から見て最初の「続行」（ドメイン側の「続行」は入力欄より前にある）
    await clickOnce(page.locator(`${URL_PREFIX_INPUT.split(",")[0]} >> xpath=following::*[@role="button"][normalize-space()="続行" or normalize-space()="Continue" or normalize-space()="CONTINUE"][1]`), done, "URL プレフィックスの「続行」を押す");
    return true;
  }
  return clickOnce(page.getByRole("button", { name: /ウェブサイトを追加|プロパティを追加|Add (a )?(website|property)/i }), done, "「ウェブサイトを追加」を押す");
};

async function gscToken() {
  return withPage("https://search.google.com/search-console?hl=ja", isGoogleLogin, GSC_LOGIN, WELCOME, async (page) => {
    const r = await untilDone(page, {
      check: (text) => {
        const token = extractGoogleVerification(text);
        if (token) return { token };
        if (OWNED.test(text)) return { alreadyVerified: true };
        return null;
      },
      actions: [enterProperty(page), (done) => clickOnce(page.getByText(/^HTML タグ$|^HTML tag$/), done, "確認方法「HTML タグ」を開く")],
      hint: `右側「URL プレフィックス」に ${GSC_PROPERTY} を入れて「続行」→ 確認方法の一覧の「HTML タグ」を開く`,
    });
    if (r.alreadyVerified) {
      console.log("  ✓ このサイトは既に所有権が確認済みです（確認コードは不要）");
      return r;
    }
    writeConfig("googleSiteVerification", r.token);
    return r;
  });
}

async function gscVerify() {
  return withPage("https://search.google.com/search-console?hl=ja", isGoogleLogin, GSC_LOGIN, WELCOME, async (page) => {
    await untilDone(page, {
      check: (text) => (OWNED.test(text) ? true : null),
      actions: [
        enterProperty(page),
        (done) => clickOnce(page.getByText(/^HTML タグ$|^HTML tag$/), done, "確認方法「HTML タグ」を開く"),
        (done) => (done.has("確認方法「HTML タグ」を開く") ? clickOnce(page.getByRole("button", { name: /^(確認|VERIFY|Verify)$/ }), done, "「確認」を押す") : false),
      ],
      hint: `「URL プレフィックス」に ${GSC_PROPERTY} →「続行」→「HTML タグ」→「確認」`,
    });
    console.log("  ✓ 所有権を確認しました");
    await page.goto(`https://search.google.com/search-console/sitemaps?resource_id=${encodeURIComponent(GSC_PROPERTY)}&hl=ja`, { waitUntil: "domcontentloaded" });
    await sleep(3000);
    await untilDone(page, {
      check: (text) => (/サイトマップを送信しました|Sitemap submitted/i.test(text) || text.includes("sitemap-index.xml</") ? true : null),
      actions: [async (done) => {
        const box = page.getByRole("textbox").filter({ hasNot: page.locator("[type=search]") });
        if (!(await fillOnce(box, "sitemap-index.xml", done, "サイトマップの URL に sitemap-index.xml を入力"))) return false;
        await sleep(1000);
        return clickOnce(page.getByRole("button", { name: /^(送信|SUBMIT|Submit)$/ }), done, "「送信」を押す");
      }],
      hint: `「新しいサイトマップの追加」に sitemap-index.xml を入れて「送信」（${SITEMAP_URL}）`,
    });
    console.log("  ✓ サイトマップを送信しました");
    return { verified: true, sitemap: SITEMAP_URL };
  });
}

const CF_LOGIN = ["🔑 Cloudflare にログインしてください（普通の Chrome の窓を開きます）。",
  "   ① 開いた窓でログイン。アカウントが無ければ同じ画面の「Sign up」から無料で作成（メールの確認あり。有料プランやカードを求められたら選ばずに止めてください）",
  "   ② ダッシュボードが出たら、その Chrome の窓を右上の × で閉じる → 自動で続きます"];
const isCfLogin = (url) => /dash\.cloudflare\.com\/(login|sign-up)|cloudflare\.com\/sign-up/.test(url);

async function cfToken() {
  return withPage("https://dash.cloudflare.com/login", isCfLogin, CF_LOGIN, "https://dash.cloudflare.com/?to=/:account/web-analytics", async (page) => {
    const r = await untilDone(page, {
      check: (text) => {
        const token = extractCloudflareToken(text);
        return token ? { token } : null;
      },
      actions: [
        // 既に登録済みなら、その行の「サイトの管理」からスニペットを出す
        (done) => clickOnce(page.getByRole("link", { name: new RegExp(`^${CF_HOST.replace(/\./g, "\\.")}$`) }), done, `登録済みの ${CF_HOST} を開く`),
        (done) => clickOnce(page.getByRole("button", { name: /Manage site|サイトの管理|サイトを管理/ }), done, "「サイトの管理」を押す"),
        (done) => clickOnce(page.getByRole("button", { name: /Add a site|サイトを追加/ }), done, "「サイトを追加」を押す"),
        async (done) => {
          if (!done.has("「サイトを追加」を押す")) return false;
          if (!(await fillOnce(page.getByRole("textbox"), CF_HOST, done, `ホスト名に ${CF_HOST} を入力`))) return false;
          await sleep(1000);
          return clickOnce(page.getByRole("button", { name: /^(Done|完了)$/ }), done, "「完了」を押す");
        },
      ],
      hint: `Web Analytics →「Add a site（サイトを追加）」→ ホスト名 ${CF_HOST} →「Done」→ 表示された JS スニペットを画面に出したままにする`,
    });
    writeConfig("cloudflareAnalyticsToken", r.token);
    return r;
  });
}

const MODES = { gsc: gscToken, "gsc-verify": gscVerify, cf: cfToken };
const mode = process.argv[2];
if (!MODES[mode]) {
  console.error(`使い方: node scripts/webmaster_setup.mjs <${Object.keys(MODES).join("|")}>`);
  process.exit(2);
}
MODES[mode]()
  .then((r) => {
    console.log(`RESULT ${JSON.stringify({ mode, ok: true, ...(r && typeof r === "object" ? r : {}) })}`);
  })
  .catch((e) => {
    console.error(`\n  ✖ ${e.message}`);
    console.log(`RESULT ${JSON.stringify({ mode, ok: false, error: e.message })}`);
    process.exit(1);
  });
