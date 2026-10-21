// note の見出し画像（アイキャッチ）: 対象の選び方・画像サイズ・ブラウザ側スクリプトの要件
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import sharp from "sharp";
import { buildEyecatchTasks } from "../scripts/note_api_server.mjs";
import { eyecatchPng, EYECATCH_WIDTH, EYECATCH_HEIGHT } from "../scripts/utils/eyecatch.mjs";

test("見出し画像の対象は URL の分かる公開済み記事だけで、ノイズ記事を含まない", () => {
  const tasks = buildEyecatchTasks({
    zcode: { url: "https://note.com/x/n/nabc123" },
    "homebrew-core": { url: "https://note.com/x/n/ndef456" },
    broken: { url: "https://note.com/x" },
  });
  assert.deepEqual(tasks, [{ slug: "zcode", key: "nabc123", width: 1280, height: 670 }]);
});

test("note_urls.json の全記事に、note 推奨サイズ 1280x670 の見出し画像を作れる", async () => {
  const tasks = buildEyecatchTasks(JSON.parse(fs.readFileSync("scripts/note_urls.json", "utf8")));
  assert.ok(tasks.length > 0);
  for (const t of tasks) {
    assert.ok(fs.existsSync(`public/ogp/${t.slug}.png`), `${t.slug}: OGP 画像が無い（共通画像で代用される）`);
    const m = await sharp(await eyecatchPng(t.slug)).metadata();
    assert.deepEqual([m.width, m.height, m.format], [EYECATCH_WIDTH, EYECATCH_HEIGHT, "png"], t.slug);
  }
});

test("ブラウザ側スクリプトは型付き画像で送り、反映を読み直して確認する", () => {
  const js = fs.readFileSync("scripts/browser/note_eyecatch.js", "utf8");
  assert.match(js, /\/api\/v1\/image_upload\/note_eyecatch/);
  assert.match(js, /type: "image\/png"/);
  assert.match(js, /X-XSRF-TOKEN/);
  assert.match(js, /const after = await noteInfo/);
  assert.match(js, /if \(info\.eyecatch\)/, "設定済みの見出し画像を上書きしない");
});
