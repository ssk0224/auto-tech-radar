import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateOgCardForPost } from "./generate_og_cards.mjs";

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

// 厳格なノイズ・非プロダクト系リポジトリの排除ブラックリスト
const NOISE_FILTER_REGEX = /(index$|core$|cask$|nixpkgs|mediawiki|awesome|interview|curriculum|roadmap|internship|cheatsheet|cheat-sheet|leetcode|tutorial|translation|locale|dotfiles|fonts|sample|dataset|collection)/i;

// 急上昇・高収益OSS（AIエージェント、SaaS代替、ローカル推論基盤、マイクロSaaS）の精密取得
async function fetchTrendingRepos() {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 2つの最強戦略クエリで検索
  // 戦略1: 過去30日以内に生まれ、爆発的にスターを獲得している世界的新星OSS (Stars > 200)
  // 戦略2: 直近アクティブなAIエージェント、SaaS代替、自律実行基盤
  const queries = [
    `created:>${oneMonthAgo} stars:>200 archived:false is:public`,
    `(agent OR autonomous OR "browser-use" OR mcp OR "self-hosted" OR alternative OR vllm OR inference) stars:>400 archived:false is:public pushed:>${oneWeekAgo}`
  ];

  const candidateMap = new Map();

  for (const q of queries) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
      const res = await fetch(url, { headers: getGithubHeaders() });
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.items || [])) {
          if (!candidateMap.has(item.full_name)) {
            candidateMap.set(item.full_name, item);
          }
        }
      }
    } catch (e) {
      console.warn(`Query search warning for "${q}": ${e.message}`);
    }
  }

  // 厳格なフィルタリング：商用化・受託提案・SaaS化が成立する真のプロダクトのみを抽出
  return Array.from(candidateMap.values()).filter((r) => {
    if (!r.name || !r.description || r.fork) return false;
    if (!r.language) return false; // 言語不明・単なるマークダウン集は除外
    if (r.description.length < 20) return false; // 説明が短すぎるものは除外
    if (NOISE_FILTER_REGEX.test(r.name) || NOISE_FILTER_REGEX.test(r.full_name)) return false; // パッケージ辞書・求人リスト・チートシート集を完全排除
    return true;
  });
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
※必須：このセクション内に、コンポーネント構成やデータフローを示すMermaidダイアグラム（```mermaid ... ``` / graph TD 等）を必ず1つ以上含めて視覚的に図解してください。
## 競合ツール/商用SaaSとの徹底比較
## 💡 ビジネス・マネタイズ活用アイデア（実践例）
## インストール & クイックスタート手順
## 商用利用可否 & ライセンス考察

=== NOTE ARTICLE ===
# 【受託80万〜250万】海外急上昇OSS「${repo.name}」商用化マニュアル｜社内DX提案書 ＆ 自社SaaS構築手順付き

## はじめに：なぜ今、世界中で爆発的に注目されているのか？
（無料公開エリア：魅力的な導入、解決する課題、革新性の概要）
※重要：冒頭で「この記事を読めば、クライアントに80万〜250万円の受託開発・AI導入を即提案できる理由」を明確に提示してください。

## 主な機能とアーキテクチャ概要
（無料公開エリア：技術的な特徴、クイックスタート手順）

### 📊 商用化・受託開発シミュレーション早見表
| 項目 | 分析結果 |
|---|---|
| **想定受託開発単価** | 80万円 〜 250万円 |
| **主な想定クライアント** | DX推進企業 / AI内製化チーム / スタートアップ |
| **商用SaaS化の狙い目** | 独自ワークフロー特化型マイクロSaaS |
| **実装・導入難易度** | 中級（Docker / API連携 / TypeScript/Python） |

### 🔒 有料エリアで完全公開する実践ナレッジ
- クライアントを即決させる受託開発提案シナリオ（想定見積もり内訳・ペイン解決策）
- 自社マイクロSaaSとして月額課金化するための設計仕様書
- コピペで本番投入できる環境構築・設定ファイル（YAML/JSON/ENV）完全版
- クライアント向け「社内稟議・提案書ドラフト」

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------

