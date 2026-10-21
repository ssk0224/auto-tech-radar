// 記事生成が無言で止まらないための仕組みを確かめる:
// Gemini の失敗の分類・モデル順の決定・実行結果の記録（data/run_status）・記事が無い日のアラート（Issue）
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { classifyGeminiError, resolveModelOrder, MODEL_PREFERENCE } from "../scripts/utils/gemini_models.mjs";
import { appendRun, jstDate, recordRunStatus } from "../scripts/utils/run_status.mjs";
import { decideAlert, sendAlert, alertBody, ALERT_LABEL, ALERT_TITLE } from "../scripts/alert_if_no_article.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("Gemini の失敗を quota / unavailable / transient / other に分ける", () => {
  assert.equal(classifyGeminiError(new Error('{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}')), "quota");
  assert.equal(classifyGeminiError(Object.assign(new Error("Too Many Requests"), { status: 429 })), "quota");
  assert.equal(classifyGeminiError(new Error("models/gemini-x is not found for API version v1beta, or is not supported for generateContent.")), "unavailable");
  assert.equal(classifyGeminiError(Object.assign(new Error("x"), { status: 404 })), "unavailable");
  assert.equal(classifyGeminiError(new Error("This model is deprecated")), "unavailable");
  assert.equal(classifyGeminiError(new Error('{"error":{"code":503,"message":"The model is overloaded.","status":"UNAVAILABLE"}}')), "transient");
  assert.equal(classifyGeminiError(Object.assign(new Error("x"), { status: 500 })), "transient");
  assert.equal(classifyGeminiError(new Error("fetch failed")), "transient");
  assert.equal(classifyGeminiError(new Error("API key not valid")), "other");
});

test("モデル順: 一覧に載っている優先モデルだけ（優先順のまま）。一覧が失敗・該当なしなら静的リスト", async () => {
  const fakeAi = (names) => ({ models: { list: async () => (async function* () { for (const n of names) yield { name: `models/${n}`, supportedActions: ["generateContent"] }; })() } });
  assert.deepEqual(await resolveModelOrder(fakeAi(["gemini-2.5-flash-lite", "gemini-2.5-flash", "other"])), ["gemini-2.5-flash", "gemini-2.5-flash-lite"]);
  assert.deepEqual(await resolveModelOrder(fakeAi(["unrelated-model"])), MODEL_PREFERENCE);
  assert.deepEqual(await resolveModelOrder({ models: { list: async () => { throw new Error("403"); } } }), MODEL_PREFERENCE);
  // generateContent に対応しないモデルは使わない
  const embedOnly = { models: { list: async () => (async function* () { yield { name: "models/gemini-2.5-flash", supportedActions: ["embedContent"] }; yield { name: "models/gemini-2.5-flash-lite", supportedActions: ["generateContent"] }; })() } };
  assert.deepEqual(await resolveModelOrder(embedOnly), ["gemini-2.5-flash-lite"]);
  assert.equal(MODEL_PREFERENCE[0], "gemini-2.5-flash");
});

test("run_status は日本時間の日付ごとに 1 ファイルで、同じ日の実行を追記する", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-runstatus-"));
  try {
    const t1 = Date.parse("2026-10-20T21:17:00Z"); // JST 2026-10-21 06:17
    const t2 = Date.parse("2026-10-21T03:17:00Z"); // JST 2026-10-21 12:17
    recordRunStatus({ rootDir: dir, now: t1, generated: 0, reason: "quota", event: "schedule" });
    recordRunStatus({ rootDir: dir, now: t2, generated: 1, reason: "ok", model: "gemini-2.5-flash", event: "schedule" });
    const st = JSON.parse(fs.readFileSync(path.join(dir, "data/run_status/2026-10-21.json"), "utf8"));
    assert.equal(st.date, "2026-10-21");
    assert.deepEqual(st.runs.map((r) => [r.reason, r.generated, r.model]), [["quota", 0, null], ["ok", 1, "gemini-2.5-flash"]]);
    assert.equal(jstDate(Date.parse("2026-10-21T15:00:00Z")), "2026-10-22");
    // 想定外の reason は error として残す。別の日付の記録は引き継がない
    assert.equal(appendRun({ date: "2026-10-20", runs: [{}] }, "2026-10-21", { at: "x", reason: "weird" }).runs.length, 1);
    assert.equal(appendRun(null, "2026-10-21", { at: "x", reason: "weird" }).runs[0].reason, "error");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- アラート（scripts/alert_if_no_article.mjs） ----
const NOW = Date.parse("2026-10-21T03:30:00Z"); // JST 2026-10-21 12:30（第3便の直後）

function fixture({ todayArticle, runs }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-alert-"));
  const radar = path.join(dir, "src/pages/radar");
  fs.mkdirSync(radar, { recursive: true });
  fs.writeFileSync(path.join(radar, "old.md"), '---\ntitle: "old"\npubDate: "2026-10-20"\nstars: 1\n---\n# old\n');
  if (todayArticle) fs.writeFileSync(path.join(radar, "fresh.md"), '---\ntitle: "fresh"\npubDate: "2026-10-21"\nstars: 1\n---\n# fresh\n');
  if (runs) {
    fs.mkdirSync(path.join(dir, "data/run_status"), { recursive: true });
    fs.writeFileSync(path.join(dir, "data/run_status/2026-10-21.json"), JSON.stringify({ date: "2026-10-21", runs }));
  }
  return dir;
}

// GitHub API のモック。呼び出しを記録し、openIssues を Issue 一覧として返す
function mockGitHub(openIssues) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    calls.push({ method: opts.method || "GET", url: String(url), body: opts.body ? JSON.parse(opts.body) : null });
    if ((opts.method || "GET") === "GET") return new Response(JSON.stringify(openIssues), { status: 200 });
    if (String(url).endsWith("/labels")) return new Response("{}", { status: 422 });
    if (String(url).endsWith("/issues")) return new Response(JSON.stringify({ number: 7 }), { status: 201 });
    return new Response("{}", { status: 201 });
  };
  return { calls, fetchImpl };
}

