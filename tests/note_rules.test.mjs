// 公開中の note の要修正の表現（[E] の自動修正・CI の検査・[U] の一覧）と、note の新規出品の上限を確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  NOTE_TEXT_RULES,
  NOTE_FIX_MAX,
  NEW_RING_WORDS,
  applicableNoteRules,
  applyNoteRules,
  hasNoteTextIssue,
  noteHtmlText,
  planNoteFixes,
  statusUpdateItems,
  noteIssueCounts,
  autoFixableByMaintain,
} from "../scripts/utils/note_pending.mjs";
import { publishedNoteIssues } from "../scripts/sync_note_urls.mjs";
import { noteListingBlock } from "../scripts/utils/note_listing.mjs";

const INVOICE = "※noteは購入後、マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。";
const issueOf = (id) => NOTE_TEXT_RULES.find((r) => r.id === id).issue;

test("規則表: どの規則も from が detect に当たり、置き換え後の to はどの detect にも当たらない", () => {
  for (const r of NOTE_TEXT_RULES) {
    assert.deepEqual(Object.keys(r).sort(), ["detect", "from", "id", "issue", "to"], r.id);
    assert.ok(r.detect.test(r.from), r.id);
    assert.ok(!hasNoteTextIssue(r.to), r.id);
    assert.ok(!/ThoughtWorks|インボイス|コピペ/.test(r.to), r.id);
  }
  assert.equal(new Set(NOTE_TEXT_RULES.map((r) => r.id)).size, NOTE_TEXT_RULES.length);
});

test("インボイス対応領収書の案内は、購入・チップ履歴から領収書を発行できる案内に直す（未登録のためインボイス対応とは書かない）", () => {
  assert.deepEqual(applicableNoteRules(INVOICE).map((r) => r.id), ["invoice"], "長い規則だけを当て、短い予備の規則は重ねない");
  assert.equal(applyNoteRules(INVOICE), "※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。");
  // 長い文が段落で分かれていても、インボイスの部分は予備の規則で直す
  const split = "※noteは購入後、マイページよりインボイス対応領収書が即時発行可能です。\n会社の「技術調査費」「自己研鑽費」として経費精算いただけます。";
  assert.deepEqual(applicableNoteRules(split).map((r) => r.id), ["invoice-short"]);
  assert.equal(applyNoteRules(split).split("\n")[0], "※noteは購入後、マイページより領収書を発行できます。");
  assert.ok(!hasNoteTextIssue(applyNoteRules(split)));
});

test("「コピペで本番一発起動」は動作未検証の導入手順として案内し直し、文が崩れないよう「できる」ごと置き換える", () => {
  const line = "- コピペで本番一発起動できる「Docker Compose & .env 設定キット」";
  assert.deepEqual(applicableNoteRules(line).map((r) => r.id), ["copipe-kit"]);
  assert.equal(applyNoteRules(line), "- 公式READMEに基づく導入手順（動作未検証の例を含む）の「Docker Compose & .env 設定キット」");
  assert.equal(applyNoteRules("コピペで本番一発起動"), "公式READMEに基づく導入手順（動作未検証の例を含む）");
});

test("古い成熟度の表現は、これまでどおり途中まで直して残った「ThoughtWorks」も含めて直す（同じ箇所を二重に置き換えない）", () => {
  const text = "🎯 ThoughtWorks成熟度リング判定（ADOPT / TRIAL）\nこれらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。ThoughtWorks成熟度リングでは";
  assert.deepEqual(applicableNoteRules(text).map((r) => r.id), ["ring-judge", "ring", "ring-leftover"]);
  const fixed = applyNoteRules(text);
  assert.equal(fixed, `🎯 ${NEW_RING_WORDS}（ADOPT / TRIAL）\nこれらの状況を鑑み、${NEW_RING_WORDS}では「TRIAL」と判定します。${NEW_RING_WORDS}では`);
  assert.ok(!/🎯\s*🎯/.test(fixed));
  assert.deepEqual(applicableNoteRules("普通の本文"), []);
});

