// 日付の決まり: 表示と「今日・直近 N 日」の判定は日本時間（JST）の暦日、保存用のキー（台帳のファイル名・GitHub 検索の日付）は UTC と名前で区別する。
// 計算は src/utils/dates.js の関数だけで行う（jstDate / jstDaysAgo / utcDate / addDays / withinLastDays）。
// 「toISOString().slice(0, 10)」（UTC の日付）と「+ 9 時間してから UTC として読む」が scripts・src に散らばり、
// UTC の日付と JST の公開日を比べて「直近 2 日」が 3〜4 日になる・週報が 9 日分になる、といった食い違いが起きた（2026-10-22）
import test from "node:test";
import assert from "node:assert/strict";
import { jstDate, jstDaysAgo, utcDate, addDays, withinLastDays, jstDayStart } from "../src/utils/dates.js";
import { trackedFiles, readRepo } from "./helpers/public_text.mjs";

// その場で暦日・時差を計算する書き方（UTC の日付の切り出し・手で足す 9 時間・UTC の日付部品の読み出し）
export const RAW_CALENDAR_MATH = [
  [/toISOString\(\)\s*\.\s*(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/, "toISOString() の先頭 10 文字（UTC の日付）"],
  [/toISOString\(\)\s*\.\s*split\(\s*["'`]T["'`]\s*\)\s*\[\s*0\s*\]/, "toISOString().split('T')[0]（UTC の日付）"],
  [/toISOString\(\)\s*\.\s*(?:slice|substring|substr)\(\s*\d+\s*,\s*1[0-9]\s*\)/, "toISOString() の切り出し（UTC の日時）"],
  [/\b9\s*\*\s*60\s*\*\s*60\s*\*\s*1000\b|\b9\s*\*\s*3600\s*\*\s*1000\b|\b32400000\b/, "手で足す 9 時間（JST の時差）"],
  [/\.getUTC(?:FullYear|Month|Date|Day|Hours|Minutes)\(\)/, "UTC の日付・時刻の部品を直接読む"],
  [/T00:00:00(?:\.000)?(?:Z|\+0?9:?00)["'`]/, "暦日の 0 時を文字列で組み立てる"],
];
const POLICY_FILE = "src/utils/dates.js";

function rawCalendarMath(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const [re, why] of RAW_CALENDAR_MATH) if (re.test(line)) hits.push(`${i + 1}: ${why}: ${line.trim().slice(0, 100)}`);
  });
  return hits;
}

test("scripts・src のコードは、暦日・時差の計算を src/utils/dates.js に任せ、その場で UTC/JST を混ぜて計算しない", () => {
  const code = trackedFiles().filter((f) => (f.startsWith("scripts/") || f.startsWith("src/")) && /\.(mjs|js|ts|astro)$/.test(f));
  assert.ok(code.includes("scripts/ping_search_engines.mjs") && code.includes(POLICY_FILE), "検査の対象が git の追跡ファイルから取れていない");
  const hits = [];
  for (const f of code) {
    if (f === POLICY_FILE) continue;
    for (const h of rawCalendarMath(readRepo(f))) hits.push(`${f}:${h}`);
  }
  assert.deepEqual(hits, []);
});

test("書き方を変えた UTC/JST の手計算も検出する", () => {
  for (const ng of [
    "const d = new Date().toISOString().slice(0,10);",
    "const d = now.toISOString().split(\"T\")[0];",
    "new Date(t + 9*60*60*1000)",
    "const label = `${d.getUTCMonth() + 1}月`;",
    "Date.parse(`${day}T00:00:00+09:00`)",
    "x.toISOString().substring(0, 10)",
  ]) {
    assert.ok(rawCalendarMath(ng).length > 0, ng);
  }
  assert.deepEqual(rawCalendarMath("const d = jstDate(now);"), []);
});

test("JST の今日・N 日前は日本時間の暦日で、UTC の日付とは名前で区別する", () => {
  // 日本時間 2026-10-22 06:17 は UTC では 2026-10-21 21:17
  const t = Date.parse("2026-10-21T21:17:00Z");
  assert.equal(jstDate(t), "2026-10-22");
  assert.equal(utcDate(t), "2026-10-21");
  assert.equal(jstDaysAgo(6, t), "2026-10-16");
  assert.equal(jstDaysAgo(0, t), "2026-10-22");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
  // 「直近 7 日」（今日を含む）の始まりの日は、withinLastDays と同じ範囲
  const since = jstDaysAgo(6, t);
  assert.equal(withinLastDays(jstDayStart(since), t, 7), true);
  assert.equal(withinLastDays(jstDayStart(jstDaysAgo(7, t)), t, 7), false);
});
