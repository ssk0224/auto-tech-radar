import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Error: GEMINI_API_KEY is not set.");
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function fetchTrendingRepos() {
  const query = "stars:>1000 archived:false is:public";
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=10`;
  const res = await fetch(url, { headers: { "User-Agent": "Auto-Tech-Radar" } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.statusText}`);
  const data = await res.json();
  return (data.items || []).filter(r => r.language && r.description && r.license);
}

async function getReadme(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  const res = await fetch(url, { credentials: "omit", headers: { "Accept": "application/vnd.github.raw", "User-Agent": "Auto-Tech-Radar" } });
  return res.ok ? await res.text() : "";
}

async function run() {
  const repos = await fetchTrendingRepos();
  const outputDir = path.resolve("src/pages/radar");

  for (const repo of repos.slice(0, 2)) {
    const slug = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filePath = path.join(outputDir, `${slug}.md`);
    if (fs.existsSync(filePath)) continue;

    console.log(`Processing: ${repo.full_name}`);
    const readme = await getReadme(repo.owner.login, repo.name);

    const prompt = `
あなたはシニア技術エバンジェリストです。以下のGitHubリポジトリ情報を基に、プロの日本語技術ドキュメントを作成してください。

[リポジトリ情報]
名前: ${repo.full_name}
URL: ${repo.html_url}
スター数: ${repo.stargazers_count}
ライセンス: ${repo.license?.spdx_id || "Unknown"}
概要: ${repo.description}

[README]
${readme.slice(0, 7000)}

[出力要件]
- マークダウン形式。冒頭にフロントマター (title, description, pubDate, tags, repoUrl) を厳格に配置。
- 「概要」「解決する課題」「競合ツールとの違い」「インストール・クイックスタート手順」「商用利用可否」を網羅。
- 主観や感情表現は排除し、エンジニア向けに事実のみを構造化すること。
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const content = response.text;
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`Saved: ${filePath}`);
    break;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
