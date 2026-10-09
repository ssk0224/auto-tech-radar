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

// 1回のAI呼び出しで「Web記事」「note有料記事ドラフト」「Xスレッド」を3点一括生成
async function generateAllContent(repo, readme) {
  const today = new Date().toISOString().split("T")[0];
  const licenseName = repo.license?.name || repo.license?.spdx_id || "オープンソース (要確認)";

  const systemInstruction = `
あなたはシリコンバレーのシニアソリューションアーキテクト兼トップテックライターです。
オープンソース（OSS）の一次情報を基に、以下の3つの最高品質コンテンツを一括作成してください。
1. 自社Webサイト用 Astro技術解説マークダウン
2. note有料販売用 記事パッケージ（無料導入部＋有料ノウハウ部の2重構造）
3. X (Twitter) 用のバズ・スレッド投稿文（3ツイート構成）

必ず指定のデリミタ（=== SECTION ===）で正確に区切って出力してください。
`;

  const prompt = `
以下のGitHubリポジトリ情報を基に、3つのコンテンツを作成してください。

[リポジトリ情報]
名前: ${repo.full_name}
URL: ${repo.html_url}
スター数: ${repo.stargazers_count}
言語: ${repo.language}
ライセンス: ${licenseName}
概要: ${repo.description}

[README]
${readme || "(READMEなし - リポジトリ概要から分析してください)"}

--------------------------------------------------
以下のフォーマット通りに出力してください。余計な挨拶は不要です。

=== WEB ARTICLE ===
---
layout: "../../layouts/Layout.astro"
title: "${repo.name} - ${repo.description.replace(/"/g, "'")}"
description: "${repo.description.replace(/"/g, "'")}"
pubDate: "${today}"
tags: ["${repo.language}", "OSS", "GitHub"]
repoUrl: "${repo.html_url}"
stars: ${repo.stargazers_count}
---

# ${repo.name}: 概要と革新性
## 解決する主要な課題とアーキテクチャ
## 競合ツール/商用SaaSとの徹底比較
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
## インストール & クイックスタート手順
## 商用利用可否 & ライセンス考察

=== NOTE ARTICLE ===
# 【最新OSS解体新書】${repo.name}とは？機能解説とビジネス活用・マネタイズ実践法

## はじめに：なぜ今、世界中で注目されているのか？
（無料公開エリア：魅力的な導入、解決する課題、革新性の概要）

## 主な機能とアーキテクチャ
（無料公開エリア：技術的な特徴、クイックスタート手順）

--------------------------------------------------
【有料ライン（推奨販売価格: 500円〜980円）ここから先は有料会員限定】
--------------------------------------------------

## 💡 このOSSを活用した具体的なマネタイズ戦略（受託・自社サービス化）
1. クライアントへの提案シナリオと受託開発モデル（想定単価：30万円〜100万円）
2. 自社マイクロSaaS / 有料ツールとしての構築アイデア
3. 競合ツールに対する圧倒的なコスト削減提案の作り方

## 商用カスタマイズ・実装の勘所（コピペで使える設計ガイド）
（具体的なコード例や設定パラメータのポイント）

## まとめと今後の展望

=== X THREAD ===
[TWEET 1]
GitHubで急上昇中のOSS「${repo.name}」が凄すぎる。
${repo.description}
⭐ スター数: ${repo.stargazers_count}
主要技術: #${repo.language} #OSS #AI開発
▼ 詳細とビジネス活用の考察はツリーへ↓
${repo.html_url}

[TWEET 2]
【従来のツールとの決定的な違い】
（なぜこれが革新的なのか、何が他と違うのかを2行程度で要約）

[TWEET 3]
【💡 ビジネス・マネタイズ活用可能性】
受託開発での提案シナリオや、自社SaaS構築のアイデア、詳細な収益化手順をまとめました。
▼ 買い切りで即閲覧（¥980）:
https://buy.stripe.com/aFaeVd8GV1CYgQG0NY00000
▼ noteメンバーシップ（月額読み放題）:
https://note.com/vast_ixora7005
▼ 公式Tech Radar:
https://ssk0224.github.io/auto-tech-radar/
`;

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
          temperature: 0.2,
        },
      });

      const text = response.text || "";
      if (text.includes("=== WEB ARTICLE ===")) {
        return parseGeneratedOutput(text, repo, today);
      }
    } catch (err) {
      console.warn(`Model ${model} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

// 出力テキストを各ファイル用にパース
function parseGeneratedOutput(rawText, repo, today) {
  let webContent = "";
  let noteContent = "";
  let xContent = "";

  const parts = rawText.split(/=== (WEB ARTICLE|NOTE ARTICLE|X THREAD) ===/g);
  for (let i = 1; i < parts.length; i += 2) {
    const section = parts[i].trim();
    const body = (parts[i + 1] || "").trim();

    if (section === "WEB ARTICLE") {
      webContent = body.replace(/^```markdown\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
    } else if (section === "NOTE ARTICLE") {
      noteContent = body;
    } else if (section === "X THREAD") {
      xContent = body;
    }
  }

  // Web記事のフォールバック
  if (!webContent.startsWith("---")) {
    webContent = `---
layout: "../../layouts/Layout.astro"
title: "${repo.name} - ${repo.description.replace(/"/g, "'")}"
description: "${repo.description.replace(/"/g, "'")}"
pubDate: "${today}"
tags: ["${repo.language}", "OSS"]
repoUrl: "${repo.html_url}"
stars: ${repo.stargazers_count}
---

${webContent}`;
  } else if (!webContent.includes("layout:")) {
    webContent = webContent.replace(/^---\n/, '---\nlayout: "../../layouts/Layout.astro"\n');
  }

  // X投稿文にワンクリック投稿リンクを付加
  let enhancedXContent = `==================================================\n📱 ${repo.name} X (Twitter) 投稿用スレッド\n==================================================\n\n`;
  const tweets = xContent.split(/\[TWEET \d+\]/gi).map((t) => t.trim()).filter(Boolean);

  tweets.forEach((tweet, idx) => {
    const tweetNum = idx + 1;
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    enhancedXContent += `--------------------------------------------------\n【ツイート ${tweetNum}】\n${tweet}\n\n👉 ワンクリックで投稿画面を開く:\n${intentUrl}\n--------------------------------------------------\n\n`;
  });

  return {
    web: webContent,
    note: noteContent,
    x: enhancedXContent,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== Auto Tech Radar Pipeline 3.0 (Web + note有料 + X一括生成) ===");
  const repos = await fetchTrendingRepos();

  const webDir = path.resolve("src/pages/radar");
  const noteDir = path.resolve("note_drafts");
  const xDir = path.resolve("x_posts");

  [webDir, noteDir, xDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  let generatedCount = 0;

  for (const repo of repos) {
    if (generatedCount >= TARGET_NEW_COUNT) {
      console.log(`Reached target count (${TARGET_NEW_COUNT}). Pipeline completed.`);
      break;
    }

    const slug = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const webFile = path.join(webDir, `${slug}.md`);
    const noteFile = path.join(noteDir, `${slug}_note.md`);
    const xFile = path.join(xDir, `${slug}_x.txt`);

    if (fs.existsSync(webFile)) {
      continue; // 既に生成済みの場合はスキップ
    }

    console.log(`\n[${generatedCount + 1}/${TARGET_NEW_COUNT}] Processing: ${repo.full_name}`);
    const readme = await getReadme(repo.owner.login, repo.name);

    try {
      const result = await generateAllContent(repo, readme);

      fs.writeFileSync(webFile, result.web, "utf8");
      console.log(`✓ Web記事保存: ${webFile}`);

      fs.writeFileSync(noteFile, result.note, "utf8");
      console.log(`✓ note有料記事ドラフト保存: ${noteFile}`);

      fs.writeFileSync(xFile, result.x, "utf8");
      console.log(`✓ X投稿文（ワンクリックURL付）保存: ${xFile}`);

      generatedCount++;

      if (generatedCount < TARGET_NEW_COUNT) {
        await sleep(3000);
      }
    } catch (err) {
      console.error(`Failed to process ${repo.full_name}: ${err.message}`);
    }
  }

  console.log(`\nPipeline finished. Total new packages created: ${generatedCount}`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
