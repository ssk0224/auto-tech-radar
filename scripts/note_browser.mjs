// note.com の操作をオーナーの Chrome で自動実行する（DevTools にスクリプトを貼る手作業をなくす）。
// 専用プロファイル（~/.auto-tech-radar/chrome-note）を使うので、初回だけ開いた窓で note にログインする。以後はログイン状態が残る。
// 使い方: node scripts/note_browser.mjs maintain（見出し画像の設定 → 要修正の表現の修正 → 閲覧数の取得。eyecatch は見出し画像だけ）
import fs from "fs";
import path from "path";
import { execFileSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { chromium } from "playwright-core";
import { buildEyecatchTasks } from "./note_api_server.mjs";
import { eyecatchPng } from "./utils/eyecatch.mjs";
import { NOTE_PROFILE, chromeExe } from "./utils/note_chrome.mjs";
import { NOTE_TEXT_RULES, NOTE_FIX_MAX, applicableNoteRules, hasNoteTextIssue, noteHtmlText, planNoteFixes } from "./utils/note_pending.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = NOTE_PROFILE;

// Google などのログインは、自動操作中のブラウザを「安全でない」として拒否する。
// そのためログインだけは、自動操作なしの普通の Chrome を同じ専用プロファイルで開いて行い、窓が閉じられたら自動操作に戻る
class LoginRequired extends Error {}
// その記事だけの事情で直さなかった（編集画面の下書きが公開中と違うなど。何も公開していない）。次の記事へ進む
class NotFixed extends Error {}

// 記事の間などに意図して置く待ち時間（テスト用: ATR_NOTE_WAIT_SCALE で縮める）
const pause = (ms) => new Promise((r) => setTimeout(r, ms * Number(process.env.ATR_NOTE_WAIT_SCALE || 1)));


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

// 記事の本文（オーナーとしてログインしているので有料部分を含む全文）
const noteBody = (page, key) =>
  inPage(page, async (k) => {
    const r = await fetch(`/api/v3/notes/${k}`, { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
    if (!r.ok) return { error: `記事情報の取得に失敗 HTTP ${r.status}` };
    return { body: ((await r.json()).data || {}).body || "" };
  }, key);

// 比較用に、記号・空白・HTML の書式を除く
const plain = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").normalize("NFKC").replace(/[\s\p{P}\p{S}]/gu, "");

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

// 「更新」「投稿」「公開」を含む短い文言の要素（種類・role・aria-label・無効か）。公開設定画面の作りを遠隔で確かめるため
const publishCandidates = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => /更新|投稿|公開/.test(e.textContent || "") && (e.textContent || "").trim().length <= 12 && ![...e.children].some((c) => /更新|投稿|公開/.test(c.textContent || "")))
      .slice(0, 20)
      .map((e) => ({ tag: e.tagName.toLowerCase(), role: e.getAttribute("role"), aria: e.getAttribute("aria-label"), disabled: e.disabled || e.getAttribute("aria-disabled"), text: e.textContent.trim(), parent: e.parentElement?.tagName.toLowerCase() })),
  ).catch(() => []);

const buttonTexts = (p) => p.$$eval("button, a[role=button]", (els) => els.map((e) => e.textContent.trim()).filter(Boolean).slice(0, 40)).catch(() => []);

// アップロード後も記事に見出し画像が出ないとき（下書きにだけ付いたとき）の予備。編集画面で「公開に進む」→「更新する」を押して反映する。
// 2026-10-21 の実機では、正しくログインした状態ならアップロードだけで記事に反映され、この処理は使われなかった。
// 押すのは文言が一致するボタンだけ。各段階の URL とボタンの文言を記録する（画面構成が違ったときに原因を確認するため）
// 編集画面（editor.note.com）は note.com のログイン画面（?redirectPath=編集画面）を経由することがある。
// ログイン済みなら自動で戻るのを待ち、戻らなければログインが必要（LoginRequired）として呼び出し元に知らせる
// 実機では編集画面がいったん表示されてから、ログイン画面へ移動する。そのため「公開に進む」が出るか、編集画面から離れるかを待って判断する
// （ログイン画面のまま待つと、自動操作中の窓でログインしようとして Google に拒否される）
async function openEditor(ed, key, steps) {
  const editUrl = `https://editor.note.com/notes/${key}/edit/`;
  const onEditor = () => new URL(ed.url()).hostname === "editor.note.com" && ed.url().includes(`/notes/${key}/edit`);
  await ed.goto(editUrl, { waitUntil: "domcontentloaded" });
  const next = ed.getByRole("button", { name: /公開に進む/ }).first();
  await Promise.race([
    next.waitFor({ state: "visible", timeout: 30000 }),
    ed.waitForURL(() => !onEditor(), { timeout: 30000 }),
  ]).catch(() => {});
  if (onEditor()) return;
  // ログイン済みなら自動で編集画面に戻ることがあるので、少しだけ待つ
  await ed.waitForURL(() => onEditor(), { timeout: 4000 }).catch(() => {});
  if (onEditor()) return;
  steps.push({ at: "login", url: ed.url(), buttons: await buttonTexts(ed) });
  await ed.goto("about:blank").catch(() => {}); // 自動操作中の窓ではログインさせない
  throw new LoginRequired("note の編集画面を開くにはログインが必要です");
}

async function publishDraft(ctx, key, steps) {
  const ed = await ctx.newPage();
  try {
    await openEditor(ed, key, steps);
    await pressPublish(ed, steps);
  } finally {
    await ed.close().catch(() => {});
  }
}

// 編集画面で「公開に進む」→ 公開設定は変えずに「更新する」を押す
async function pressPublish(ed, steps) {
  {
    const next = ed.getByRole("button", { name: /公開に進む/ }).first();
    await next.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    steps.push({ at: "editor", url: ed.url(), buttons: await buttonTexts(ed) });
    if ((await next.count()) === 0) throw new Error("編集画面に「公開に進む」ボタンが見つかりません");
    await next.click();
    // 実機（2026-10-21）では、公開設定画面の <button> に「更新する」が無かった。ボタン以外の要素・部分一致・スクロール先も探し、
    // 見つからなければ「更新」「投稿」「公開」を含む要素の種類と文言を記録して止める（押せる要素を推測で選んで押さない）
    await ed.waitForTimeout(2000);
    await ed.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    const update = ed.locator('button, [role="button"], a, input[type="submit"], div[tabindex]').filter({ hasText: /^\s*(更新する|投稿する)\s*$/, visible: true }).first();
    await update.waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    steps.push({ at: "publish", url: ed.url(), buttons: await buttonTexts(ed), candidates: await publishCandidates(ed) });
    // 有料記事は「公開設定」の次に「有料エリア設定」（有料ラインの位置を選ぶ画面）があり、「更新する」はそこにある（2026-10-21 の実機ログ）。
    // 有料ラインの位置は変えずに次へ進むだけ
    if ((await update.count()) === 0) {
      const paidStep = ed.getByRole("button", { name: /^\s*有料エリア設定\s*$/ }).first();
      if ((await paidStep.count()) > 0) {
        await paidStep.click();
        await ed.waitForTimeout(2000);
        await update.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
        steps.push({ at: "paid-area", url: ed.url(), buttons: await buttonTexts(ed), candidates: await publishCandidates(ed) });
      }
    }
    if ((await update.count()) === 0) throw new Error("公開設定画面に「更新する」ボタンが見つかりません");
    await update.scrollIntoViewIfNeeded().catch(() => {});
    await update.click();
    // 公開設定画面（/publish）から離れるか、20 秒たつまで待つ
    await ed.waitForURL((u) => !/\/publish/.test(u.toString()), { timeout: 20000 }).catch(() => {});
    await ed.waitForTimeout(2000);
    steps.push({ at: "after-update", url: ed.url() });
  }
}

// 編集画面の本文（編集できる領域のうち、いちばん長いもの）
const editorText = (ed) =>
  ed.evaluate(() => [...document.querySelectorAll('[contenteditable="true"]')].map((e) => e.innerText).sort((a, b) => b.length - a.length)[0] || "");

// 編集画面の本文から文字列 text を探して選択する（見つからなければ false）。
// 太字などで複数のテキストノードに分かれていても選べるよう、段落ごとにテキストをつないで探す。段落・改行をまたいでは選ばない
const selectText = (ed, text) =>
  ed.evaluate((w) => {
    const roots = [...document.querySelectorAll('[contenteditable="true"]')].sort((a, b) => b.innerText.length - a.innerText.length);
    const root = roots[0];
    if (!root) return false;
    const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, figcaption, td, th, div";
    const blocks = new Map();
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== "BR") continue;
      const b = n.parentElement?.closest(BLOCK);
      const key = b && root.contains(b) ? b : root;
      if (!blocks.has(key)) blocks.set(key, { text: "", parts: [] });
      const g = blocks.get(key);
      if (n.nodeType === Node.TEXT_NODE) {
        g.parts.push({ node: n, at: g.text.length });
        g.text += n.data;
      } else g.text += "\n";
    }
    for (const g of blocks.values()) {
      const i = g.text.indexOf(w);
      if (i === -1) continue;
      const end = i + w.length;
      const s = g.parts.find((p) => i >= p.at && i < p.at + p.node.data.length);
      const e = g.parts.find((p) => end > p.at && end <= p.at + p.node.data.length);
      if (!s || !e) continue;
      root.focus();
      const r = document.createRange();
      r.setStart(s.node, i - s.at);
      r.setEnd(e.node, end - e.at);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      return true;
    }
    return false;
  }, text);

