// 日付の決まり: 表示と「今日・直近 N 日」の判定は日本時間（JST）の暦日、保存用のキー・記録の時刻（台帳のファイル名・GitHub 検索の日付・
// 実行記録の at）は UTC と名前で区別する。Date を暦日・時刻・文字列に変える計算は src/utils/dates.js の関数だけで行う
// （jstDate / jstDaysAgo / jstClock / utcDate / utcStamp / addDays / withinLastDays）。
// 書き方を一つずつ禁じるのではなく、「Date を暦日・時刻に変える API」をこのファイルの外で使うこと自体を止める:
// 実行するマシンの時刻帯で結果が変わる API（getMonth・toLocaleDateString・toJSON の切り出し…）は owner PC（JST）と CI（UTC）で違う値を返し、
// UTC の API をその場で使うと JST の公開日と比べて「直近 2 日」が 3〜4 日になる・週報が 9 日分になる、といった食い違いが起きた（2026-10-22）
import test from "node:test";
import assert from "node:assert/strict";
import { jstDate, jstDaysAgo, utcDate, utcStamp, addDays, withinLastDays, jstDayStart } from "../src/utils/dates.js";
import { trackedFiles, isCodeFile, stripComments, readRepo } from "./helpers/public_text.mjs";

const NINE_HOURS = new Set([9 * 3600 * 1000, 9 * 3600, 9 * 60]);
// 数の積（9 * 60 * 60 * 1000・9 * 36e5・32400000）を計算して、9 時間（ms・秒・分）になるものを拾う
function nineHourProducts(line) {
  const hits = [];
  for (const m of line.matchAll(/(?<![\w.])\d[\d_]*(?:\.\d+)?(?:e\d+)?(?:\s*\*\s*\d[\d_]*(?:\.\d+)?(?:e\d+)?)*/gi)) {
    const factors = m[0].split("*").map((x) => Number(x.trim().replace(/_/g, "")));
    const value = factors.reduce((a, b) => a * b, 1);
    if (NINE_HOURS.has(value) && (factors.length > 1 || value >= 32400)) hits.push(m[0].trim());
  }
  return hits;
}

// Date の暦日・時刻・文字列の API は、手書きの一覧でなく実行環境の Date.prototype から導く:
// Date だけが持つメソッド（getYear・toGMTString・toTemporalInstant のような古い・新しい名前も含む）は、getTime 以外すべて止める
const SHARED_PROTOS = [Object, Number, String, Array, Function, BigInt, Boolean, Symbol, RegExp].flatMap((c) => Object.getOwnPropertyNames(c.prototype));
const DATE_ONLY_METHODS = Object.getOwnPropertyNames(Date.prototype).filter((n) => n !== "getTime" && !SHARED_PROTOS.includes(n));
// 他の型と同じ名前のメソッド（toString・toLocaleString）は、受け手が日付を表す名前のときに止める（数の toLocaleString は区切りの書式で、時刻帯に依らない）
const SHARED_DATE_METHODS = Object.getOwnPropertyNames(Date.prototype).filter((n) => SHARED_PROTOS.includes(n) && /^to/.test(n));
const DATE_LIKE_NAME = String.raw`(?:\w*(?:Date|Day|Time|Stamp|At|When)|(?:date|day|time|now|stamp|today|when|then)\w*)`;

