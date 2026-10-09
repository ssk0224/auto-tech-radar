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

// 1回の実行で生成する新規記事数（API制限を完全に回避する安全設計）
const TARGET_NEW_COUNT = 2;

// GitHub API リクエスト用ヘッダー（Actions環境のトークンでレート制限を回避）
function getGithubHeaders() {
  const headers = {
    "User-Agent": "Auto-Tech-Radar/2.0",
    "Accept": "application/vnd.github.v3+json",
  };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// 急上昇・トレンドリポジトリの取得
async function fetchTrendingRepos() {
  const query = "stars:>500 archived:false is:public";
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=30`;
  
  const res = await fetch(url, { headers: getGithubHeaders() });
  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}): ${res.statusText}`);
  }
  const data = await res.json();
  return (data.items || []).filter(
    (r) => r.language && r.description && r.name && !r.fork
  );
}

// README の取得（最大30,000文字まで広域取得）
async function getReadme(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  try {
    const res = await fetch(url, {
      headers: {
        ...getGithubHeaders(),
        "Accept": "application/vnd.github.raw",
      },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 30000);
  } catch (err) {
    console.warn(`Failed to fetch README for ${owner}/${repo}: ${err.message}`);
    return "";
  }
}

// Gemini による記事生成（モデルのフォールバック機構付き）
async function generateTechnicalArticle(repo, readme) {
  const today = new Date().toISOString().split("T")[0];
  const licenseName = repo.license?.name || repo.license?.spdx_id || "オープンソース (要確認)";

  const systemInstruction = `
あなたはシリコンバレーのシニアソリューションアーキテクト兼技術エバンジェリストです。
オープンソースソフトウェア（OSS）の一次情報を基に、エンジニアおよび事業開発者が熱狂する最高品質の日本語技術ドキュメントを作成します。
主観的な感想や挨拶文は一切排除し、事実・論理・技術仕様・ビジネス活用価値に基づいた構造化ドキュメントを執筆してください。
`;

  const prompt = `
以下のGitHubリポジトリ情報を基に、プロフェッショナルな日本語技術ドキュメントを作成してください。

[リポジトリ情報]
リポジトリ名: ${repo.full_name}
公式URL: ${repo.html_url}
スター数: ${repo.stargazers_count}
主要言語: ${repo.language}
ライセンス: ${licenseName}
概要: ${repo.description}

[README コンテンツ抜粋]
${readme || "(READMEなし - リポジトリ概要から分析してください)"}

[出力フォーマット要件]
1. 出力は純粋なマークダウン形式とし、冒頭に以下のフロントマターを必ず配置してください。フロントマターの前に余計なテキストを一切含めないでください。
---
layout: "../../layouts/Layout.astro"
title: "${repo.name} - ${repo.description.replace(/"/g, "'")}"
description: "${repo.description.replace(/"/g, "'")}"
pubDate: "${today}"
tags: ["${repo.language}", "OSS", "GitHub"]
repoUrl: "${repo.html_url}"
stars: ${repo.stargazers_count}
---

2. 本文は以下のセクション構成で詳細に執筆してください：
# ${repo.name}: 概要と革新性
## 解決する主要な課題とアーキテクチャ
- 従来の技術スタックにおける問題点
- 本ツールが採用するアプローチと仕組み

## 競合ツール/商用SaaSとの徹底比較
- 主な競合ツールとの機能・パフォーマンス・コスト比較

## 💡 ビジネス・マネタイズ活用アイデア（実践例）
- 本OSSを活用した受託開発・自社SaaS立ち上げ・自動化運用の具体例
- コスト削減効果または収益化のポテンシャル

## インストール & クイックスタート手順
- 前提条件
- コマンドライン手順（コードブロック付き）

## 商用利用可否 & ライセンス考察
- ライセンス（${licenseName}）の商用利用可否と注意点
`;

  // 第一優先: gemini-3.8-flash, フォールバック: gemini-2.5-flash
  const models = ["gemini-3.8-flash", "gemini-2.5-flash"];
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`Generating with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2, // 再現性と正確性を担保
        },
      });

      let text = response.text || "";
      // マークダウン記法のコードブロック囲み（\`\`\`markdown ... \`\`\`）があれば自動除去
      text = text.replace(/^```markdown\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      // フロントマターが正常に配置されているか確認
      if (text.startsWith("---")) {
        // layout が欠落している場合は自動注入
        if (!text.includes("layout:")) {
          text = text.replace(/^---\n/, '---\nlayout: "../../layouts/Layout.astro"\n');
        }
        return text;
      } else {
        // フロントマターが欠落している場合のフォールバック補正
        const fallbackHeader = `---
layout: "../../layouts/Layout.astro"
title: "${repo.name} - 技術解説"
description: "${repo.description.replace(/"/g, "'")}"
pubDate: "${today}"
tags: ["${repo.language}", "OSS"]
repoUrl: "${repo.html_url}"
stars: ${repo.stargazers_count}
---

`;
        return fallbackHeader + text;
      }
    } catch (err) {
      console.warn(`Model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== Auto Tech Radar Pipeline 2.0 (Gemini 3.8 Flash Edition) ===");
  const repos = await fetchTrendingRepos();
  const outputDir = path.resolve("src/pages/radar");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let generatedCount = 0;

  for (const repo of repos) {
    if (generatedCount >= TARGET_NEW_COUNT) {
      console.log(`Reached target count (${TARGET_NEW_COUNT}). Pipeline completed.`);
      break;
    }

    const slug = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const filePath = path.join(outputDir, `${slug}.md`);

    if (fs.existsSync(filePath)) {
      continue; // 既にインデックス済みの場合はスキップ
    }

    console.log(`\n[${generatedCount + 1}/${TARGET_NEW_COUNT}] Processing: ${repo.full_name}`);
    const readme = await getReadme(repo.owner.login, repo.name);

    try {
      const content = await generateTechnicalArticle(repo, readme);
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`✓ Saved: ${filePath}`);
      generatedCount++;

      // レート制限を安全に回避するため 3 秒待機
      if (generatedCount < TARGET_NEW_COUNT) {
        await sleep(3000);
      }
    } catch (err) {
      console.error(`Failed to process ${repo.full_name}: ${err.message}`);
      // 1件失敗しても次のリポジトリを処理して継続
    }
  }

  console.log(`\nPipeline finished. Total new articles created: ${generatedCount}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