// 公開中の記事に残った直すべき表現（NOTE_TEXT_RULES の from）だけを to に置き換えて「更新する」まで行い、置き換えた規則の id を返す。
// 編集画面の下書きが公開中の記事と違う（以前の手作業の変更が残っている）記事は、意図しない内容を公開しないよう置き換えずに止める
async function fixNoteText(ctx, page, t, steps) {
  const live = await noteBody(page, t.key);
  if (live.error) throw new Error(live.error);
  const liveRules = applicableNoteRules(noteHtmlText(live.body));
  const ed = await ctx.newPage();
  let expected = [];
  try {
    await openEditor(ed, t.key, steps);
    await ed.getByRole("button", { name: /公開に進む/ }).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await ed.waitForTimeout(1500);
    const draft = await editorText(ed);
    const liveChars = plain(live.body).length;
    const draftChars = plain(draft).length;
    steps.push({ at: "wording-editor", url: ed.url(), liveChars, draftChars, rules: liveRules.map((r) => r.id) });
    if (!draftChars || Math.abs(draftChars - liveChars) > Math.max(40, liveChars * 0.03)) {
      throw new NotFixed(`編集画面の下書き（${draftChars} 字）が公開中の記事（${liveChars} 字）と違うため、自動では直しません`);
    }
    // 長い from から順に、その文字列だけを選んで to を打ち込む（前後の文字・有料ライン・公開設定は触らない）。
    // 前回の実行で置き換えたまま公開に至らなかった下書き（直す表現が無く、置き換え後の語がある）は、そのまま公開に進む
    const replaced = {};
    for (const r of applicableNoteRules(draft)) {
      replaced[r.id] = 0;
      while (replaced[r.id] < 5 && (await selectText(ed, r.from))) {
        await ed.keyboard.insertText(r.to);
        await ed.waitForTimeout(500);
        replaced[r.id]++;
      }
    }
    const after = await editorText(ed);
    expected = [...new Set([...liveRules, ...NOTE_TEXT_RULES.filter((r) => replaced[r.id] > 0)])].filter((r) => after.includes(r.to));
    steps.push({ at: "wording-replaced", replaced, draftChars: plain(after).length });
    if (hasNoteTextIssue(after)) throw new Error("編集画面で表現を置き換えられませんでした（公開はしていません）");
    // 下書きに直す表現も直した後の語も無い（公開中の記事と中身が違う）ときは、この記事だけ飛ばす
    if (!expected.length) throw new NotFixed("編集画面の下書きに直す表現が見つからないため、自動では直しません（公開はしていません）");
    await pressPublish(ed, steps);
  } finally {
    await ed.close().catch(() => {});
  }
  // 「更新する」の後、公開中の記事（API）で、直す表現が無く置き換え後の語があることを確かめる
  const updated = await noteBody(page, t.key);
  if (updated.error) throw new Error(updated.error);
  const text = noteHtmlText(updated.body);
  if (hasNoteTextIssue(text) || expected.some((r) => !text.includes(r.to))) throw new Error("「更新する」の後も記事に反映されていません");
  return expected.map((r) => r.id);
}