test("note の本文（HTML）は、太字の区切りを外し、段落の区切りを改行にしてから規則を当てる", () => {
  const html = `<h2>概要</h2><blockquote><p>※noteは購入後、マイページより<strong>インボイス対応領収書</strong>が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。</p></blockquote><p>A &amp; B<br>C</p>`;
  assert.equal(noteHtmlText(html), `概要\n${INVOICE}\n\nA & B\nC\n`);
  assert.deepEqual(applicableNoteRules(noteHtmlText(html)).map((r) => r.id), ["invoice"]);
});

test("[E] で直す記事: 1 回の上限は 12 本で、残りの本数を返す。規則で直しきれない書き方は編集画面を開かずに手作業に回す", () => {
  assert.equal(NOTE_FIX_MAX, 12);
  const notes = Array.from({ length: 15 }, (_, i) => ({ slug: `s${i}`, key: `n${i}`, body: i === 0 ? "<p>普通の本文</p>" : `<p>${INVOICE}</p>` }));
  notes.push({ slug: "odd", key: "nodd", body: "<p>インボイス対応領収書は別の書き方で案内</p>" });
  const plan = planNoteFixes(notes);
  assert.equal(plan.fix.length, 12);
  assert.deepEqual(plan.fix[0], { slug: "s1", key: "n1", rules: ["invoice"] });
  assert.equal(plan.remaining, 2);
  assert.deepEqual(plan.manual, ["odd"]);
  assert.deepEqual(planNoteFixes(notes, 20).remaining, 0);
  assert.deepEqual(planNoteFixes([{ slug: "a", key: "na", body: "<p>普通の本文</p>" }]), { fix: [], remaining: 0, manual: [] });
});

test("[E] は全文を読んでから直す記事を決め、記事の間を約 20 秒あけ、上限 NOTE_FIX_MAX を使う", () => {
  const src = fs.readFileSync("scripts/note_browser.mjs", "utf8");
  assert.match(src, /const live = await noteBody\(page, t\.key\);/);
  assert.match(src, /planNoteFixes\(notes, Number\(process\.env\.ATR_NOTE_FIX_MAX\) \|\| NOTE_FIX_MAX\)/);
  assert.match(src, /if \(i > 0\) await pause\(20000\);/);
  // 有料ラインの位置を変えるボタンは押さない（押すのは「公開に進む」「有料エリア設定」「更新する／投稿する」だけ）
  assert.doesNotMatch(src, /ラインをこの場所に変更/);
});

test("CI の検査: インボイス対応領収書と「コピペで本番一発起動」を、規則と同じ文言の問題として記録する", () => {
  const issues = publishedNoteIssues({ name: "海外急上昇OSS「x」解説", body: `<ul><li><p>コピペで本番一発起動できる「キット」</p></li></ul><blockquote><p>${INVOICE}</p></blockquote>` });
  assert.deepEqual(issues, [issueOf("invoice"), issueOf("copipe")]);
  assert.match(issueOf("invoice"), /インボイス発行事業者に未登録/);
  assert.equal(issueOf("invoice"), issueOf("invoice-short"));
  // 古い成熟度の表現は、これまでと同じ文言（[U] の wording の判定と、記録済みの note_status.json と合わせる）
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>ThoughtWorksでは</p>" }), ["第三者（ThoughtWorks）の評価のような表現"]);
  // 規則で直しきれない書き方は [E] の対象と区別する（[U] に回す）
  const odd = publishedNoteIssues({ name: "x", body: "<p>インボイス対応領収書は別の書き方で案内</p>" });
  assert.deepEqual(odd, [`${issueOf("invoice")}（[E] では直せない書き方）`]);
  assert.equal(autoFixableByMaintain({ issues: odd }), false);
  assert.equal(autoFixableByMaintain({ issues: issues }), true);
  assert.deepEqual(publishedNoteIssues({ name: "x", body: "<p>普通の本文</p>" }), []);
});

