// PRO限定エリアの境界管理
// GitHub Pages は静的配信のため、HTMLに含めた有料本文はJSで隠しても誰でも読める。
// 有料本文（PRO見出し以降）は Web 記事に含めず、note の有料記事でのみ提供する。

export const PRO_MARKER = "【Auto Tech Radar PRO限定】";

const PRO_HEADING_RE = /^#{2,3} [^\n]*【Auto Tech Radar PRO限定】[^\n]*$/m;

// Web 記事・配信HTMLに残ってはいけない PRO 専用要素（有料キットの見出し）
// mcpServers や docker-compose は対象外: 無料記事が OSS の README の MCP 設定・導入手順を引用するのは正当なため
export const PRO_ONLY_SIGNATURES = [
  PRO_MARKER,
  "社内DX・AI導入提案書 Markdown完全版",
  "見積シミュレーション表",
];

// PRO見出し以降を取り除き、直前の区切り線 (---) も落とす
export function stripProSection(md) {
  const m = md.match(PRO_HEADING_RE);
  if (!m) return md;
  return md.slice(0, m.index).replace(/(\s*\n-{3,}\s*)+$/, "").trimEnd() + "\n";
}

export function findProLeaks(text) {
  return PRO_ONLY_SIGNATURES.filter((sig) => text.includes(sig));
}