// 自分の記事の閲覧数・スキ数（note の統計。収益ゼロの原因を数字で見るため。非公開の API なので形式が変わりうる → 生の応答も残す）
const noteStats = (page) =>
  inPage(page, async () => {
    const out = { pages: [] };
    for (let p = 1; p <= 10; p++) {
      const r = await fetch(`/api/v1/stats/pv?filter=all&page=${p}&sort=pv`, { credentials: "include", headers: { "X-Requested-With": "XMLHttpRequest" } });
      const text = await r.text();
      if (!r.ok) return { ...out, error: `HTTP ${r.status}`, raw: text.slice(0, 500) };
      let d;
      try {
        d = JSON.parse(text).data;
      } catch (e) {
        return { ...out, raw: text.slice(0, 1500) };
      }
      out.pages.push(d);
      if (d?.last_page !== false && d?.is_last_page !== false) break;
    }
    return out;
  });

function summarizeStats(s) {
  const d0 = s.pages?.[0] || {};
  const notes = s.pages.flatMap((d) => d?.note_stats || []).map((n) => ({ name: (n.name || "").slice(0, 40), pv: n.read_count ?? null, like: n.like_count ?? null, comment: n.comment_count ?? null }));
  return { totalPv: d0.total_pv ?? null, totalLike: d0.total_like ?? null, totalComment: d0.total_comment ?? null, notes, ...(notes.length ? {} : { raw: JSON.stringify(s).slice(0, 2000) }), ...(s.error ? { error: s.error } : {}) };
}

