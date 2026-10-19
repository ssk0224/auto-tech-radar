// 修正前の生成スクリプトが作った形式の原稿が、移行スクリプトで現在の形式に揃うこと
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { zennCta } from "../scripts/utils/funnel_copy.mjs";
import { isSealed } from "../scripts/utils/note_vault.mjs";
import { findProLeaks } from "../scripts/utils/pro_boundary.mjs";

const root = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".astro"]);

test("旧形式の note / Web / Zenn 原稿を移行できる", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-migrate-"));
  try {
    fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
    fs.writeFileSync(path.join(dir, "note_drafts/legacy_note.md"),
      "# 旧\n無料。経費精算。\n---\n【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】\n---\n## 有料 LEGACY_SECRET\n---\n**【note出品時用 推奨ハッシュタグ】**\n#AI #OSS\n");
    fs.writeFileSync(path.join(dir, "src/pages/radar/legacy.md"),
      "---\ntitle: \"legacy\"\n---\n# legacy\n無料\n\n---\n\n## 🛠️ 【Auto Tech Radar PRO限定】商用化マニュアル ＆ 実務キット\nLEGACY_SECRET\n");
    fs.writeFileSync(path.join(dir, "articles/legacy-tech-radar.md"),
      "---\ntitle: \"t\"\n---\n本文\n\n---\n\n## 🔒 【続き】ビジネス・マネタイズ実践・本番Docker・社内DX提案書\nこれ以降の：\n- 項目\n\nは、専門メディア「Auto Tech Radar」にて完全公開されています。\n\n👉 **[【続きを読む】Auto Tech Radar 公式レポートで今すぐアンロックする（一部PRO限定） →](https://ssk0224.github.io/auto-tech-radar/radar/legacy/)**\n\n---\n\n### 🧭 あわせて読みたい\n- 関連\n");
    const r = spawnSync(process.execPath, ["scripts/migrate_legacy_content.mjs"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const note = fs.readFileSync(path.join(dir, "note_drafts/legacy_note.md"), "utf8");
    assert.ok(isSealed(note) && !note.includes("LEGACY_SECRET"));
    assert.deepEqual(findProLeaks(fs.readFileSync(path.join(dir, "src/pages/radar/legacy.md"), "utf8")), []);
    const z = fs.readFileSync(path.join(dir, "articles/legacy-tech-radar.md"), "utf8");
    assert.ok(z.includes(zennCta("legacy").trimEnd()) && !z.includes("アンロック") && z.includes("あわせて読みたい"));
    // 2 回目は何も変えない
    const again = spawnSync(process.execPath, ["scripts/migrate_legacy_content.mjs"], { cwd: dir, encoding: "utf8" });
    assert.match(again.stdout, /note 0 本 \/ Web 0 本 \/ Zenn 0 本/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
