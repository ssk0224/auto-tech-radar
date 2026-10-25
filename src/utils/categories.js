// 記事の分類（チートシートの列・レーダーマップの象限・OGP 画像の左上の表示）。
// 分類は記事のタグ（GitHub の言語と topics）にその語がそのまま含まれるときだけ付け、当てはまらなければ「未分類」にする。
// タイトル・説明文の部分一致や「当てはまらないものは全部この分類」という既定の分類は使わない
// （「業務自動化・受託開発」「Next-Gen Systems & Rust」に、Android TV のツールや Flutter のアプリが入った。2026-10-22）
export const UNCATEGORIZED = "未分類";

export const TOPIC_CATEGORIES = [
  { key: "agent", label: "AI エージェント", tags: ["agent", "agents", "ai-agent", "ai-agents", "agentic", "agenticai", "multi-agent", "agentskills"] },
  { key: "llm", label: "LLM・推論", tags: ["llm", "llms", "inference", "local-llm", "quantization", "machinelearning", "rag"] },
  { key: "devtools", label: "開発者ツール・CLI", tags: ["cli", "developer-tools", "devtools", "terminal", "tui"] },
];

export function categoryOf(tags) {
  const have = new Set((Array.isArray(tags) ? tags : []).map((t) => String(t || "").trim().toLowerCase()));
  return TOPIC_CATEGORIES.find((c) => c.tags.some((t) => have.has(t))) || { key: "none", label: UNCATEGORIZED, tags: [] };
}