test("今日の記事があればアラートを出さない", () => {
  const dir = fixture({ todayArticle: true, runs: [{ at: "t", event: "schedule", generated: 1, reason: "ok", model: "gemini-2.5-flash" }] });
  try {
    const d = decideAlert({ rootDir: dir, now: NOW });
    assert.equal(d.date, "2026-10-21");
    assert.equal(d.alert, false);
    assert.deepEqual(d.slugs, ["fresh"]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("今日の記事が無く open なアラートも無ければ、ラベル付きの Issue を 1 件作り、理由を本文に載せる", async () => {
  const dir = fixture({ todayArticle: false, runs: [{ at: "2026-10-20T21:17:00Z", event: "schedule (17 21 * * *)", generated: 0, reason: "quota", model: null }] });
  try {
    const d = decideAlert({ rootDir: dir, now: NOW });
    assert.equal(d.alert, true);
    const body = alertBody(d);
    assert.match(body, /2026-10-21/);
    assert.match(body, /reason `quota`/);
    const { calls, fetchImpl } = mockGitHub([{ number: 3, pull_request: {} }]); // PR は Issue として扱わない
    const r = await sendAlert({ repo: "owner/repo", token: "t", body, fetchImpl });
    assert.deepEqual(r, { action: "created", number: 7 });
    const created = calls.find((c) => c.method === "POST" && c.url === "https://api.github.com/repos/owner/repo/issues");
    assert.equal(created.body.title, ALERT_TITLE);
    assert.deepEqual(created.body.labels, [ALERT_LABEL]);
    assert.ok(calls.every((c) => c.url.startsWith("https://api.github.com/repos/owner/repo/")), "このリポジトリ以外の API を呼ばない");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("open なアラート Issue があれば、新しく作らずにコメントする", async () => {
  const dir = fixture({ todayArticle: false, runs: null });
  try {
    const d = decideAlert({ rootDir: dir, now: NOW });
    assert.match(alertBody(d), /実行記録がありません/);
    const { calls, fetchImpl } = mockGitHub([{ number: 12, title: ALERT_TITLE }]);
    const r = await sendAlert({ repo: "owner/repo", token: "t", body: alertBody(d), fetchImpl });
    assert.deepEqual(r, { action: "commented", number: 12 });
    assert.equal(calls.filter((c) => c.method === "POST").length, 1);
    assert.equal(calls.at(-1).url, "https://api.github.com/repos/owner/repo/issues/12/comments");
    assert.ok(!calls.some((c) => c.url.endsWith("/repos/owner/repo/issues") && c.method === "POST"));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("GITHUB_TOKEN / GITHUB_REPOSITORY が無いローカル実行では何も送らず正常終了する", () => {
  const dir = fixture({ todayArticle: false, runs: null });
  try {
    const env = { ...process.env };
    delete env.GITHUB_TOKEN;
    delete env.GITHUB_REPOSITORY;
    const r = spawnSync(process.execPath, [path.join(root, "scripts/alert_if_no_article.mjs")], { cwd: dir, encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Issue は作成しません/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
