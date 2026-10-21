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
import { NOTE_FIX_MAX, applicableNoteRules, applyNoteRules, hasNoteTextIssue, noteHtmlText, planNoteFixes, noteFixBudget } from "./utils/note_pending.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = NOTE_PROFILE;

// Google などのログインは、自動操作中のブラウザを「安全でない」として拒否する。
// そのためログインだけは、自動操作なしの普通の Chrome を同じ専用プロファイルで開いて行い、窓が閉じられたら自動操作に戻る
class LoginRequired extends Error {}
// その記事だけの事情で直さなかった（編集画面の下書きが公開中と違うなど。何も公開していない）。次の記事へ進む
class NotFixed extends Error {}

// [E] で表現を直した記録（直近 24 時間の本数の上限 noteFixBudget に使う）。オーナー端末の ~/.auto-tech-radar に置く
const FIX_HISTORY = path.join(path.dirname(NOTE_PROFILE), "note_fix_history.json");
function readFixHistory() {
  try {
    const h = JSON.parse(fs.readFileSync(FIX_HISTORY, "utf8"));
    return Array.isArray(h) ? h : [];
  } catch (e) {
    return [];
  }
}
// 直した直後に 1 本ずつ書く（途中で止まっても、直した分は数える）。7 日より古い記録は消す
function recordFix(slug) {
  const keep = readFixHistory().filter((h) => Date.parse(h?.at) > Date.now() - 7 * 24 * 60 * 60 * 1000);
  keep.push({ at: new Date().toISOString(), slug });
  fs.mkdirSync(path.dirname(FIX_HISTORY), { recursive: true });
  fs.writeFileSync(FIX_HISTORY, JSON.stringify(keep, null, 2) + "\n", "utf8");
}
// ISO 時刻を日本時間の「MM-DD HH:MM」で見せる
const jstLabel = (iso) => `${new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString().slice(5, 16).replace("T", " ")}（日本時間）`;

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

// ログインしていない読者が読める本文（有料記事なら無料部分だけ）。有料ラインの位置が変わっていないかを確かめるため。
// ブラウザのキャッシュは使わない（更新前に読んだ応答が返ると、変わっていないように見える）
const publicBody = (page, key) =>
  inPage(page, async (k) => {
    const r = await fetch(`/api/v3/notes/${k}`, { credentials: "omit", cache: "no-store", headers: { "X-Requested-With": "XMLHttpRequest" } });
    if (!r.ok) return { error: `公開中の記事（ログインなし）の取得に失敗 HTTP ${r.status}` };
    return { body: ((await r.json()).data || {}).body || "" };
  }, key);

// 本文を段落ごとの文字列にする（ブラウザ内で実行）。html を渡せばその HTML（API の本文）を、渡さなければ編集画面の本文を読む。
// 段落・見出し・箇条書き・引用・コードの文字だけを比べ、埋め込みや画像（figure。キャプションは除く）と、
// 編集画面の編集できない部品（contenteditable="false"。埋め込み・有料ラインの印など）の文字は数えない。改行（<br>）は \n
const noteBlocks = ({ html } = {}) => {
  const BLOCK = "p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, figcaption, td, th";
  const root =
    html !== undefined
      ? new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html").body
      : [...document.querySelectorAll('[contenteditable="true"]')].sort((a, b) => b.innerText.length - a.innerText.length)[0];
  if (!root) return null;
  const textOf = (el) => {
    let s = "";
    const w = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.nodeType === Node.TEXT_NODE) s += n.data;
      else if (n.tagName === "BR") s += "\n";
    }
    return s;
  };
  const out = [];
  for (const el of root.querySelectorAll(BLOCK)) {
    if (el.querySelector(BLOCK)) continue; // 内側の段落で数える（li > p、blockquote > p）
    const fixed = el.closest('[contenteditable="false"]');
    if (fixed && root.contains(fixed)) continue;
    if (el.closest("figure") && !el.closest("figcaption")) continue;
    const t = textOf(el);
    if (t.trim()) out.push(t);
  }
  return out;
};

