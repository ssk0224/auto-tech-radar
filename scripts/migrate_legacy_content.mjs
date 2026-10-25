// 修正前の生成スクリプトが作った原稿を、現在の形式に揃える（何度実行しても同じ結果）
//   - note 原稿: 有料部分を暗号化（公開鍵のみで実行可）、無料部分の旧定型文を現在の文面に
//   - Web 記事: PRO 見出し以降を除去
import fs from "fs";
import path from "path";
import { stripProSection } from "./utils/pro_boundary.mjs";
import { isSealed, splitPaid, writeSealedNote, loadPublicKey, noteDir } from "./utils/note_vault.mjs";

const counts = { notes: 0, web: 0 };

// 旧テンプレートが無料部分に入れていた定型文（受注の保証・根拠のない金額）を現在の文面にする
const PUBLIC_LINE_FIXES = [
  [/^> 本記事の価格は \*\*980円.*$/, "> 本記事の価格は **980円** です。"],
  [/^Auto Tech Radar noteメンバーシップ（月額1,980円）にご加入いただくと.*$/, "Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。"],
  [/^\| \*\*想定受託開発単価\*\* \| \**80万円 〜 250万円.*\|$/, "| **想定受託開発規模** | 有料エリアの工数見積表の合計に基づく概算 |"],
  [/^# 【受託80万〜250万】/, "# "],
];
const fixLine = (l) => {
  const cr = l.endsWith("\r") ? "\r" : "";
  const body = cr ? l.slice(0, -1) : l;
  return PUBLIC_LINE_FIXES.reduce((acc, [re, rep]) => acc.replace(re, rep), body) + cr;
};

const pub = loadPublicKey();
for (const f of fs.readdirSync(noteDir).filter((f) => f.endsWith("_note.md"))) {
  const p = path.join(noteDir, f);
  const c = fs.readFileSync(p, "utf8");
  const parts = splitPaid(c);
  if (!parts) continue;
  // 無料部分と末尾だけを直す（有料部分には触れない）
  const fixed = [...parts.head.map(fixLine), ...parts.paid, ...parts.tail.map(fixLine)].join("\n");
  if (!isSealed(c)) { writeSealedNote(p, fixed, pub); counts.notes++; }
  else if (fixed !== c) { fs.writeFileSync(p, fixed, "utf8"); counts.notes++; }
}

const radarDir = path.resolve("src/pages/radar");
for (const f of fs.readdirSync(radarDir).filter((f) => f.endsWith(".md"))) {
  const p = path.join(radarDir, f);
  const c = fs.readFileSync(p, "utf8");
  const n = stripProSection(c);
  if (n !== c) { fs.writeFileSync(p, n, "utf8"); counts.web++; }
}

console.log(`✓ 旧形式の原稿を移行: note ${counts.notes} 本 / Web ${counts.web} 本`);
