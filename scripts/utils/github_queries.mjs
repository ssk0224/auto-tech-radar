// 急上昇OSSの候補を探す GitHub 検索クエリ（記事生成 scripts/crawl_and_generate.mjs と
// 日次スナップショット scripts/snapshot_ledger.mjs で共通。片方だけ変えて候補の母集団がずれないようにする）

// 3つの戦略クエリで検索（GitHub Search APIの「AND/OR/NOT演算子は最大5個まで」の制約に厳格準拠）
// 戦略1: 過去30日以内に生まれ、爆発的にスターを獲得している世界的新星OSS (Stars > 200)
// 戦略2: 直近アクティブなAIエージェント、自律実行基盤、MCP、推論基盤 (Stars > 400)
// 戦略3: SaaS代替、browser-use、ローカルAI基盤 (Stars > 400)
export function trendingSearchQueries(now = Date.now()) {
  const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [
    `created:>${oneMonthAgo} stars:>200 archived:false is:public`,
    `(agent OR autonomous OR mcp OR "self-hosted" OR vllm) stars:>400 archived:false is:public pushed:>${oneWeekAgo}`,
    `("browser-use" OR alternative OR inference) stars:>400 archived:false is:public pushed:>${oneWeekAgo}`
  ];
}

export function searchReposUrl(q) {
  return `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
}