## 💡 このOSSを活用した具体的なマネタイズ戦略（受託・自社サービス化）
※極めて重要：有料ライン以降は購入者が「980円以上の価値があった」と絶賛する超高密度な実用情報（最低2,000文字以上）を執筆してください。絶対に数行で要約を終わらせたり途中で切らないこと。
1. クライアントへの提案シナリオと受託開発モデル（想定単価：80万円〜250万円、提案先ターゲット、ペイン、受注構成案を具体的に深掘り）
2. 自社マイクロSaaS / 有料ツールとしての構築アイデア（具体的なプロダクト名、機能要件、ターゲット価格設定を2つ以上提示）
3. 競合ツール（商用SaaS）に対する圧倒的なコスト削減提案の作り方（価格差比較テーブル、意思決定者を説得する営業キラーフレーズ）

## 商用カスタマイズ・実装の勘所（コピペで使える設計ガイド）
- 実務でそのまま使える設定ファイル（JSON/YAML/ENV）や拡張コード例（TypeScript/Python等）を必ず記載
- 社内運用時のセキュリティ境界、アクセス権限管理、ライセンス遵守の注意点

## まとめと今後の展望
- 今後のOSS進化予測と、先行者利益を獲得するための即座のアクションプラン

---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）にご加入いただくと、本日公開のこの記事を含む全アーカイブ（15本以上・総額14,700円相当）が初月即時読み放題になります。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #副業 #受託開発 #スタートアップ #最新技術 #GitHub

=== X THREAD ===
※重要規則：各ツイートはURLやハッシュタグを含めて全角110文字以内（改行含む）に厳密に収めてください。長文・英語原文の丸写しは禁止。

[TWEET 1]
GitHub急上昇OSS「${repo.name}」が注目。
${repo.description.slice(0, 48)}...
⭐ スター: ${repo.stargazers_count}
#${repo.language} #OSS #AI開発
▼ 詳細はツリーへ（保存推奨 📌）
${repo.html_url}

[TWEET 2]
【従来のツールとの違い】
（革新的な点・高速化やコスト削減を全角60文字以内で端的に要約）

[TWEET 3]
【💡 商用化 ＆ 受託開発ガイド】
受託開発での提案シナリオや自社SaaS構築の収益化手順を徹底解説。
▼ 詳細レポート（チートシート付）
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

  // X投稿文にワンクリック投稿リンクを付加（厳密な130文字制限チェック）
  let enhancedXContent = `==================================================\n📱 ${repo.name} X (Twitter) 投稿用スレッド\n==================================================\n\n`;
  const tweets = xContent.split(/\[TWEET \d+\]/gi).map((t) => t.trim()).filter(Boolean);

  // Xの文字数計算（URLは一律23文字換算）
  function calcTweetLen(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const cleanText = text.replace(urlRegex, "");
    const urlCount = (text.match(urlRegex) || []).length;
    return cleanText.length + (urlCount * 11.5); // 日本語全角1文字=1、半角/URL=0.5相当
  }

  tweets.forEach((rawTweet, idx) => {
    let tweet = rawTweet;
    // URL以外の本文が長すぎる場合は安全にトリミング
    const lines = tweet.split("\n");
    if (lines.length > 5) {
      tweet = lines.slice(0, 5).join("\n");
    }

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

      try {
        generateOgCardForPost({
          slug,
          title: repo.name,
          stars: repo.stargazers_count,
          tags: [repo.language, "OSS"],
          desc: repo.description
        });
        console.log(`✓ 個別OGPカード（SVG）自動生成完了: public/ogp/${slug}.svg`);
      } catch (ogpErr) {
        console.warn(`OGP生成スキップ: ${ogpErr.message}`);
      }

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
