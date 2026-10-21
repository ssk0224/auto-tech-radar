// Radar Ledger（日次スナップショット）とスター推移の計算、記事ページ・API に出す値を確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { LEDGER_FIELDS, computeVelocity, ledgerPaths, readLedger, repoFullNameFromUrl, toLedgerRow, velocityFor } from "../scripts/utils/ledger.mjs";
import { snapshotLedger, featuredRepos, updateVelocity } from "../scripts/snapshot_ledger.mjs";
import { trackRecordFor, trackRecordLine, growthPct } from "../src/utils/track_record.js";

const root = path.resolve(import.meta.dirname, "..");
const NOW = Date.parse("2026-10-21T03:17:00Z");
const DATE = "2026-10-21";

// 検索結果の item（GitHub API の形。個人単位の値・所有者情報も含めておき、台帳に入らないことを確かめる）
const item = (full_name, stars, extra = {}) => ({
  full_name, name: full_name.split("/")[1], stargazers_count: stars, forks_count: 3, open_issues_count: 4,
  pushed_at: "2026-10-20T00:00:00Z", created_at: "2026-01-01T00:00:00Z", archived: false, license: { spdx_id: "MIT", name: "MIT License" },
  owner: { login: full_name.split("/")[0], id: 1, avatar_url: "https://example.invalid/a.png" }, description: "d", ...extra,
});

function tmpRoot(featured = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-ledger-"));
  const radar = path.join(dir, "src/pages/radar");
  fs.mkdirSync(radar, { recursive: true });
  featured.forEach((url, i) => fs.writeFileSync(path.join(radar, `a${i}.md`), `---\ntitle: "a${i}"\npubDate: "2026-10-01"\nrepoUrl: "${url}"\nstars: 100\n---\n# a\n`));
  return dir;
}