async function eyecatch({ wording = false, stats = false } = {}) {
  let ctx;
  const result = { set: [], skipped: [], failed: [], manual: [], steps: {}, wording: { fixed: [], failed: [], manual: [], remaining: 0 } };
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

    // 要修正の表現の自動修正（scripts/utils/note_pending.mjs の NOTE_TEXT_RULES）。
    // オーナーとしてログインしているので有料部分を含む全文を読み、当てはまる記事だけ語を置き換えて「更新する」まで行う。
    // 1 回に直すのは NOTE_FIX_MAX 本まで（残りは次回の [E]）、記事の間は約 20 秒あける（短時間に更新を繰り返す機械的な動きにしない）
    if (wording && !result.failed.length) {
      const notes = [];
      for (const t of tasks) {
        const live = await noteBody(page, t.key);
        if (live.error) result.wording.failed.push(`${t.slug}: 本文を読めませんでした（${live.error}）`);
        else notes.push({ ...t, body: live.body });
        await pause(500);
      }
      const plan = planNoteFixes(notes, Number(process.env.ATR_NOTE_FIX_MAX) || NOTE_FIX_MAX);
      result.wording.manual = plan.manual;
      let tried = 0;
      for (let i = 0; i < plan.fix.length; i++) {
        const t = plan.fix[i];
        if (i > 0) await pause(20000);
        result.steps[`wording:${t.slug}`] = [];
        tried = i + 1;
        try {
          const ids = await fixNoteText(ctx, page, t, result.steps[`wording:${t.slug}`]);
          result.wording.fixed.push(t.slug);
          console.log(`  ✓ 要修正の表現を直して更新: ${t.slug}（${ids.join(", ")}）`);
        } catch (e) {
          if (e instanceof LoginRequired && !loggedIn) {
            loggedIn = true;
            await ctx.close().catch(() => {});
            await manualLogin();
            ({ ctx, page } = await openNote(true));
            await base();
            i--;
            continue;
          }
          result.wording.failed.push(`${t.slug}: ${e.message.split("\n")[0]}`);
          console.log(`  ✕ ${t.slug}: ${e.message.split("\n")[0]}`);
          // 下書きの食い違いなど、その記事だけの理由なら次の記事へ。画面構成の想定違いなどは同じ失敗を繰り返さないよう止める
          if (!(e instanceof NotFixed)) break;
        }
      }
      result.wording.remaining = plan.remaining + plan.fix.length - tried;
      plan.manual.forEach((s) => console.log(`  … ${s}: 自動では直せない書き方の表現があります（note の編集画面で手作業）`));
      if (plan.fix.length || plan.manual.length || result.wording.failed.length) {
        const rest = result.wording.remaining ? ` / 残り ${result.wording.remaining} 本は次回の [E] で直します` : "";
        console.log(`✏ 要修正の表現の修正: 修正 ${result.wording.fixed.length} / 失敗 ${result.wording.failed.length}${rest}`);
      }
    }

    // 閲覧数・スキ数（収益につながっているかを数字で見る）
    if (stats) {
      try {
        result.stats = summarizeStats(await noteStats(page));
        const top = result.stats.notes.slice(0, 5).map((n) => `${n.name}… ${n.pv ?? "?"}`).join(" / ");
        console.log(`📊 note の閲覧数: 合計 ${result.stats.totalPv ?? "?"} / スキ ${result.stats.totalLike ?? "?"}${top ? `（多い順: ${top}）` : ""}`);
      } catch (e) {
        result.stats = { error: e.message.split("\n")[0] };
      }
    }
    return result;
  } finally {
    await ctx?.close().catch(() => {});
  }
}

