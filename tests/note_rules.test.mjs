// 公開中の note の要修正の表現（[E] の自動修正・CI の検査・[U] の一覧）と、note の新規出品の上限を確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  NOTE_TEXT_CHECKS,
  NOTE_FIX_MAX,
  NOTE_FIX_WINDOW_MS,
  noteFixBudget,
  hasNoteTextIssue,
  noteTextIssues,
  noteHtmlText,
  normBlocks,
  planFreePartReplace,
  planFreePartFixes,
  statusUpdateItems,
  noteIssueCounts,
  autoFixableByMaintain,
} from "../scripts/utils/note_pending.mjs";
import { renderDraftFree } from "../scripts/utils/free_part.mjs";
import { publishedNoteIssues } from "../scripts/sync_note_urls.mjs";
import { noteListingBlock, jstDay } from "../scripts/utils/note_listing.mjs";
import { readText } from "./helpers/read_src.mjs";

const INVOICE = "※noteは購入後、マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。";
const RECEIPT = "※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。";
const issueOf = (id) => NOTE_TEXT_CHECKS.find((r) => r.id === id).issue;

test("検出の表: id は一意で、どの検出も正本（note_drafts/ の全原稿の無料部分）には当たらない", () => {
  assert.equal(new Set(NOTE_TEXT_CHECKS.map((r) => r.id)).size, NOTE_TEXT_CHECKS.length);
  // 語ごとの置き換え規則（from / to）は持たない。直すのは「無料部分を原稿の描画に置き換える」こと
  for (const r of NOTE_TEXT_CHECKS) assert.deepEqual(Object.keys(r).sort(), ["detect", "id", "issue"], r.id);
  const drafts = fs.readdirSync("note_drafts").filter((x) => x.endsWith(".md"));
  assert.ok(drafts.length > 30);
  for (const f of drafts) {
    const s = readText(`note_drafts/${f}`);
    const free = renderDraftFree(s, { isPaid: f !== "LEAD_MAGNET_CHEAT_SHEET.md" });
    assert.ok(free, `${f}: 無料部分を描画できない`);
    assert.deepEqual(noteTextIssues(noteHtmlText(free)), [], f);
    assert.ok(!hasNoteTextIssue(s), f);
  }
});

test("[E] の置き換え計画: 段落の数が同じなら違う段落だけを原稿の段落に丸ごと置き換える（規則に無い書き方も直る）", () => {
  const live = normBlocks(["概要", "なぜ今、世界中で爆発的に注目されているのか？", "コピペで本番運用できる設定", INVOICE]);
  const want = normBlocks(["概要", "なぜ今、注目されているのか？", "公式READMEに基づく導入手順（動作未検証の例を含む）", RECEIPT]);
  assert.deepEqual(planFreePartReplace(live, want), { action: "replace", changes: [1, 2, 3] });
  // 書式・空白・全角半角の違いだけなら置き換えない
  assert.deepEqual(planFreePartReplace(normBlocks(["概要 ", "Ａ B"]), normBlocks(["概要", "AB"])), { action: "same" });
});

test("[E] の置き換え計画: 段落の数が違う（有料ラインの位置・構成が原稿と違う）・どちらかが空なら自動では置き換えない", () => {
  const short = planFreePartReplace(normBlocks(["概要", "本文"]), normBlocks(["概要", "本文", "続き"]));
  assert.equal(short.action, "manual");
  assert.match(short.reason, /段落の数が原稿と違います（公開中 2 \/ 原稿 3/);
  assert.equal(planFreePartReplace([], normBlocks(["a"])).action, "manual");
  assert.equal(planFreePartReplace(normBlocks(["a"]), []).action, "manual");
});

test("note の本文（HTML）は、太字の区切りを外し、段落の区切りを改行にしてから検出する", () => {
  const html = `<h2>概要</h2><blockquote><p>※noteは購入後、マイページより<strong>インボイス対応領収書</strong>が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。</p></blockquote><p>A &amp; B<br>C</p>`;
  assert.equal(noteHtmlText(html), `概要\n${INVOICE}\n\nA & B\nC\n`);
  assert.deepEqual(noteTextIssues(noteHtmlText(html)), [issueOf("invoice")]);
});