test("[U] の一覧: [E] で自動修正できる表現だけの記事は出さず、古い成熟度の表現だけの記事は語の置き換えとして出し続ける", () => {
  const st = {
    checkedAt: "2026-10-21T08:00:00.000Z",
    notes: {
      invoice: { issues: [issueOf("invoice")] },
      mixed: { issues: [issueOf("invoice"), issueOf("copipe"), "第三者（ThoughtWorks）の評価のような表現"] },
      ring: { issues: ["第三者（ThoughtWorks）の評価のような表現"], excerpt: '1a">これらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。' },
      claim: { issues: [issueOf("invoice"), "根拠のない誇張 (\"ドル箱\")"] },
      paid: { issues: ["有料ラインが原稿の位置より下（有料部分が無料で読める可能性）"] },
      ok: { issues: [] },
    },
  };
  const items = statusUpdateItems(st, {});
  assert.deepEqual(items.map((i) => [i.slug, i.action]), [["ring", "wording"], ["claim", "replace"], ["paid", "replace"]]);
  assert.equal(items[0].words, "ThoughtWorks");
  // 見出し: [E] で直す記事と、差し替えが必要な記事を分けて数える
  assert.deepEqual(noteIssueCounts(st), { auto: 3, other: 2 });
  // [E] が CI の確認より後に直した記事は、次の確認まで数えない・出さない
  const log = { at: "2026-10-21T09:00:00.000Z", result: { wording: { fixed: ["invoice", "ring"] } } };
  assert.deepEqual(noteIssueCounts(st, log), { auto: 1, other: 2 });
  assert.deepEqual(statusUpdateItems(st, {}, { log }).map((i) => i.slug), ["claim", "paid"]);
  const oldLog = { ...log, at: "2026-10-21T07:00:00.000Z" };
  assert.deepEqual(noteIssueCounts(st, oldLog), { auto: 3, other: 2 });
  // オーナーが差し替えた記録（CI の確認より後）と、既に一覧にある記事は重ねない
  assert.deepEqual(statusUpdateItems(st, { claim: { noteUpdatedAt: "2026-10-21T08:30:00.000Z" } }, { listed: new Set(["paid"]) }).map((i) => i.slug), ["ring"]);
});

test("ランチャーの [U] は CI の結果を statusUpdateItems で振り分け、見出しに [E] の自動修正の本数を出す", () => {
  const src = fs.readFileSync("scripts/launcher.mjs", "utf8");
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
  // 今日の日付は記録と同じ UTC で決める
  assert.match(noteListingBlock({ a: { noteAt: "2026-10-20" } }, new Date("2026-10-20T23:59:00Z")), /今日はすでに/);
  assert.equal(noteListingBlock({ a: { noteAt: "2026-10-20" } }, new Date("2026-10-21T00:00:00Z")), null);
});

test("ランチャーで note の新規出品を記録する流れは、すべて出品の上限を先に確かめる（X の投稿は止めない）", () => {
  const src = fs.readFileSync("scripts/launcher.mjs", "utf8");
  const fns = src.split(/\n(?=function )/).filter((f) => /recordPublish\([^)]*'note'\)/.test(f));
  assert.deepEqual(fns.map((f) => f.match(/^function (\w+)/)[1]).sort(), ["runAllInOnePublish", "runLeadMagnetPublish", "runPublishHelper"]);
  for (const f of fns) {
    const name = f.match(/^function (\w+)/)[1];
    assert.ok(f.indexOf("noteListingRefused()") !== -1 && f.indexOf("noteListingRefused()") < f.indexOf("notes/new"), `${name}: 出品画面を開く前に上限を確かめる`);
  }
  assert.match(src, /function noteListingRefused\(\) \{\n  const why = noteListingBlock\(loadHistory\(\)\);/);
  // [A] は note を飛ばしても X の手順を続ける
  assert.match(fns.find((f) => f.startsWith("function runAllInOnePublish")), /!target\.isNotePosted && !noteBlocked && ans/);
  assert.match(src, /recordPublish\(target\.slug, 'x'\)/);
});