// Date を暦日・時刻・文字列に変える API と、時差・時刻帯をその場で書くこと
export const CALENDAR_APIS = [
  [new RegExp(String.raw`\.\s*(?:${DATE_ONLY_METHODS.join("|")})\s*\(`), "Date の暦日・時刻・文字列のメソッド（src/utils/dates.js の関数を使う）"],
  [new RegExp(String.raw`(?<![\w$.])${DATE_LIKE_NAME}\s*\.\s*(?:${SHARED_DATE_METHODS.join("|")})\s*\(`), "日付の toString・toLocaleString（時刻帯で変わる）"],
  // Date を作れるのは dates.js だけ（作った Date を文字列にする・テンプレートに埋める書き方を一つずつ止めるより確実）。Date.now()・Date.parse() は数を返すので使ってよい
  [/\bnew\s+Date\b|(?<![\w$.])Date\s*\(/, "Date を作る（ms の数のまま扱い、暦日・時刻は dates.js の関数で作る）"],
  [/\bIntl\s*\.\s*(?:DateTimeFormat|RelativeTimeFormat)\b|\bTemporal\b|\.\s*toTemporal\w*\s*\(/, "時刻帯で変わる日付の書式・別の日付 API（jstDate・jstClock を使う）"],
  [/\bprocess\.env\.TZ\b|\bTZ\s*[:=]/, "実行環境の時刻帯を書き換える（どの時刻帯で動いても同じ結果にする）"],
  [/Asia\/Tokyo|[+-]0?9:?00\b|\b(?:UTC|GMT)\s*\+\s*0?9\b/, "時刻帯・時差をその場で書く"],
  [/["'`][^"'`\n]*T\d{2}:\d{2}|T\$\{/, "日時を文字列で組み立てる"],
  [/\.\s*(?:slice|substring|substr)\(\s*0\s*,\s*(?:10|19)\s*\)|\.\s*split\(\s*["'`]T["'`]\s*\)/, "日時の文字列から暦日・時刻を切り出す"],
];
const POLICY_FILE = "src/utils/dates.js";

export function calendarMath(text) {
  const hits = [];
  stripComments(text)
    .split("\n")
    .forEach((line, i) => {
      for (const [re, why] of CALENDAR_APIS) if (re.test(line)) hits.push(`${i + 1}: ${why}: ${line.trim().slice(0, 100)}`);
      for (const p of nineHourProducts(line)) hits.push(`${i + 1}: 手で足す 9 時間（${p}）: ${line.trim().slice(0, 100)}`);
    });
  return hits;
}

test("scripts・src のコードは、Date を暦日・時刻・文字列に変える計算を src/utils/dates.js に任せ、その場で UTC/JST・実行環境の時刻帯を混ぜない", () => {
  const code = trackedFiles().filter((f) => (f.startsWith("scripts/") || f.startsWith("src/")) && isCodeFile(f));
  assert.ok(code.includes("scripts/ping_search_engines.mjs") && code.includes(POLICY_FILE), "検査の対象が git のファイル一覧から取れていない");
  const hits = code.filter((f) => f !== POLICY_FILE).flatMap((f) => calendarMath(readRepo(f)).map((h) => `${f}:${h}`));
  assert.deepEqual(hits, []);
});

test("書き方を変えた UTC/JST の手計算・実行環境の時刻帯に頼る書き方も検出する", () => {
  for (const ng of [
    "const d = new Date().toISOString().slice(0,10);",
    'const d = now.toISOString().split("T")[0];',
    "new Date(t + 9*60*60*1000)",
    "const label = `${d.getUTCMonth() + 1}月`;",
    "Date.parse(`${day}T00:00:00+09:00`)",
    "x.toISOString().substring(0, 10)",
    "const d = new Date().toJSON().slice(0, 10);",
    "const t = Date.now() + 9 * 36e5;",
    "const d = new Date().toLocaleDateString('sv-SE');",
    "const label = `${n.getMonth()+1}月${n.getDate()}日`;",
    "const iso = d.toISOString(); const day = iso.slice(0, 10);",
    "const jst = new Date(Date.now() + 32400000);",
    "new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo' }).format(d)",
    "const d = new Date(2026, 9, 22);",
    "const s = new Date().toLocaleString('ja-JP', { month: 'long' });",
    "const off = new Date().getTimezoneOffset();",
    "const day = stamp.split('T')[0];",
    "const s = now.toLocaleString('ja-JP');",
    "const y = now.getYear() + 1900;",
    "const s = String(new Date()).slice(4, 15);",
    "process.env.TZ = 'Japan';",
    "const s = new Date().toString();",
    "const d = Temporal.Now.plainDateISO();",
    "const s = `${new Date()}`;",
    "const s = Date();",
    "const label = pubDate.toString();",
    "const t = d.toTemporalInstant();",
    "const s = updatedAt.toLocaleString();",
    "env: { ...process.env, TZ: 'UTC' }",
  ]) {
    assert.ok(calendarMath(ng).length > 0, ng);
  }
  for (const ok of ["const d = jstDate(now);", "const s = stars.toLocaleString();", "const t = Date.now();", "const t = Date.parse(s);", "const h = n.toString(16);", "const s = (numPrice || 0).toLocaleString();", "const top = items.slice(0, 7);", "// toISOString().slice(0, 10) はここでは使わない", "const w = 540;"]) {
    assert.deepEqual(calendarMath(ok), [], ok);
  }
});

test("JST の今日・N 日前は日本時間の暦日で、UTC の日付・時刻とは名前で区別する", () => {
  // 日本時間 2026-10-22 06:17 は UTC では 2026-10-21 21:17
  const t = Date.parse("2026-10-21T21:17:00Z");
  assert.equal(jstDate(t), "2026-10-22");
  assert.equal(utcDate(t), "2026-10-21");
  assert.equal(utcStamp(t), "2026-10-21T21:17:00.000Z");
  assert.equal(jstDaysAgo(6, t), "2026-10-16");
  assert.equal(jstDaysAgo(0, t), "2026-10-22");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
  // 「直近 7 日」（今日を含む）の始まりの日は、withinLastDays と同じ範囲
  const since = jstDaysAgo(6, t);
  assert.equal(withinLastDays(jstDayStart(since), t, 7), true);
  assert.equal(withinLastDays(jstDayStart(jstDaysAgo(7, t)), t, 7), false);
});
