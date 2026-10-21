// 領収書・経費精算の案内が事実どおりであることを確かめる（2026-10-21）。
// 出品者はインボイス発行事業者に登録していないため、適格請求書（インボイス）対応の領収書は発行されない。
// note の領収書は「設定 → 購入・チップ履歴」から発行でき、経費精算の可否は購入者の所属先の規程による
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { NOTE_TEXT_RULES, applyNoteRules } from "../scripts/utils/note_pending.mjs";
import { paidLineReport } from "../scripts/sync_note_urls.mjs";

const RECEIPT = "> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。";
const OLD_CLAIM = /インボイス|即時発行可能|経費精算いただけます/;

test("note 原稿の無料部分に、正しい領収書の案内があり、インボイス対応・経費精算できるという断定が無い", () => {
  const files = fs.readdirSync("note_drafts").filter((f) => f.endsWith("_note.md"));
  assert.ok(files.length > 0);
  for (const f of files) {
    const s = fs.readFileSync(path.join("note_drafts", f), "utf8");
    assert.doesNotMatch(s, OLD_CLAIM, f);
    assert.ok(s.split(/\r?\n/).includes(RECEIPT), `${f}: 領収書の案内が無い`);
  }
  assert.doesNotMatch(fs.readFileSync("note_drafts/LEAD_MAGNET_CHEAT_SHEET.md", "utf8"), OLD_CLAIM);
});

test("生成スクリプトの雛形も同じ案内を使い、インボイス対応をうたわない", () => {
  for (const f of ["scripts/crawl_and_generate.mjs", "scripts/utils/note_vault.mjs", "scripts/generate_lead_magnet_note.mjs"]) {
    assert.doesNotMatch(fs.readFileSync(f, "utf8"), OLD_CLAIM, f);
  }
  assert.ok(fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8").split("\n").includes(RECEIPT));
});

test("[E] が公開中の note で直した後の案内は原稿の案内と同じ文になり、CI の原稿との比較（endPct）が一致する", () => {
  // 公開中の記事の古い案内は「※noteは購入後、」に [E] の規則の from が続く形。[E] は from だけを to に置き換える
  const invoice = NOTE_TEXT_RULES.find((r) => r.id === "invoice");
  const oldLine = `> ※noteは購入後、${invoice.from}`;
  assert.equal(applyNoteRules(oldLine), RECEIPT);
  // 案内は無料部分の最後の行なので、ここがずれると CI の paidLineReport が有料ラインの位置を読めなくなる（endPct が null）
  const draft = fs.readFileSync("note_drafts/aihot_note.md", "utf8");
  const lines = draft.split(/\r?\n/);
  const at = lines.indexOf(RECEIPT);
  assert.ok(at > 0);
  const liveAfterFix = applyNoteRules([...lines.slice(0, at), oldLine].join("\n"));
  assert.equal(paidLineReport(liveAfterFix, draft).endPct, 100);
});
