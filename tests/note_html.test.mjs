import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { parseDraftToNotePayload } from "../scripts/utils/note_html.mjs";
import { assembleNote, noteDir } from "../scripts/utils/note_vault.mjs";
import { notePayloadProblems, privateKeysIfPresent } from "../scripts/utils/owner_checks.mjs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";
import { noPrivateKey } from "./helpers/skips.mjs";

test("note_html: リードマグネット（無料）の表を箇条書きに変換し、タイトルに # を残さない", () => {
  const cheatPath = path.join(noteDir, "LEAD_MAGNET_CHEAT_SHEET.md");
  const cheatRes = parseDraftToNotePayload(fs.readFileSync(cheatPath, "utf8"), false);
  assert.ok(!cheatRes.title.startsWith("#"), "タイトルに先頭の # が残らないこと");
  assert.ok(!/\|---|\|:---/.test(cheatRes.fullBody), "Markdownの表がそのまま残らないこと");
  assert.ok(cheatRes.fullBody.includes("<ul"), "表が箇条書き <ul> に変換されること");
});

// 本数は固定値で持たない（毎日の生成で増えるため、固定値は owner PC でだけ赤になり、その後ろの検査を止めていた）。
// 揃っているべきもの: 非ノイズの原稿はすべて有料部分が暗号化されている／note に公開済みの非ノイズ記事はすべて原稿がある
test("note_html: 非ノイズの有料原稿がすべて揃い、復号した全文が note.com 互換 HTML に正しく変換される", (t) => {
  const keys = privateKeysIfPresent();
  // 秘密鍵の無い環境（CI）では「合格」ではなく「未実施」と表示する（黙って return すると合格に見える）
  if (keys.length === 0) return t.skip(noPrivateKey());

  const slug = (f) => f.replace(/_note\.(md|paid\.enc)$/, "");
  const drafts = fs.readdirSync(noteDir).filter((f) => f.endsWith("_note.md") && !isNoise(slug(f)));
  const sealed = fs.readdirSync(noteDir).filter((f) => f.endsWith("_note.paid.enc") && !isNoise(slug(f)));
  assert.deepEqual(drafts.map(slug).sort(), sealed.map(slug).sort(), "非ノイズの原稿と暗号化された有料部分が 1 対 1 で揃っていること");
  const noteUrls = JSON.parse(fs.readFileSync(path.join(noteDir, "..", "scripts", "note_urls.json"), "utf8"));
  const published = Object.keys(noteUrls).filter((s) => s !== "LEAD_MAGNET_CHEAT_SHEET" && !isNoise(s));
  assert.deepEqual(published.filter((s) => !drafts.includes(`${s}_note.md`)), [], "note に公開済みの記事はすべて原稿があること");
  assert.ok(drafts.length > 0);

  for (const file of drafts) {
    const fullMd = assembleNote(path.join(noteDir, file), keys);
    assert.deepEqual(notePayloadProblems(fullMd), [], file);
  }
});

test("note_html: エスケープされたパイプやインラインコード内のパイプを含む表を正しく分解できる", () => {
  const sample = `# テスト記事

| 項目 | 説明 | 備考 |
|---|---|---|
| コマンド | \`cat file \\| grep text\` | パイプ連結 |
| 記号 | A \\| B | エスケープ記号 |
`;
  const res = parseDraftToNotePayload(sample, false);
  assert.ok(!res.fullBody.includes("|---|"), "デリミタ行が残らないこと");
  assert.ok(res.fullBody.includes("<code>cat file | grep text</code>"), "コード内パイプがそのまま維持されること");
  assert.ok(res.fullBody.includes("A | B"), "エスケープされたパイプが1つのセル内で維持されること");
});