// GitHub API のモック。routes: (url) => Response | undefined。呼び出した URL を記録する
function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    url = String(url);
    calls.push(url);
    const r = routes(url);
    if (r) return r;
    return new Response("{}", { status: 404 });
  };
  return { calls, fetchImpl };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("その日のファイルが既にあれば API を 1 回も呼ばない（1 日 1 回）", async () => {
  const dir = tmpRoot(["https://github.com/acme/featured"]);
  try {
    const { file } = ledgerPaths(dir, DATE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "");
    const { calls, fetchImpl } = mockFetch(() => json({ items: [] }));
    const r = await snapshotLedger({ rootDir: dir, now: NOW, fetchImpl, delayMs: 0 });
    assert.equal(r.status, "skipped");
    assert.equal(calls.length, 0);
    assert.equal(fs.readFileSync(file, "utf8"), "");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("台帳の行は決まった項目だけ（個人単位のデータなし）。検索候補はリリース null、掲載済みはリリースを取る", async () => {
  const dir = tmpRoot(["https://github.com/acme/featured", "https://github.com/Acme/Both/", "https://github.com/acme/featured"]);
  try {
    const { calls, fetchImpl } = mockFetch((url) => {
      if (url.includes("/search/repositories")) return json({ items: [item("acme/cand", 500), item("acme/both", 900)] });
      if (url === "https://api.github.com/repos/acme/featured") return json(item("acme/featured", 1200, { archived: true, license: null }));
      if (url === "https://api.github.com/repos/acme/featured/releases/latest") return json({ tag_name: "v1.2.0", published_at: "2026-10-10T00:00:00Z", author: { login: "someone" } });
      // acme/both はリリースなし（404）
    });
    const r = await snapshotLedger({ rootDir: dir, now: NOW, fetchImpl, delayMs: 0 });
    assert.equal(r.status, "complete");
    // 検索 3 回 + featured（リポジトリ・リリース）+ both（検索結果にあるのでリリースだけ）
    assert.equal(calls.filter((u) => u.includes("/search/")).length, 3);
    assert.ok(!calls.includes("https://api.github.com/repos/acme/both"), "検索結果にある掲載済みリポジトリは取り直さない");
    assert.ok(calls.includes("https://api.github.com/repos/acme/both/releases/latest"));
    assert.ok(!calls.some((u) => /stargazers|contributors|\/users\//.test(u)), "個人単位の API は呼ばない");

    const { file, partial } = ledgerPaths(dir, DATE);
    assert.ok(file.endsWith(path.join("data", "ledger", "2026", "10", "21.jsonl")));
    assert.ok(!fs.existsSync(partial));
    const rows = fs.readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(rows.map((x) => x.full_name), ["acme/both", "acme/cand", "acme/featured"]);
    for (const row of rows) assert.deepEqual(Object.keys(row), LEDGER_FIELDS);
    assert.deepEqual(LEDGER_FIELDS, ["date", "full_name", "stars", "forks", "open_issues", "pushed_at", "created_at", "archived", "license", "latest_release_tag", "latest_release_at"]);
    const byName = Object.fromEntries(rows.map((x) => [x.full_name, x]));
    assert.deepEqual(byName["acme/cand"], { date: DATE, full_name: "acme/cand", stars: 500, forks: 3, open_issues: 4, pushed_at: "2026-10-20T00:00:00Z", created_at: "2026-01-01T00:00:00Z", archived: false, license: "MIT", latest_release_tag: null, latest_release_at: null });
    assert.equal(byName["acme/featured"].latest_release_tag, "v1.2.0");
    assert.equal(byName["acme/featured"].archived, true);
    assert.equal(byName["acme/featured"].license, null);
    assert.equal(byName["acme/both"].latest_release_tag, null);
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /someone|avatar_url|"owner"|"login"/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("403（レート制限）では途中までを .partial に書いて止め、完了扱いにしない。次の実行で取り直して完了にする", async () => {
  const dir = tmpRoot(["https://github.com/acme/featured", "https://github.com/acme/second"]);
  try {
    const first = mockFetch((url) => {
      if (url.includes("/search/repositories")) return json({ items: [item("acme/cand", 500)] });
      if (url === "https://api.github.com/repos/acme/featured") return new Response("rate limited", { status: 403 });
    });
    const r1 = await snapshotLedger({ rootDir: dir, now: NOW, fetchImpl: first.fetchImpl, delayMs: 0 });
    assert.equal(r1.status, "partial");
    assert.equal(r1.reason, "rate_limit");
    assert.ok(!first.calls.some((u) => u.includes("acme/second")), "レート制限の後は呼ばない");
    const { file, partial } = ledgerPaths(dir, DATE);
    assert.ok(!fs.existsSync(file), "完了ファイルを書かない");
    assert.deepEqual(fs.readFileSync(partial, "utf8").trim().split("\n").map((l) => JSON.parse(l).full_name), ["acme/cand"]);
    // .partial しかない日の行も推移の計算には使う
    assert.equal(readLedger(dir).length, 1);

    const second = mockFetch((url) => {
      if (url.includes("/search/repositories")) return json({ items: [item("acme/cand", 510)] });
      if (url === "https://api.github.com/repos/acme/featured") return json(item("acme/featured", 1200));
      if (url === "https://api.github.com/repos/acme/second") return json(item("acme/second", 50));
    });
    const r2 = await snapshotLedger({ rootDir: dir, now: NOW, fetchImpl: second.fetchImpl, delayMs: 0 });
    assert.equal(r2.status, "complete");
    assert.ok(fs.existsSync(file));
    assert.ok(!fs.existsSync(partial));
    assert.equal(readLedger(dir).find((x) => x.full_name === "acme/cand").stars, 510);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("通信失敗でも例外を投げず .partial にする（デプロイを止めない）", async () => {
  const dir = tmpRoot([]);
  try {
    const fetchImpl = async () => { throw new Error("getaddrinfo ENOTFOUND api.github.com"); };
    const r = await snapshotLedger({ rootDir: dir, now: NOW, fetchImpl, delayMs: 0 });
    assert.equal(r.status, "partial");
    assert.equal(r.reason, "network");
    assert.ok(!fs.existsSync(ledgerPaths(dir, DATE).file));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("スター推移: 最新値・初出・記録日数・1/7/30 日の増加数（履歴が足りなければ null）", () => {
  const rows = [];
  const push = (date, full_name, stars) => rows.push(toLedgerRow(date, { full_name, stargazers_count: stars }));
  // acme/a: 9/20〜10/21 の毎日（1 日 10 ずつ増える）
  for (let i = 0; i <= 31; i++) push(new Date(Date.parse("2026-09-20T00:00:00Z") + i * 864e5).toISOString().slice(0, 10), "acme/a", 1000 + i * 10);
  // acme/b: 10/13 と 10/21 だけ（7 日前ちょうどは無いが 1 日の許容範囲内に 10/13 がある）
  push("2026-10-13", "acme/b", 100);
  push("2026-10-21", "acme/b", 160);
  // acme/c: 10/21 の 1 日だけ
  push("2026-10-21", "acme/c", 5);
  const v = computeVelocity(rows);
  assert.equal(v.as_of, "2026-10-21");
  assert.deepEqual(Object.keys(v.repos), ["acme/a", "acme/b", "acme/c"]);
  assert.deepEqual(v.repos["acme/a"], { stars_now: 1310, last_seen: "2026-10-21", first_seen: "2026-09-20", days_on_radar: 32, gain_1d: 10, gain_7d: 70, gain_30d: 300 });
  assert.deepEqual(v.repos["acme/b"], { stars_now: 160, last_seen: "2026-10-21", first_seen: "2026-10-13", days_on_radar: 2, gain_1d: null, gain_7d: 60, gain_30d: null });
  assert.deepEqual(v.repos["acme/c"], { stars_now: 5, last_seen: "2026-10-21", first_seen: "2026-10-21", days_on_radar: 1, gain_1d: null, gain_7d: null, gain_30d: null });
  // 大文字小文字の違いを吸収して引ける
  assert.equal(velocityFor(v, "ACME/B").stars_now, 160);
  assert.equal(velocityFor(v, "acme/zzz"), null);
  assert.deepEqual(computeVelocity([]), { as_of: null, repos: {} });
});

test("updateVelocity は台帳から data/derived/velocity.json を作り、同じ台帳なら同じ内容になる", () => {
  const dir = tmpRoot([]);
  try {
    const { file } = ledgerPaths(dir, DATE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(toLedgerRow(DATE, { full_name: "acme/a", stargazers_count: 7 })) + "\n");
    updateVelocity(dir);
    const out = path.join(dir, "data/derived/velocity.json");
    const first = fs.readFileSync(out, "utf8");
    updateVelocity(dir);
    assert.equal(fs.readFileSync(out, "utf8"), first);
    assert.equal(JSON.parse(first).repos["acme/a"].stars_now, 7);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("掲載済みリポジトリは記事の repoUrl から取り、すべての記事で full_name が分かる", () => {
  assert.equal(repoFullNameFromUrl("https://github.com/jaredpalmer/kev"), "jaredpalmer/kev");
  assert.equal(repoFullNameFromUrl("https://github.com/a/b.git"), "a/b");
  assert.equal(repoFullNameFromUrl("https://github.com/a/b/tree/main"), "a/b");
  assert.equal(repoFullNameFromUrl("https://gitlab.com/a/b"), null);
  const radar = path.join(root, "src/pages/radar");
  const articles = fs.readdirSync(radar).filter((f) => f.endsWith(".md"));
  const names = featuredRepos(radar);
  assert.ok(names.length > 0);
  for (const n of names) assert.match(n, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  // repoUrl を持つ記事はすべて台帳の対象になる（重複する URL は 1 件）
  const urls = new Set(articles.map((f) => fs.readFileSync(path.join(radar, f), "utf8").match(/^repoUrl:\s*["']?([^"'\s]+)/m)?.[1]).filter(Boolean).map((u) => repoFullNameFromUrl(u)?.toLowerCase()));
  assert.deepEqual(new Set(names.map((n) => n.toLowerCase())), urls);
});

test("記事ページの 1 行と API の値: 記録がある記事だけ現在値を出し、増加率を計算する", () => {
  const velocity = { as_of: "2026-10-21", repos: { "jaredpalmer/kev": { stars_now: 10000, last_seen: "2026-10-21", first_seen: "2026-10-14", days_on_radar: 8, gain_1d: 10, gain_7d: 800, gain_30d: null } } };
  const fm = { repoUrl: "https://github.com/jaredpalmer/kev", stars: 8000, pubDate: "2026-10-14" };
  assert.equal(trackRecordLine(fm, velocity), "掲載時 ★8,000（2026-10-14）→ 現在 ★10,000（2026-10-21 時点）");
  assert.deepEqual(trackRecordFor(fm, velocity), { stars_at_publish: 8000, stars_now: 10000, stars_now_date: "2026-10-21", growth_pct: 25 });
  // 記録が無い記事は出さない（API の現在値・増加率は null）
  const other = { repoUrl: "https://github.com/acme/none", stars: 5, pubDate: "2026-10-01" };
  assert.equal(trackRecordLine(other, velocity), null);
  assert.deepEqual(trackRecordFor(other, velocity), { stars_at_publish: 5, stars_now: null, stars_now_date: null, growth_pct: null });
  assert.equal(trackRecordLine(fm, null), null);
  assert.equal(growthPct(0, 10), null);
  assert.equal(growthPct(3, 4), 33.3);
  // 因果関係（掲載で伸びた等）を表す言葉を使わない
  assert.doesNotMatch(trackRecordLine(fm, velocity), /おかげ|効果|により|貢献|伸ばし/);
});
