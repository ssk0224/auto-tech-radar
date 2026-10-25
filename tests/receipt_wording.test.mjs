// 領収書・経費精算の案内が事実どおりであることを確かめる（2026-10-21）。
// 出品者はインボイス発行事業者に登録していないため、適格請求書（インボイス）対応の領収書は発行されない。
// note の領収書は「設定 → 購入・チップ履歴」から発行でき、経費精算の可否は購入者の所属先の規程による
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { normBlocks, noteHtmlText, planFreePartReplace } from "../scripts/utils/note_pending.mjs";
import { freePartVerdict, renderDraftFree } from "../scripts/utils/free_part.mjs";
import { paidLineReport } from "../scripts/sync_note_urls.mjs";
import { RECEIPT_LINE, OLD_RECEIPT_CLAIM, normalizeReceiptLine, receiptProblems } from "../scripts/utils/receipt.mjs";
import { readText } from "./helpers/read_src.mjs";
import { NOTE_PRICE_BOX } from "../scripts/utils/article_template.mjs";

const RECEIPT = "> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。";
const OLD_CLAIM = /インボイス|即時発行可能|経費精算いただけます/;

test("note 原稿の無料部分に、正しい領収書の案内があり、インボイス対応・経費精算できるという断定が無い", () => {
  const files = fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const s = readText(path.join("note_drafts", f));
    assert.doesNotMatch(s, OLD_CLAIM, f);
    assert.ok(s.split(/\r?\n/).includes(RECEIPT), `${f}: 領収書の案内が無い`);
  }
  assert.doesNotMatch(readText("note_drafts/LEAD_MAGNET_CHEAT_SHEET.md"), OLD_CLAIM);
});

test("生成スクリプトの雛形も同じ案内を使い、インボイス対応をうたわない", () => {
  for (const f of ["scripts/crawl_and_generate.mjs", "scripts/utils/note_vault.mjs", "scripts/generate_lead_magnet_note.mjs"]) {
    assert.doesNotMatch(readText(f), OLD_CLAIM, f);
  }
  // note の無料部分は生成スクリプトが決まった形（定型文の領収書の案内を含む価格の案内）で作る（leakhunt C3、2026-10-22）
  assert.ok(NOTE_PRICE_BOX.split("\n").includes(RECEIPT));
  // 生成スクリプトは原稿全体を renderNoteDraft（無料部分は renderNoteHead、末尾は noteFooter）で作る
  assert.match(readText("scripts/crawl_and_generate.mjs"), /renderNoteDraft\(/);
});

test("[E] が公開中の note の古い案内を原稿の描画に置き換えた後は、CI の比較で原稿と同じになり、有料ラインの位置（endPct）も一致する", () => {
  // 公開中の記事に古い案内（インボイス対応・経費精算いただけます）が残っている形を、原稿の描画から作る
  const draft = readText("note_drafts/aihot_note.md");
  const free = renderDraftFree(draft);
  const stale = free.replace("「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。", "マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。");
  assert.notEqual(stale, free);
  const before = freePartVerdict(stale, draft);
  assert.equal(before.status, "bad");
  assert.equal(before.kind, "text");
  // 置き換えの計画: 段落の数は原稿と同じで、案内の段落だけを原稿の段落に置き換える
  const blocks = (h) => normBlocks(noteHtmlText(h).split("\n"));
  const plan = planFreePartReplace(blocks(stale), blocks(free));
  assert.equal(plan.action, "replace");
  assert.equal(plan.changes.length, 1);
  // 置き換えた後（＝原稿の描画）は CI の比較で ok、有料ラインの位置も原稿どおり
  assert.equal(freePartVerdict(free, draft).status, "ok");
  assert.equal(paidLineReport(free, draft).endPct, 100);
});

test("生成した原稿の領収書の案内は定型文にそろえ、そろえられない原稿は生成スクリプトが採用しない（CI のテストで落とさない）", () => {
  assert.equal(RECEIPT_LINE, RECEIPT);
  assert.equal(String(OLD_RECEIPT_CLAIM), String(OLD_CLAIM));
  const doc = (receipt, extra = "") =>
    ["# t", `無料の導入。${extra}`, "> 💡 **【経費精算について】**", receipt, "", "【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】", "## 有料", "本文", "---", "**【note出品時用 推奨ハッシュタグ】**", "#AI #OSS"].join("\n");
  // 生成モデルが言い回しを少し変えた案内（「> 」が無い・語尾が違う・古い案内のまま）は定型文に直す
  for (const variant of ["> ※noteは購入後、マイページから領収書を発行できます。", "※ noteでは購入後に領収書を発行できます", "> ※noteは購入後、マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」として経費精算いただけます。"]) {
    const out = normalizeReceiptLine(doc(variant));
    assert.ok(out.split("\n").includes(RECEIPT), variant);
    assert.deepEqual(receiptProblems(out), [], variant);
  }
  // 定型文があればそのまま
  assert.equal(normalizeReceiptLine(doc(RECEIPT)), doc(RECEIPT));
  // 案内が無い・無料部分の別の箇所でインボイス対応をうたう原稿は採用しない
  assert.match(receiptProblems(normalizeReceiptLine(doc("経費精算にも使えます。"))).join(), /定型文/);
  assert.match(receiptProblems(normalizeReceiptLine(doc("> ※領収書は発行できます", "インボイス制度対応の請求書も作れます。"))).join(), /断定/);
  // 有料ラインより後の行は書き換えない
  const paidOnly = ["# t", "無料", "【有料ライン ここから先は有料会員限定】", "※購入者向けの領収書の注意"].join("\n");
  assert.equal(normalizeReceiptLine(paidOnly), paidOnly);
  // 生成スクリプトは保存前に、そろえてから検査する
  const src = readText("scripts/crawl_and_generate.mjs");
  assert.match(src, /const noteText = normalizeReceiptLine\(/);
  assert.match(src, /\.\.\.receiptProblems\(noteText\)/);
});
