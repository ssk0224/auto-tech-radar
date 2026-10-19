import fs from "fs";
import path from "path";

const noteDir = "note_drafts";
const files = fs.readdirSync(noteDir).filter(f => f.endsWith(".md"));

console.log(`=== note_drafts 厳格監査（全 ${files.length} 本） ===`);

let issues = [];
let passCount = 0;

files.forEach(file => {
  const content = fs.readFileSync(path.join(noteDir, file), "utf8");

  // リードマグネット（チートシート等）は無料配布用なので除外
  if (file.includes("LEAD_MAGNET") || file.includes("cheat_sheet")) {
    console.log(`  ℹ️ [LEAD MAGNET] ${file}: 無料集客リードマグネット枠`);
    return;
  }

  // 有料ラインマーカーの検出
  const hasPaywallLine = content.includes("【有料ライン") || content.includes("有料会員限定") || content.includes("ここから先は有料");
  
  if (!hasPaywallLine) {
    issues.push(`❌ [MISSING PAYWALL LINE] ${file}: 有料境界マーカーがありません！`);
    return;
  }

  // 有料ラインの位置
  let paywallIndex = -1;
  const paywallMarkers = ["【有料ライン", "有料会員限定", "ここから先は有料"];
  for (const m of paywallMarkers) {
    const idx = content.indexOf(m);
    if (idx !== -1 && (paywallIndex === -1 || idx < paywallIndex)) {
      paywallIndex = idx;
    }
  }

  // PROコンテンツ（mcpServers, docker-compose, 提案書本文）の位置
  const mcpIdx = content.indexOf("mcpServers");
  const dockerIdx = content.indexOf("docker-compose");
  const proposalIdx = content.indexOf("■ 案件名:");

  let fileHasLeak = false;
  if (mcpIdx !== -1 && mcpIdx < paywallIndex) {
    issues.push(`❌ [PRO LEAK IN FREE AREA] ${file}: mcpServers が有料ラインの手前に漏洩しています！`);
    fileHasLeak = true;
  }
  if (dockerIdx !== -1 && dockerIdx < paywallIndex) {
    issues.push(`❌ [PRO LEAK IN FREE AREA] ${file}: docker-compose が有料ラインの手前に漏洩しています！`);
    fileHasLeak = true;
  }
  if (proposalIdx !== -1 && proposalIdx < paywallIndex) {
    issues.push(`❌ [PRO LEAK IN FREE AREA] ${file}: 提案書本文（■ 案件名:）が有料ラインの手前に漏洩しています！`);
    fileHasLeak = true;
  }

  if (!fileHasLeak) {
    passCount++;
  }
});

console.log(`\n監査結果: 正常合格 ${passCount} 本 / 異常 ${issues.length} 件`);
if (issues.length > 0) {
  issues.forEach(i => console.error(i));
  process.exit(1);
} else {
  console.log("🎉 note_drafts 全件監査 ALL PASS: 全ての原稿で有料ラインが正しく設置され、PROキットの漏洩はゼロです！");
}
