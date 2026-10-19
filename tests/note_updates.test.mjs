// note 公開済み記事の差し替えリスト（scripts/note_updates.json）が実データと食い違っていないことを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";

test("差し替えリストは note 公開済みの全記事を含み、ノイズ記事だけを非公開にする", () => {
  const spec = JSON.parse(fs.readFileSync("scripts/note_updates.json", "utf8"));
  const history = JSON.parse(fs.readFileSync("scripts/publish_history.json", "utf8"));
  assert.match(spec.since, /^\d{4}-\d{2}-\d{2}$/);
  for (const [slug, v] of Object.entries(history)) {
    if (v.note && v.noteAt <= spec.since) assert.ok(spec.items[slug], `${slug}: 公開済みなのにリストに無い`);
  }
  for (const [slug, item] of Object.entries(spec.items)) {
    assert.ok(history[slug]?.note, `${slug}: note に公開されていない`);
    assert.ok(fs.existsSync(`note_drafts/${slug}_note.md`), `${slug}: 原稿が無い`);
    assert.equal(item.action, isNoise(slug) ? "unpublish" : "replace", slug);
  }
});