// 実行結果を scripts/note_browser_log.json に残す（ランチャーが GitHub に送り、遠隔で原因を確認できるように）
function writeLog(entry) {
  if (process.env.ATR_NOTE_MOCK) return; // テスト（模擬応答）の結果は残さない
  // どの版のコードで動いたかを残す（古い版のまま実行されたことに気づけるように）
  let version = "";
  try {
    version = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: __dirname, encoding: "utf8" }).trim();
  } catch (e) {}
  try {
    fs.writeFileSync(path.join(__dirname, "note_browser_log.json"), JSON.stringify({ at: new Date().toISOString(), version, ...entry }, null, 2) + "\n", "utf8");
  } catch (e) {}
}

if (process.argv[1] && process.argv[1].endsWith("note_browser.mjs")) {
  const cmd = process.argv[2];
  const run = cmd === "eyecatch" ? () => eyecatch() : cmd === "maintain" ? () => eyecatch({ wording: true, stats: true }) : null;
  if (!run) {
    console.log("使い方: node scripts/note_browser.mjs maintain | eyecatch");
    process.exit(2);
  }
  run().then(
    (result) => {
      const ok = result.failed.length === 0 && result.wording.failed.length === 0;
      writeLog({ cmd, ok, result });
      process.exit(ok ? 0 : 1);
    },
    (e) => {
      console.error(`❌ ${e.message}`);
      writeLog({ cmd, ok: false, error: String(e.stack || e.message).slice(0, 2000) });
      process.exit(1);
    },
  );
}
