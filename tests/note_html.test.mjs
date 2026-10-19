import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { parseDraftToNotePayload } from "../scripts/utils/note_html.mjs";
import { assembleNote, loadPrivateKeys, noteDir } from "../scripts/utils/note_vault.mjs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";

test("note_html: Markdownの表・インラインコード・Mermaid・有料境界・末尾ハッシュタグをnote.com互換HTMLに正しく変換する", () => {
  let keys = [];
  try {
    keys = loadPrivateKeys();
  } catch {}

  const cheatPath = path.join(noteDir, "LEAD_MAGNET_CHEAT_SHEET.md");
  const cheatRes = parseDraftToNotePayload(fs.readFileSync(cheatPath, "utf8"), false);
  assert.ok(!cheatRes.title.startsWith("#"), "タイトルに先頭の # が残らないこと");
  assert.ok(!/\|---|\|:---/.test(cheatRes.fullBody), "Markdownの表がそのまま残らないこと");
  assert.ok(cheatRes.fullBody.includes("<ul"), "表が箇条書き <ul> に変換されること");

  if (keys.length === 0) return;

  const files = fs
    .readdirSync(noteDir)
    .filter((f) => f.endsWith("_note.md") && !isNoise(f.replace("_note.md", "")));
  assert.equal(files.length, 36, "非ノイズの有料原稿が36本揃っていること");

  for (const file of files) {
    const fullMd = assembleNote(path.join(noteDir, file), keys);
    const res = parseDraftToNotePayload(fullMd, true);
    const nonPre = res.fullBody.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, "");

    assert.ok(res.title.length > 10 && !res.title.startsWith("#"), `${file}: タイトル形式が正しいこと`);
    assert.ok(res.freeBody.length > 200, `${file}: freeBody が存在すること`);
    assert.ok(res.payBody.length > 500, `${file}: payBody が存在すること`);
    assert.ok(res.separator && res.freeBody.includes(`id="${res.separator}"`), `${file}: separator が freeBody 末尾要素を指すこと`);
    assert.ok(!/\|---|\|:---/.test(nonPre), `${file}: Markdown表の区切り線 (|---|) が残らないこと`);
    assert.ok(!/`/.test(nonPre), `${file}: 未変換のバッククォートが残らないこと`);
    assert.ok(!/!\[/.test(nonPre), `${file}: 未変換の画像記法 ![](...) が残らないこと`);
    assert.ok(!/(flowchart|graph)\s+TD/.test(res.fullBody), `${file}: 生のMermaid構文が残らないこと`);
    assert.ok(!/推奨ハッシュタグ/.test(res.fullBody), `${file}: 末尾の出品用ハッシュタグ注記が本文に残らないこと`);
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
