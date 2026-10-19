// src/pages/radar/*.md から PRO限定エリア（有料本文）を取り除く（何度実行しても同じ結果）
import fs from "fs";
import path from "path";
import { stripProSection, findProLeaks } from "./utils/pro_boundary.mjs";

const webDir = path.resolve("src/pages/radar");
let stripped = 0;
const leaks = [];

for (const f of fs.readdirSync(webDir).filter((f) => f.endsWith(".md"))) {
  const filePath = path.join(webDir, f);
  const content = fs.readFileSync(filePath, "utf8");
  const next = stripProSection(content);
  if (next !== content) {
    fs.writeFileSync(filePath, next, "utf8");
    stripped++;
  }
  const found = findProLeaks(next);
  if (found.length) leaks.push(`${f}: ${found.join(", ")}`);
}

console.log(`✓ PRO限定エリアを除去: ${stripped} 本`);
if (leaks.length) {
  console.error("❌ 境界見出しの外に PRO 専用要素が残っています（手動確認が必要）:");
  leaks.forEach((l) => console.error(`  - ${l}`));
  process.exit(1);
}
