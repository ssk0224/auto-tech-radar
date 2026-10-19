// 修正前の生成スクリプトが作った原稿を、現在の形式に揃える（何度実行しても同じ結果）
//   - note 原稿: 有料部分を暗号化（公開鍵のみで実行可）
//   - Web 記事: PRO 見出し以降を除去
//   - Zenn 記事: 末尾の送客文を共通の文面に置き換え
import fs from "fs";
import path from "path";
import { stripProSection } from "./utils/pro_boundary.mjs";
import { zennCta } from "./utils/funnel_copy.mjs";
import { isSealed, splitPaid, writeSealedNote, loadPublicKey, noteDir } from "./utils/note_vault.mjs";

const counts = { notes: 0, web: 0, zenn: 0 };

const pub = loadPublicKey();
for (const f of fs.readdirSync(noteDir).filter((f) => f.endsWith("_note.md"))) {
  const p = path.join(noteDir, f);
  const c = fs.readFileSync(p, "utf8");
  if (!isSealed(c) && splitPaid(c)) { writeSealedNote(p, c, pub); counts.notes++; }
}

const radarDir = path.resolve("src/pages/radar");
for (const f of fs.readdirSync(radarDir).filter((f) => f.endsWith(".md"))) {
  const p = path.join(radarDir, f);
  const c = fs.readFileSync(p, "utf8");
  const n = stripProSection(c);
  if (n !== c) { fs.writeFileSync(p, n, "utf8"); counts.web++; }
}

// 旧テンプレートの送客ブロック（見出しから「続きを読む」リンクまで）
const OLD_CTA_RE = /^## (🔒 【続き】|💡 商用化アーキテクチャ ＆ 受託開発提案テンプレートについて)[\s\S]*?^👉 \*\*\[[^\n]*\]\(https:\/\/ssk0224\.github\.io\/auto-tech-radar\/radar\/([a-z0-9_-]+)\/\)\*\*$/m;
for (const dir of ["articles", "zenn_drafts"]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const p = path.join(dir, f);
    const c = fs.readFileSync(p, "utf8");
    const m = c.match(OLD_CTA_RE);
    if (!m) continue;
    fs.writeFileSync(p, c.replace(OLD_CTA_RE, zennCta(m[2]).trimEnd()), "utf8");
    counts.zenn++;
  }
}

console.log(`✓ 旧形式の原稿を移行: note ${counts.notes} 本 / Web ${counts.web} 本 / Zenn ${counts.zenn} 本`);