test("[E] で直す記事: 1 回の上限は 12 本で、残りの本数を返す。段落の構成が違う記事は編集画面を開かずに手作業に回す", () => {
  assert.equal(NOTE_FIX_MAX, 12);
  const notes = Array.from({ length: 15 }, (_, i) => ({ slug: `s${i}`, key: `n${i}`, plan: i === 0 ? { action: "same" } : { action: "replace", changes: [2] } }));
  notes.push({ slug: "odd", key: "nodd", plan: { action: "manual", reason: "段落の数が違う" } });
  const plan = planFreePartFixes(notes);
  assert.equal(plan.fix.length, 12);
  assert.deepEqual(plan.fix[0], { slug: "s1", key: "n1", changes: [2] });
  assert.equal(plan.remaining, 2);
  assert.deepEqual(plan.manual, [{ slug: "odd", reason: "段落の数が違う" }]);
  assert.deepEqual(planFreePartFixes(notes, 20).remaining, 0);
  assert.deepEqual(planFreePartFixes([{ slug: "a", key: "na", plan: { action: "same" } }]), { fix: [], remaining: 0, manual: [] });
});

test("[E] の修正は直近 24 時間で 12 本まで（続けて [E] を押しても上限を超えない）。0 本なら次に直せる時刻を返す", () => {
  const now = Date.parse("2026-10-21T12:00:00Z");
  const at = (h) => ({ at: new Date(now - h * 3600 * 1000).toISOString(), slug: "s" });
  assert.deepEqual(noteFixBudget([], now), { left: 12, used: 0, nextAt: null });
  assert.equal(noteFixBudget(Array.from({ length: 5 }, () => at(1)), now).left, 7);
  // 24 時間より前の記録・壊れた記録は数えない
  assert.equal(noteFixBudget([at(25), at(30), { at: "x" }, null, ...Array.from({ length: 3 }, () => at(2))], now).left, 9);
  // 12 本使い切ったら 0 本。いちばん古い記録（23 時間前）が 24 時間を過ぎる 1 時間後から直せる
  const full = [at(23), ...Array.from({ length: 11 }, () => at(1))];
  assert.deepEqual(noteFixBudget(full, now), { left: 0, used: 12, nextAt: "2026-10-21T13:00:00.000Z" });
  assert.equal(noteFixBudget(full, Date.parse("2026-10-21T13:00:01Z")).left, 1);
  assert.equal(NOTE_FIX_WINDOW_MS, 24 * 3600 * 1000);
  // 記録したときに時計が進んでいた（今より後の時刻の記録）も数える。数えないと時計を合わせ直しただけで上限を超えて直せる。
  // 今に寄せて数えるので、次に直せる時刻は今から 24 時間以内
  const ahead = Array.from({ length: 12 }, (_, i) => ({ at: new Date(now + (2 + i) * 3600 * 1000).toISOString(), slug: "s" }));
  assert.deepEqual(noteFixBudget(ahead, now), { left: 0, used: 12, nextAt: "2026-10-22T12:00:00.000Z" });
  assert.equal(noteFixBudget([{ at: "2099-01-01T00:00:00.000Z" }], now).left, 11);
  // ランチャーは「次の [E] ですぐ直す」とは案内しない
  const src = readText("scripts/launcher.mjs");
  assert.doesNotMatch(src, /1回に\$\{NOTE_FIX_MAX\}本まで。残りは次の \[E\] で/);
  assert.match(src, /24時間に\$\{NOTE_FIX_MAX\}本まで/);
});

