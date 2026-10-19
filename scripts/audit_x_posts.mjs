import fs from "fs";
import path from "path";

const xDir = "x_posts";
const files = fs.readdirSync(xDir).filter(f => f.endsWith(".txt"));
console.log(`=== x_posts 厳格監査（全 ${files.length} 本） ===`);

let xIssues = [];
files.forEach(f => {
  const content = fs.readFileSync(path.join(xDir, f), "utf8");
  if (content.length === 0) {
    xIssues.push(`❌ [EMPTY X POST] ${f}: 0バイトの空ファイルです！`);
    return;
  }
  // PROコンテンツ（mcpServers や docker-compose や 提案書全文）がXポストに丸ごと漏れていないか
  if (content.includes("mcpServers") || content.includes("docker-compose.yml") || content.includes("■ 案件名:")) {
    xIssues.push(`❌ [PRO LEAK IN X POST] ${f}: X投稿にPRO実務キットが丸ごと漏洩しています！`);
  }
});

console.log(`x_posts 監査結果: 正常合格 ${files.length - xIssues.length} 本 / 異常 ${xIssues.length} 件`);
if (xIssues.length > 0) {
  xIssues.forEach(i => console.error(i));
  process.exit(1);
} else {
  console.log("🎉 x_posts 全件監査 ALL PASS: X投稿からのPROキット漏洩はゼロです！\n");
}