// 段落の比較用の正規化（全角・半角の揺れ、空白・改行・ゼロ幅文字は違いとして扱わない）。空の段落は除く
const normBlocks = (blocks) => (blocks || []).map((b) => String(b).normalize("NFKC").replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, "")).filter(Boolean);
// want と got（normBlocks 済み）が同じなら null、違えば最初に違う段落の位置と長さ（本文は記録に残さない。記録は公開リポジトリに送られ、有料部分を含みうるため）
function blockDiff(want, got) {
  const n = Math.max(want.length, got.length);
  for (let i = 0; i < n; i++) {
    if (want[i] !== got[i]) return { index: i, wantBlocks: want.length, gotBlocks: got.length, wantChars: (want[i] || "").length, gotChars: (got[i] || "").length };
  }
  return null;
}

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
// 公開するのは、編集画面の本文が「公開中の記事に規則を当てた文」と段落ごとに一致したときだけ。
// 編集画面の下書きに公開していない変更（以前の手作業・貼りかけの原稿・価格の書き換えなど）が残っている記事は、
// 置き換える前に見分けて、何も打ち込まず公開もせずに止める（NotFixed）。
// 「更新する」の後は、ログインしていない読者が読める無料部分を更新前と比べ、有料ラインの位置が変わっていないことを確かめる
async function fixNoteText(ctx, page, t, steps) {
  const live = await noteBody(page, t.key);
  if (live.error) throw new Error(live.error);
  const liveRules = applicableNoteRules(noteHtmlText(live.body));
  if (!liveRules.length) throw new NotFixed("公開中の記事に直す表現が見つからないため、自動では直しません（公開はしていません）");
  // 直した後にあるべき本文（公開中の本文に規則を当てたもの）と、無料部分
  const want = normBlocks((await inPage(page, noteBlocks, { html: live.body })).map(applyNoteRules));
  const freeBefore = await publicBody(page, t.key);
  if (freeBefore.error) throw new Error(freeBefore.error);
  const freeBlocks = (await inPage(page, noteBlocks, { html: freeBefore.body })) || [];
  const freeOld = normBlocks(freeBlocks);
  const freeWant = normBlocks(freeBlocks.map(applyNoteRules));
  const ed = await ctx.newPage();
  try {
    await openEditor(ed, t.key, steps);
    await ed.getByRole("button", { name: /公開に進む/ }).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await ed.waitForTimeout(1500);
    const draftBlocks = (await ed.evaluate(noteBlocks, {})) || [];
    const liveChars = plain(live.body).length;
    const draftChars = plain(draftBlocks.join("\n")).length;
    // 下書きに規則を当てた本文が、公開中の本文に規則を当てたものと同じか（前回の実行で置き換えたまま公開に至らなかった下書きも、ここで同じになる）
    const before = blockDiff(want, normBlocks(draftBlocks.map(applyNoteRules)));
    steps.push({ at: "wording-editor", url: ed.url(), liveChars, draftChars, rules: liveRules.map((r) => r.id), ...(before ? { diff: before } : {}) });
    if (before) {
      throw new NotFixed(`編集画面の下書き（${draftChars} 字）が公開中の記事（${liveChars} 字）と違うため、自動では直しません（${before.index + 1} 段落目が違います。公開はしていません）`);
    }
    // 長い from から順に、その文字列だけを選んで to を打ち込む（前後の文字・有料ライン・公開設定は触らない）
    const replaced = {};
    for (const r of applicableNoteRules(draftBlocks.join("\n"))) {
      replaced[r.id] = 0;
      while (replaced[r.id] < 5 && (await selectText(ed, r.from))) {
        await ed.keyboard.insertText(r.to);
        await ed.waitForTimeout(500);
        replaced[r.id]++;
      }
    }
    const afterBlocks = (await ed.evaluate(noteBlocks, {})) || [];
    const after = afterBlocks.join("\n");
    const mismatch = blockDiff(want, normBlocks(afterBlocks));
    steps.push({ at: "wording-replaced", replaced, draftChars: plain(after).length, ...(mismatch ? { diff: mismatch } : {}) });
    if (hasNoteTextIssue(after)) throw new Error("編集画面で表現を置き換えられませんでした（公開はしていません）");
    if (mismatch) throw new Error(`置き換えた後の下書きが、公開中の記事に規則を当てた文と一致しません（${mismatch.index + 1} 段落目。公開はしていません）`);
    await pressPublish(ed, steps);
  } finally {
    await ed.close().catch(() => {});
  }
  // 「更新する」の後、公開中の記事（API）で、直す表現が無く置き換え後の語があることを確かめる
  const updated = await noteBody(page, t.key);
  if (updated.error) throw new Error(updated.error);
  const text = noteHtmlText(updated.body);
  if (hasNoteTextIssue(text) || liveRules.some((r) => !text.includes(r.to))) throw new Error("「更新する」の後も記事に反映されていません");
  // 有料ラインの位置: ログインしていない読者が読める無料部分が「更新前の無料部分に規則を当てたもの」と同じであること。
  // 反映待ち（更新前のまま）なら少し待って読み直す。違う形（有料部分が見える・無料部分が短くなった）なら、その場で全体を止める
  let freeDiff = null;
  let stale = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await pause(3000);
    const freeAfter = await publicBody(page, t.key);
    if (freeAfter.error) throw new Error(freeAfter.error);
    const got = normBlocks(await inPage(page, noteBlocks, { html: freeAfter.body }));
    freeDiff = blockDiff(freeWant, got);
    stale = Boolean(freeDiff) && !blockDiff(freeOld, got);
    if (!stale) break; // 一致した、または更新前とも違う（待っても変わらない）
  }
  steps.push({ at: "paid-line", freeBlocks: freeWant.length, ...(freeDiff ? { diff: freeDiff, stale } : {}) });
  if (freeDiff && stale) {
    throw new Error("「更新する」の後も、無料部分（ログインなしで読める部分）に反映されていません。note で記事を開いて確かめてください。残りの記事は直さずに止めます");
  }
  if (freeDiff) {
    throw new Error(
      `「更新する」の後、無料部分（ログインなしで読める部分）が更新前と違います（${freeDiff.index + 1} 段落目、更新前 ${freeDiff.wantBlocks} 段落 / 更新後 ${freeDiff.gotBlocks} 段落）。` +
        "有料ラインの位置が変わった可能性があります。note の編集画面で有料ラインの位置を確かめてください。残りの記事は直さずに止めます",
    );
  }
  return liveRules.map((r) => r.id);
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
    // 本文に要修正の問題がある記事（CI の検査結果）は、下書きの中身が分からないので自動で再公開しない。
    // テスト用: ATR_NOTE_STATUS に CI の検査結果の代わりのファイル（実データの note_status.json は CI が毎回書き換えるため）
    let flagged = new Set();
    try {
      const st = JSON.parse(fs.readFileSync(process.env.ATR_NOTE_STATUS || path.join(__dirname, "note_status.json"), "utf8"));
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
    // 直すのは直近 24 時間で NOTE_FIX_MAX 本まで（続けて [E] を押しても増えない。直した時刻はオーナー端末に記録）、
    // 記事の間は約 20 秒あける（短時間に更新を繰り返す機械的な動きにしない）
    if (wording && !result.failed.length) {
      const max = Number(process.env.ATR_NOTE_FIX_MAX) || NOTE_FIX_MAX;
      const budget = noteFixBudget(readFixHistory(), Date.now(), max);
      result.wording.budget = budget;
      if (!budget.left) {
        console.log(`\n✏ 要修正の表現の修正: 直近24時間で ${budget.used} 本直したため、今回は行いません（上限 ${max} 本。次は ${jstLabel(budget.nextAt)} 以降の [E] で直します）`);
      } else {
        const notes = [];
        for (const t of tasks) {
          const live = await noteBody(page, t.key);
          if (live.error) result.wording.failed.push(`${t.slug}: 本文を読めませんでした（${live.error}）`);
          else notes.push({ ...t, body: live.body });
          await pause(500);
        }
        const plan = planNoteFixes(notes, budget.left);
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
            recordFix(t.slug);
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
            // 「更新する」まで押した後の確認で止まった記事も、更新した本数に数える
            if (result.steps[`wording:${t.slug}`].some((s) => s.at === "after-update")) recordFix(t.slug);
            result.wording.failed.push(`${t.slug}: ${e.message.split("\n")[0]}`);
            console.log(`  ✕ ${t.slug}: ${e.message.split("\n")[0]}`);
            // 下書きの食い違いなど、その記事だけの理由なら次の記事へ。画面構成の想定違い・有料ラインの位置の変化などは同じ失敗を繰り返さないよう止める
            if (!(e instanceof NotFixed)) break;
          }
        }
        result.wording.remaining = plan.remaining + plan.fix.length - tried;
        plan.manual.forEach((s) => console.log(`  … ${s}: 自動では直せない書き方の表現があります（note の編集画面で手作業）`));
        if (plan.fix.length || plan.manual.length || result.wording.failed.length) {
          const next = noteFixBudget(readFixHistory(), Date.now(), max);
          const when = next.left ? "次回の [E]" : `${jstLabel(next.nextAt)} 以降の [E]`;
          const rest = result.wording.remaining ? ` / 残り ${result.wording.remaining} 本は${when}で直します（24時間に ${max} 本まで）` : "";
          console.log(`✏ 要修正の表現の修正: 修正 ${result.wording.fixed.length} / 失敗 ${result.wording.failed.length}${rest}`);
        }
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