test("[E] は全文を読んでから直す記事を決め、記事の間を約 20 秒あけ、上限 NOTE_FIX_MAX を使う", () => {
  const src = readText("scripts/note_browser.mjs");
  assert.match(src, /const live = await noteBody\(page, t\.key\);/);
  // 本数の上限は直近 24 時間で数え（オーナー端末の記録。読めなければ 0 本）、「更新する」を押す直前に記録する
  assert.match(src, /const budget = history\.error \? \{ left: 0, used: null, nextAt: null \} : noteFixBudget\(history\.entries, Date\.now\(\), max\);/);
  assert.match(src, /const max = Math\.min\(NOTE_FIX_MAX, /);
  assert.match(src, /for \(let i = 0; i < plan\.fix\.length && published < budget\.left; i\+\+\)/);
  assert.match(src, /const onUpdate = \(\) => \{\n\s*recordFix\(t\.slug\);\n\s*published\+\+;/);
  assert.match(src, /if \(onUpdate\) onUpdate\(\);\n\s*steps\.push\(\{ at: "update-click" \}\);\n\s*await update\.click\(\);/);
  assert.match(src, /if \(i > 0\) await pause\(20000\);/);
  // 押す候補は「更新する」だけ（「投稿する」は公開されていない記事の新規出品になる）
  assert.doesNotMatch(src, /hasText: \/\^\\s\*\(更新する\|投稿する\)/);
  // 有料ラインの位置を変えるボタンは押さない（押すのは「公開に進む」「有料エリア設定」「更新する」だけ）
  assert.doesNotMatch(src, /ラインをこの場所に変更/);
});

test("CI の検査: インボイス対応領収書・「コピペで本番〜」・誇張・古い成熟度の表現を、書き方によらず名前を付けて記録する", () => {
  const issues = publishedNoteIssues({ name: "海外急上昇OSS「x」解説", body: `<ul><li><p>コピペで本番一発起動できる「キット」</p></li></ul><blockquote><p>${INVOICE}</p></blockquote>` });
  // 「一発起動」は生成時に禁止した誇張（HYPE_RULES）でもある
  assert.deepEqual(issues, [issueOf("invoice"), issueOf("copipe"), issueOf("hype")]);
  assert.match(issueOf("invoice"), /インボイス発行事業者に未登録/);
  // 古い成熟度の表現は、これまでと同じ文言（[U] の wording の判定と、記録済みの note_status.json と合わせる）
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>ThoughtWorksでは</p>" }), ["第三者（ThoughtWorks）の評価のような表現"]);
  // 以前は規則に無い書き方を「[E] では直せない書き方」として別扱いにし、決まった言い回し以外の「爆発的」は検出しなかった
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>インボイス対応領収書は別の書き方で案内</p>" }), [issueOf("invoice")]);
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>コピペで本番運用できる設定</p>" }), [issueOf("copipe")]);
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>需要が爆発的に伸びた</p>" }), [issueOf("hype")]);
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>普通の本文</p>" }), []);
  // [E] で直せるかは、表現の名前ではなく CI の判定（置き換えた後に問題が残らない: maintainFixes）で決める
  assert.equal(autoFixableByMaintain({ issues, maintainFixes: true }), true);
  assert.equal(autoFixableByMaintain({ issues }), false);
  assert.equal(autoFixableByMaintain({ issues: [], maintainFixes: true }), false);
});

test("[U] の一覧: [E] で直せる記事（maintainFixes）は出さず、古い成熟度の表現だけの記事は語の置き換えとして出し続ける", () => {
  const st = {
    checkedAt: "2026-10-21T08:00:00.000Z",
    notes: {
      invoice: { issues: [issueOf("invoice")], maintainFixes: true },
      mixed: { issues: [issueOf("invoice"), issueOf("copipe"), "第三者（ThoughtWorks）の評価のような表現"], maintainFixes: true },
      ring: { issues: ["第三者（ThoughtWorks）の評価のような表現"], excerpt: '1a">これらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。' },
      claim: { issues: [issueOf("invoice"), "根拠のない誇張 (\"ドル箱\")"], maintainFixes: false },
      paid: { issues: ["有料ラインが原稿の位置より下（有料部分が無料で読める可能性）"] },
      ok: { issues: [] },
    },
  };
  const items = statusUpdateItems(st, {});
  assert.deepEqual(items.map((i) => [i.slug, i.action]), [["ring", "wording"], ["claim", "replace"], ["paid", "replace"]]);
  assert.equal(items[0].words, "ThoughtWorks");
  // 見出し: [E] で直す記事と、差し替えが必要な記事を分けて数える
  assert.deepEqual(noteIssueCounts(st), { auto: 2, other: 3 });
  // [E] が CI の確認より後に直した記事は、次の確認まで数えない・出さない
  const log = { at: "2026-10-21T09:00:00.000Z", result: { wording: { fixed: ["invoice", "ring"] } } };
  assert.deepEqual(noteIssueCounts(st, log), { auto: 1, other: 3 });
  assert.deepEqual(statusUpdateItems(st, {}, { log }).map((i) => i.slug), ["claim", "paid"]);
  const oldLog = { ...log, at: "2026-10-21T07:00:00.000Z" };
  assert.deepEqual(noteIssueCounts(st, oldLog), { auto: 2, other: 3 });
  // オーナーが差し替えた記録（CI の確認より後）と、既に一覧にある記事は重ねない
  assert.deepEqual(statusUpdateItems(st, { claim: { noteUpdatedAt: "2026-10-21T08:30:00.000Z" } }, { listed: new Set(["paid"]) }).map((i) => i.slug), ["ring"]);
});

test("ランチャーの [U] は CI の結果を statusUpdateItems で振り分け、見出しに [E] の自動修正の本数を出す", () => {
  const src = readText("scripts/launcher.mjs");
  const pending = src.match(/function getPendingNoteUpdates\(\) \{[\s\S]*?\n\}/)[0];
  assert.match(pending, /statusUpdateItems\(st, history,/);
  assert.doesNotMatch(pending, /action: 'replace', reason: `公開中の note に問題があります/);
  assert.match(src, /要修正の表現 \$\{counts\.auto\} 本（\[E\] で自動修正）/);
});

test("note の新規出品は 1日1本・直近7日で3本まで（publish_history の noteAt で数える）", () => {
  const now = new Date("2026-10-21T05:00:00Z");
  assert.equal(noteListingBlock({}, now), null);
  assert.equal(noteListingBlock({ a: { note: true, noteAt: "2026-10-14" }, b: { note: true, noteAt: "2026-10-20" } }, now), null);
  // 今日すでに 1 本
  const today = noteListingBlock({ a: { note: true, noteAt: "2026-10-21" } }, now);
  assert.match(today, /note の機械的な大量投稿対策で、新規出品は1日1本・週3本まで/);
  assert.match(today, /今日はすでに 1 本/);
  // 直近 7 日（今日を含む 10/15〜10/21）で 3 本。7 日前（10/14）は数えない
  const week = { a: { noteAt: "2026-10-15" }, b: { noteAt: "2026-10-17" }, c: { noteAt: "2026-10-20" }, d: { noteAt: "2026-10-14" } };
  const w = noteListingBlock(week, now);
  assert.match(w, /直近7日間で 3 本/);
  assert.match(w, /次は 2026-10-22 から/, "10/15 の分が 7 日間の外に出る日");
  assert.equal(noteListingBlock({ ...week, a: { noteAt: "2026-10-14" } }, now), null);
  // 日付でない値・記録の無い記事・未来の日付は数えない
  assert.equal(noteListingBlock({ a: { note: true }, b: { noteAt: "x" }, c: { noteAt: "2026-10-30" }, d: null }, now), null);
  // 今日の日付は記録と同じ日本時間で決める（日本時間 0 時 = UTC 15 時に日付が変わる）
  assert.match(noteListingBlock({ a: { noteAt: "2026-10-21" } }, new Date("2026-10-21T14:59:00Z")), /今日はすでに/);
  assert.equal(noteListingBlock({ a: { noteAt: "2026-10-21" } }, new Date("2026-10-21T15:00:00Z")), null);
  // 日本時間 8:30 に出品（記録は日本時間の 10/22）→ 9:30 にはもう出せない（UTC で数えると 9 時に日付が変わって 2 本目を出せてしまう）
  const listedAt = new Date("2026-10-21T23:30:00Z");
  assert.equal(jstDay(listedAt.getTime()), "2026-10-22");
  assert.match(noteListingBlock({ a: { noteAt: jstDay(listedAt.getTime()) } }, new Date("2026-10-22T00:30:00Z")), /今日はすでに 1 本/);
  // 日本時間 23:00 の出品は、翌朝 8:00 の出品を止めない
  const night = new Date("2026-10-21T14:00:00Z");
  assert.equal(noteListingBlock({ a: { noteAt: jstDay(night.getTime()) } }, new Date("2026-10-21T23:00:00Z")), null);
  // ランチャーの記録も日本時間の日付
  const src = readText("scripts/launcher.mjs");
  assert.match(src.match(/function recordPublish\([\s\S]*?\n\}/)[0], /const todayStr = jstDay\(\);/);
});

test("ランチャーで note の新規出品を記録する流れは、すべて出品の上限を先に確かめる（X の投稿は止めない）", () => {
  const src = readText("scripts/launcher.mjs");
  const fns = src.split(/\n(?=function )/).filter((f) => /recordPublish\([^)]*'note'\)/.test(f));
  assert.deepEqual(fns.map((f) => f.match(/^function (\w+)/)[1]).sort(), ["runAllInOnePublish", "runLeadMagnetPublish", "runPublishHelper"]);
  for (const f of fns) {
    const name = f.match(/^function (\w+)/)[1];
    assert.ok(f.indexOf("noteListingRefused()") !== -1 && f.indexOf("noteListingRefused()") < f.indexOf("notes/new"), `${name}: 出品画面を開く前に上限を確かめる`);
  }
  // 出品履歴が壊れて読めないときは、本数が分からないので出品させない（空として数えると上限が効かない）
  assert.match(src, /function noteListingRefused\(\) \{\n  const why = historyUnreadable\(\)\n    \? '[^']+'\n    : noteListingBlock\(loadHistory\(\)\);/);
  // [A] は note を飛ばしても X の手順を続ける
  assert.match(fns.find((f) => f.startsWith("function runAllInOnePublish")), /!target\.isNotePosted && !noteBlocked && ans/);
  assert.match(src, /recordPublish\(target\.slug, 'x'\)/);
});
