// 画像・リードマグネットの生成物とその生成スクリプトに、根拠のない数値や誇張が戻らないことを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

import { FORBIDDEN } from "../scripts/utils/claims_check.mjs";

test("OGP 画像・リードマグネット・README・サイトページとその生成スクリプトに禁止表現が無い", () => {
  const files = [
    "README.md",
    "scripts/note_urls.json",
    "scripts/launcher.mjs",
    "scripts/publish_helper.mjs",
    "src/layouts/Layout.astro",
    "public/og-card.svg",
    "scripts/generate_og_cards.mjs",
    "scripts/generate_lead_magnet_note.mjs",
    "note_drafts/LEAD_MAGNET_CHEAT_SHEET.md",
    ...fs.readdirSync("src/pages").filter((f) => f.endsWith(".astro")).map((f) => path.join("src/pages", f)),
    ...fs.readdirSync("public/ogp").filter((f) => f.endsWith(".svg")).map((f) => path.join("public/ogp", f)),
    ...fs.readdirSync("note_drafts").filter((f) => f.endsWith(".md")).map((f) => path.join("note_drafts", f)),
  ];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const s = fs.readFileSync(f, "utf8");
    for (const [re, why] of FORBIDDEN) assert.ok(!re.test(s), `${f}: ${why} (${s.match(re)?.[0]})`);
  }
});

test("収益の誇張の検査は、技術的な数量（リクエスト数・ダウンロード数）を誤検出しない", async () => {
  const { findForbiddenClaims } = await import("../scripts/utils/claims_check.mjs");
  for (const ok of ["月100万リクエストを処理", "毎月5万ダウンロード", "月間10万PV"]) assert.deepEqual(findForbiddenClaims(ok), [], ok);
  for (const ng of ["月収100万", "月100万円稼げる", "月50万円の収入"]) assert.ok(findForbiddenClaims(ng).length > 0, ng);
});
