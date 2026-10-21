import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateOgCardForPost } from "./generate_og_cards.mjs";
import { sanitizeAndAttachUrlToTweet } from "./utils/twitter_formatter.mjs";
import { stripProSection } from "./utils/pro_boundary.mjs";
import { splitPaid, writeSealedNote, withStandardFooter, noteDraftProblems, sealedFileFor } from "./utils/note_vault.mjs";

import { findMissingReferences } from "./utils/reference_check.mjs";
import { zennCta, X_LINK_LABEL } from "./utils/funnel_copy.mjs";
import { NOISE_FILTER_REGEX } from "./utils/noise_filter.mjs";
import { findForbiddenClaims } from "./utils/claims_check.mjs";
import { findHype, HYPE_PROMPT_RULE } from "./utils/hype_check.mjs";
import { noteHashtags, applyNoteHashtags } from "./utils/note_hashtags.mjs";
import { fixMermaidInContent, mermaidProblems } from "./utils/mermaid.mjs";
import { mermaidParseErrors } from "./utils/mermaid_parse.mjs";
import { normalizeHeadings } from "./utils/headings.mjs";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set. Skipping crawl and generation gracefully.");
  process.exit(0);
}

const ai = new GoogleGenAI({ apiKey });

// 1回の実行（1日）で生成する新規記事数。Google の大量生成コンテンツに関する方針と Gemini の利用枠を踏まえて 1 本にする（2026-10-21、以前は 2 本）
const TARGET_NEW_COUNT = 1;
// 不採用が続いた場合に Gemini 呼び出しが際限なく増えないよう、1回の実行で試す候補数の上限
const MAX_ATTEMPTS_PER_RUN = 6;

// GitHub API リクエスト用ヘッダー（GH_PAT または GITHUB_TOKEN でレート制限を回避）
function getGithubHeaders() {
  const headers = {
    "User-Agent": "Auto-Tech-Radar/2.0",
    "Accept": "application/vnd.github.v3+json",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}


// 急上昇・高収益OSS（AIエージェント、SaaS代替、ローカル推論基盤、マイクロSaaS）の精密取得
async function fetchTrendingRepos(existingUrls = new Set(), existingSlugs = new Set()) {
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // 3つの戦略クエリで検索（GitHub Search APIの「AND/OR/NOT演算子は最大5個まで」の制約に厳格準拠）
  // 戦略1: 過去30日以内に生まれ、爆発的にスターを獲得している世界的新星OSS (Stars > 200)
  // 戦略2: 直近アクティブなAIエージェント、自律実行基盤、MCP、推論基盤 (Stars > 400)
  // 戦略3: SaaS代替、browser-use、ローカルAI基盤 (Stars > 400)
  const queries = [
    `created:>${oneMonthAgo} stars:>200 archived:false is:public`,
    `(agent OR autonomous OR mcp OR "self-hosted" OR vllm) stars:>400 archived:false is:public pushed:>${oneWeekAgo}`,
    `("browser-use" OR alternative OR inference) stars:>400 archived:false is:public pushed:>${oneWeekAgo}`
  ];

  const candidateMap = new Map();

  for (const q of queries) {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        const res = await fetch(url, {
          headers: getGithubHeaders(),
          signal: AbortSignal.timeout(15000),
        });

        if (res.ok) {
          const data = await res.json();
          for (const item of (data.items || [])) {
            if (!candidateMap.has(item.full_name)) {
              candidateMap.set(item.full_name, item);
            }
          }
          break; // 成功
        }

        // 403 / 429 GitHub API レート制限の精密ハンドリング
        if (res.status === 403 || res.status === 429) {
          const remaining = res.headers.get("x-ratelimit-remaining");
          const retryAfter = res.headers.get("retry-after");
          const errBody = await res.text().catch(() => "");
          console.warn(`[GitHub API Rate Limit] Status ${res.status} (remaining: ${remaining}, retry-after: ${retryAfter}): ${errBody.slice(0, 120)}`);

          const resetTime = parseInt(res.headers.get("x-ratelimit-reset") || "0", 10);
          const diff = resetTime ? Math.max(1, resetTime - Math.floor(Date.now() / 1000)) : 5;
          const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : diff;
          if (attempts < maxAttempts && waitSeconds <= 10) {
            console.log(`Waiting ${waitSeconds}s for GitHub rate limit reset...`);
            await sleep(waitSeconds * 1000);
            continue;
          }
          break; // リトライ不可時は次のクエリへ
        }

        const errText = await res.text().catch(() => "");
        console.warn(`GitHub Search API error (HTTP ${res.status}): ${errText.slice(0, 120)}`);
        break;
      } catch (e) {
        console.warn(`Query search warning for "${q}" (attempt ${attempts}): ${e.message}`);
        if (attempts < maxAttempts) await sleep(2000);
      }
    }
  }

  // 厳格なフィルタリング ＆ 既存記事重複の事前排除
  return Array.from(candidateMap.values()).filter((r) => {
    if (!r.name || !r.description || r.fork) return false;
    if (!r.language) return false; // 言語不明・単なるマークダウン集は除外
    if (r.description.length < 20) return false; // 説明が短すぎるものは除外
    if (NOISE_FILTER_REGEX.test(r.name) || NOISE_FILTER_REGEX.test(r.full_name)) return false; // パッケージ辞書・求人リスト・チートシート集を完全排除

    // 重複チェック: リポジトリURL または スラグが既に存在する場合は除外
    const normUrl = (r.html_url || "").toLowerCase().replace(/\/$/, "");
    if (existingUrls.has(normUrl)) {
      return false;
    }
    const slug = r.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (existingSlugs.has(slug)) {
      return false;
    }

    return true;
  });
}

// README の取得（最大30,000文字まで広域取得、タイムアウト ＆ レートリミット保護付き）
async function getReadme(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/readme`;
  try {
    const res = await fetch(url, {
      headers: {
        ...getGithubHeaders(),
        "Accept": "application/vnd.github.raw",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 403 || res.status === 429) {
      console.warn(`[GitHub Rate Limit] Failed to fetch README for ${owner}/${repo} (HTTP ${res.status})`);
      return "";
    }
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
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const licenseName = repo.license?.name || repo.license?.spdx_id || "オープンソース (要確認)";

  const systemInstruction = `
あなたはシリコンバレーのシニアソリューションアーキテクト兼トップテックライターです。
オープンソース（OSS）の一次情報を基に、以下の3つの最高品質コンテンツを一括作成してください。
1. 自社Webサイト用 Astro技術解説マークダウン
2. note有料販売用 記事パッケージ（無料導入部＋有料ノウハウ部の2重構造）
3. X (Twitter) 用のバズ・スレッド投稿文（3ツイート構成）

必ず指定のデリミタ（=== SECTION ===）で正確に区切って出力してください。

【事実性の厳守】
- Dockerイメージ名、パッケージ名、CLIコマンド、ポート番号、設定キー、MCPサーバーの起動方法は、与えられたREADMEに記載があるものだけを使うこと。記載がないものを推測で作らないこと。
- READMEに公式Dockerイメージの記載がない場合は、架空のイメージ名を書かず「公式イメージは案内されていない」と明記し、READMEのインストール手順を示すこと。
- READMEにMCPサーバーとしての起動方法の記載がない場合は、mcpServers の設定例を作らず「公式のMCPサーバー手段は案内されていない」と明記すること。
- 金額・削減率・ROI・性能値は、見積表の工数×単価など計算の前提を示せるものだけを書くこと。前提が示せない数値は書かないこと。
- Docker / docker-compose の構成は、READMEの動作要件（対応OS・GPU・デスクトップアプリか等）と矛盾しない場合だけ書くこと。READMEにDockerの記載がない場合は「公式未提供・自作のコンテナ化例（動作未検証）」と明記すること。macOS専用・Apple Silicon専用などコンテナで動かせないものはDocker構成を書かず、READMEの導入手順を示すこと。
- 導入実績・連携実績・顧客数・受賞歴など、READMEで確認できない実績は書かないこと。

【誇張・結果保証の禁止】
${HYPE_PROMPT_RULE}
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
## 🎯 成熟度の目安（AI による見立て）
※README とリポジトリ情報（スター数・更新状況）から読み取れる範囲で、成熟度の目安と根拠を簡潔に書いてください。第三者機関（ThoughtWorks 等）の評価であるかのような表現や、確認できない本番利用実績は書かないでください。

## 解決する主要な課題とアーキテクチャ
※必須：このセクション内に、コンポーネント構成やデータフローを示すMermaidダイアグラム（\`\`\`mermaid ... \`\`\` / graph TD 等）を必ず1つ以上含めて視覚的に図解してください。

## 競合ツール/商用SaaSとの徹底比較
## 商用利用可否 & ライセンス考察


=== NOTE ARTICLE ===
# 海外急上昇OSS「${repo.name}」商用化マニュアル｜社内DX提案書・工数見積 ＆ 自社SaaS構築手順付き

## はじめに：なぜ今、注目されているのか？
（無料公開エリア：魅力的な導入、解決する課題、革新性の概要）
※重要：冒頭で「この記事で、クライアントへの導入提案に必要な材料（提案書・工数見積・導入手順）がそろう理由」を明確に提示してください。

## 主な機能とアーキテクチャ概要
（無料公開エリア：技術的な特徴、クイックスタート手順）

### 📊 商用化・受託開発シミュレーション早見表
| 項目 | 分析結果 |
|---|---|
| **想定受託開発規模** | 有料エリアの工数見積表の合計に基づく概算 |
| **主な想定クライアント** | DX推進企業 / AI内製化チーム / スタートアップ |
| **商用SaaS化の狙い目** | 独自ワークフロー特化型マイクロSaaS |
| **実装・導入難易度** | 中級（Docker / API連携 / TypeScript/Python） |

### 🔒 有料エリアで完全公開する実践ナレッジ
- そのまま出せる「社内DX・AI導入提案書 Markdown完全版」
- クライアント提示用「詳細工数・見積シミュレーション表」
- 公式READMEに基づく「導入手順（Docker Compose は対応している場合のみ）」
- 導入検討で出る懸念への「想定問答集」

> 💡 **【投資対効果（ROI）と会社経費精算について】**
> 本記事の価格は **980円** です。有料エリアには、受託提案や社内導入の検討にそのまま使える『提案書テンプレート』『工数見積表』『公式READMEに基づく導入手順』をまとめています。
> ※領収書は購入後、note の「購入・チップ履歴」から発行できます。経費精算の可否は所属先の規程をご確認ください。

--------------------------------------------------
【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】
--------------------------------------------------

## 💡 このOSSを活用した具体的なマネタイズ戦略（受託・自社サービス化）
※極めて重要：有料ライン以降は購入者が「980円以上の価値があった」と絶賛する超高密度な実用情報（最低2,000文字以上）を執筆してください。絶対に数行で要約を終わらせたり途中で切らないこと。
1. クライアントへの提案シナリオと受託開発モデル（想定規模は下記の工数見積表から算出、提案先ターゲット、ペイン、受注構成案を具体的に深掘り）
2. 自社マイクロSaaS / 有料ツールとしての構築アイデア（具体的なプロダクト名、機能要件、ターゲット価格設定を2つ以上提示）
3. 競合ツール（商用SaaS）に対する圧倒的なコスト削減提案の作り方（価格差比較テーブル、意思決定者を説得する営業キラーフレーズ）

## 📋 【コピペで即提案】社内DX・AI導入提案書 Markdown完全版
※重要：以下の骨子を満たす、クライアントへそのまま提出できる完全な提案書Markdownを具体的に出力してください：
- 【案件名】
- 【導入目的と解決する課題】
- 【システム全体構成図（ASCIIまたは構成説明）】
- 【期待される投資対効果（ROI・工数削減率）】
- 【概算導入スケジュール（4週間〜8週間プラン）】

## 💰 【クライアント提示用】詳細工数・見積シミュレーション表
※要件定義、環境構築、カスタマイズ実装、テスト、運用引き継ぎの各人日・単価・小計・合計を明記した具体的な見積テーブルを出力してください。

## 🛠️ 本番導入手順（公式README準拠）
※READMEに記載された公式の導入手順（公式Dockerイメージ／docker-compose がREADMEにある場合はそれ）に基づく \`\`\`docker-compose.yml\`\`\` と \`\`\`.env.example\`\`\` を出力してください。READMEに公式イメージの記載がない場合は、架空のイメージ名を作らず、その旨を明記したうえでREADMEのインストール手順（ソースからのビルド等）を示してください。

## ⚡ 【2026年最新規格】Claude Desktop / Cursor 用 MCP サーバー構築 ＆ .cursorrules 完全定義
※READMEにMCPサーバーとしての起動方法が記載されている場合のみ、その手順に基づくMCPサーバーJSON（\`\`\`json { "mcpServers": ... } \`\`\`）を出力してください。記載がない場合はJSONを作らず「公式のMCPサーバー手段は案内されていない」と明記してください。あわせて、AIコーディング用の \`\`\`.cursorrules\`\`\` 定義を出力してください。

## 🗣️ 【成約率を最大化する】クライアントへの営業キラーフレーズ＆想定問答
- 経営層・CTOから出る典型的な懸念（セキュリティ、保守性、障害対応）に対する説得回答テンプレートを提示。

## まとめと今後の展望
- 先行者利益を獲得するための即座のアクションプラン

---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
${noteHashtags(repo).join(" ")}

=== X THREAD ===
※重要規則：
1. TWEET 1には必ず末尾に「${X_LINK_LABEL}\nhttps://ssk0224.github.io/auto-tech-radar/radar/REPO_SLUG/」を配置すること。全体の文字数は全角110文字以内厳守（X文字数140文字制限対策）。
2. TWEET 2はURLなし。全角100文字以内厳守。
3. TWEET 3は補足まとめ。全角100文字以内厳守。

[TWEET 1]
【海外OSS解説】
GitHubで★${repo.stargazers_count}の「${repo.name}」が凄い。
${repo.description.slice(0, 45)}...
${X_LINK_LABEL}
https://ssk0224.github.io/auto-tech-radar/radar/REPO_SLUG/

[TWEET 2]
【従来のツールとの違い】
（革新的な点を全角80文字以内で端的に要約。URLなし。速度・コスト等の数値は README に書かれているものだけを使い、「1/10」「◯倍」など根拠のない比較は書かない）

[TWEET 3]
【💡 実務キットは note で】
導入提案書テンプレート・工数見積表・公式READMEに基づく導入手順は note の有料記事で公開中。
${X_LINK_LABEL}
https://ssk0224.github.io/auto-tech-radar/radar/REPO_SLUG/

`;

  const models = ["gemini-2.5-flash"];
  let lastError = null;

  for (const model of models) {
    const maxRetriesPerModel = 2;
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`Generating with model: ${model} (attempt ${attempt}/${maxRetriesPerModel})`);
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });

        const text = response.text || "";
        if (text.includes("=== WEB ARTICLE ===") && text.includes("=== NOTE ARTICLE ===") && text.includes("=== X THREAD ===")) {
          return await parseGeneratedOutput(text, repo, today);
        } else {
          console.warn(`[Gemini Format Warning] Model ${model} output was incomplete or missing section headers (needs WEB, NOTE, and X THREAD).`);
        }

      } catch (err) {
        lastError = err;
        // 日次の無料枠・課金枠を使い切った 429 は、待っても次の候補でも通らない。再試行せずに実行全体を止める
        if (isQuotaExhausted(err)) throw err;
        const isTransient = /503|429|500|resource_exhausted|unavailable|overloaded|timeout|fetch failed|econnreset|etimedout/i.test(err.message);
        console.warn(`Model ${model} attempt ${attempt} failed: ${err.message}`);

        if (attempt < maxRetriesPerModel && isTransient) {
          const waitTime = attempt * 3000;
          console.log(`Waiting ${waitTime}ms before retrying ${model}...`);
          await sleep(waitTime);
          continue;
        }
        break; // 非リトライ可能エラー、または最大試行回数到達時は次のモデルへフォールバック
      }
    }
  }

  throw lastError || new Error("All Gemini models failed");
}

// frontmatter（先頭の --- ～ ---）の key: を value に置き換える。無ければ末尾に足す
function setFrontmatterField(content, key, value) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return content;
  const re = new RegExp(`^${key}:.*$`, "m");
  const fm = re.test(m[1]) ? m[1].replace(re, `${key}: ${value}`) : `${m[1]}\n${key}: ${value}`;
  return content.replace(m[0], m[0].replace(m[1], fm));
}

// Gemini の利用枠切れ（429 RESOURCE_EXHAUSTED / "exceeded your current quota"）。一時的な混雑（503）とは区別する
function isQuotaExhausted(err) {
  return /exceeded your current quota|quota exceeded|RESOURCE_EXHAUSTED/i.test(err?.message || '');
}

// マークダウン構文・テーブル・異常空白サニタイズ
function sanitizeMarkdownContent(raw) {
  return raw.split('\n').map(line => {
    let l = line;
    // マークダウンテーブルの区切り行で20文字以上の連続ハイフンを正規化（35k〜770k文字の破綻を完全抑止）
    if (l.includes('|')) {
      l = l.replace(/ {2,}/g, ' ');
      l = l.replace(/:?-{20,}:?/g, ':---');
    }
    // 50文字以上の暴走連続空白のクレンジング
    l = l.replace(/ {50,}/g, ' ');
    return l;
  }).join('\n');
}


// Zennトピック規格（半角英数字・ハイフン・アンダースコアのみ）サニタイザー
function sanitizeZennTopic(topic) {
  if (!topic) return "tech";
  let t = String(topic).toLowerCase().trim();
  if (t === "c++") return "cpp";
  if (t === "c#") return "csharp";
  t = t.replace(/[^a-z0-9_-]/g, "");
  return t || "programming";
}

// 出力テキストを各ファイル用にパース
async function parseGeneratedOutput(rawText, repo, today) {
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
    webContent = webContent.replace(/^---\r?\n/, '---\nlayout: "../../layouts/Layout.astro"\n');
  }

  // 公開日・リポジトリ URL・スター数は生成モデルの出力ではなく実データで上書きする
  // （日付が違うと 1 日の生成本数の上限が効かず、スター数が違うと事実と異なる表示になる）
  webContent = setFrontmatterField(webContent, "pubDate", `"${today}"`);
  webContent = setFrontmatterField(webContent, "repoUrl", `"${repo.html_url}"`);
  webContent = setFrontmatterField(webContent, "stars", String(repo.stargazers_count));

  // サニタイズ＆品質不変条件ガード
  webContent = sanitizeMarkdownContent(webContent);
  webContent = fixMermaidInContent(webContent);
  webContent = stripProSection(webContent);
  // ページの h1 は 1 つだけ（生成モデルが本文の章見出しにも # を使うことがある）
  webContent = normalizeHeadings(webContent, repo.name);
  if (!webContent.includes("```mermaid")) {
    // 汎用の架空構成図で埋めず、この生成結果は採用しない
    throw new Error("Web記事にMermaid構成図が含まれていません");
  }
  // 補正しても Mermaid の構文上の問題が残る生成結果は採用しない（テスト・監査と同じ検査）
  const mermaidIssues = mermaidProblems(webContent);
  if (mermaidIssues.length > 0) throw new Error(`Mermaid図に問題があります: ${mermaidIssues.join(" / ")}`);
  // サイトと同じ版の Mermaid で実際に解析し、描画できない図を含む記事は採用しない
  const parseErrors = await mermaidParseErrors(webContent);
  if (parseErrors.length > 0) throw new Error(`Mermaid図を描画できません: ${parseErrors.join(" / ")}`);

  // バッククォートの不整合があれば補正
  const backtickCount = (webContent.match(/```/g) || []).length;
  if (backtickCount % 2 !== 0) {
    webContent += "\n```\n";
  }

  noteContent = sanitizeMarkdownContent(noteContent);

  let slug = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || slug.length === 0) {
    slug = `repo-${repo.id || Math.floor(Math.random() * 100000)}`;
  }
  xContent = xContent.replace(/REPO_SLUG/g, slug);

  // X投稿文にワンクリック投稿リンクを付加（厳密な140文字制限・リンク保証）
  let enhancedXContent = `==================================================\n📱 ${repo.name} X (Twitter) 投稿用スレッド\n==================================================\n\n`;
  const tweets = xContent.split(/\[TWEET \d+\]/gi).map((t) => t.trim()).filter(Boolean);

  if (tweets.length === 0) {
    throw new Error("X投稿スレッドが正しく生成されていません（ツイート数不足）");
  }

  tweets.forEach((rawTweet, idx) => {
    let tweet = rawTweet.replace(/REPO_SLUG/g, slug);
    let intentUrl = '';

    if (idx === 0) {
      // 第1ツイートは必ず記事リンクを付加し、140文字（280 weight）厳守で安全整形
      const safeData = sanitizeAndAttachUrlToTweet(tweet, slug);
      tweet = safeData.tweet;
      intentUrl = safeData.intentUrl;
    } else {
      const lines = tweet.split("\n");
      if (lines.length > 5) {
        tweet = lines.slice(0, 5).join("\n");
      }
      intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    }

    const tweetNum = idx + 1;
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

// 既存記事のURLおよびスラグ一覧を取得（完全な重複生成防止）
function getExistingIndexedData(webDir) {
  const existingUrls = new Set();
  const existingSlugs = new Set();

  if (!fs.existsSync(webDir)) return { existingUrls, existingSlugs };

  const files = fs.readdirSync(webDir).filter((f) => f.endsWith(".md"));
  for (const f of files) {
    const slug = f.replace(/\.md$/, "").toLowerCase();
    existingSlugs.add(slug);

    try {
      const content = fs.readFileSync(path.join(webDir, f), "utf8");
      const m = content.match(/repoUrl:\s*["']([^"']+)["']/i);
      if (m && m[1]) {
        existingUrls.add(m[1].trim().toLowerCase().replace(/\/$/, ""));
      }
    } catch (e) {}
  }
  return { existingUrls, existingSlugs };
}

async function run() {
  console.log("=== Auto Tech Radar Pipeline 4.0 (Web + note有料 + X + Zenn一括生成) ===");

  const webDir = path.resolve("src/pages/radar");
  const noteDir = path.resolve("note_drafts");
  const xDir = path.resolve("x_posts");
  const zennDir = path.resolve("zenn_drafts");
  const articlesDir = path.resolve("articles");

  [webDir, noteDir, xDir, zennDir, articlesDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 既存のインデックス済みデータ（URL & スラグ）を事前ロードして完全重複排除
  const { existingUrls, existingSlugs } = getExistingIndexedData(webDir);
  console.log(`インデックス済み既存記事: ${existingSlugs.size} 件 (重複防止テーブルを有効化)`);

  // 多重スケジュール（遅延救済バックアップ便）実行時の安全ガード：本日分が既に生成済みならスキップ
  const jstToday = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  let todayCount = 0;
  if (fs.existsSync(webDir)) {
    const existing = fs.readdirSync(webDir).filter((f) => f.endsWith(".md"));
    for (const f of existing) {
      try {
        const c = fs.readFileSync(path.join(webDir, f), "utf8");
        if (new RegExp(`pubDate:\\s*["']?${jstToday}["']?`).test(c)) {
          todayCount++;
        }
      } catch (e) {}
    }
  }

  if (todayCount >= TARGET_NEW_COUNT) {
    console.log(`✓ 本日（${jstToday} JST）の目標記事（${todayCount}本）はすでに生成完了しています。冗長便のため安全に終了します。`);
    return;
  }

  // 急上昇OSSの探索（既存記事のURL/スラグは除外済み）
  const repos = await fetchTrendingRepos(existingUrls, existingSlugs);
  if (repos.length === 0) {
    console.log("ℹ️ 新規候補リポジトリが見つかりませんでした（全件インデックス済み、または一時的なGitHub検索制限）。安全に終了します。");
    return;
  }

  let generatedCount = 0;
  let attempts = 0;
  const rejections = [];

  for (const repo of repos) {
    if (attempts >= MAX_ATTEMPTS_PER_RUN) {
      console.log(`試行上限（${MAX_ATTEMPTS_PER_RUN}件）に達したため終了します。`);
      break;
    }
    if (todayCount + generatedCount >= TARGET_NEW_COUNT) {
      console.log(`Reached target count (${TARGET_NEW_COUNT}). Pipeline completed.`);
      break;
    }

    const slug = repo.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const webFile = path.join(webDir, `${slug}.md`);
    const noteFile = path.join(noteDir, `${slug}_note.md`);
    const xFile = path.join(xDir, `${slug}_x.txt`);
    const zennFile = path.join(zennDir, `${slug}_zenn.md`);

    // 二重チェック
    const normUrl = (repo.html_url || "").toLowerCase().replace(/\/$/, "");
    if (fs.existsSync(webFile) || existingSlugs.has(slug) || existingUrls.has(normUrl)) {
      console.log(`Skip duplicate: ${repo.full_name} (${slug})`);
      continue;
    }

    attempts++;
    console.log(`\n[${generatedCount + 1}/${TARGET_NEW_COUNT}] Processing: ${repo.full_name}`);
    const readme = await getReadme(repo.owner.login, repo.name);
    if (!readme || readme.length < 50) {
      console.log(`Skip (no readme or too short): ${repo.full_name}`);
      rejections.push(`${repo.full_name}: READMEが不十分`);
      continue;
    }

    try {
      const result = await generateAllContent(repo, readme);

      // 有料部分は公開リポジトリに平文で置かない。有料ラインが無い原稿は有料部分を切り分けられないので採用しない
      if (!splitPaid(result.note)) {
        throw new Error("note原稿に有料ラインがありません（有料部分を暗号化できないため不採用）");
      }
      // 推奨ハッシュタグは生成モデルの出力ではなく、記事の対象（言語・トピック）から作ったもので揃える
      const noteText = applyNoteHashtags(withStandardFooter(result.note), noteHashtags(repo));
      const problems = noteDraftProblems(noteText);
      if (problems.length) {
        throw new Error(`note原稿が要件を満たしません（${problems.join(" / ")}）`);
      }
      // 実在しないイメージ・パッケージを購入者に渡さない
      const missing = await findMissingReferences(`${noteText}\n${result.web}`);
      if (missing.length) {
        throw new Error(`実在を確認できない参照があります（${missing.join(", ")}）`);
      }
      if (/"mcpServers"/.test(noteText) && !/mcp/i.test(readme)) {
        throw new Error("READMEにMCPの記載が無いのにMCP設定が含まれています");
      }
      // 禁止表現・誇張表現の有無を厳格検査（テスト・監査と共通定義）
      const forbiddenHits = [
        ...findForbiddenClaims(noteText),
        ...findForbiddenClaims(result.web),
        ...findForbiddenClaims(result.x)
      ];
      if (forbiddenHits.length) {
        throw new Error(`生成文面に禁止・誇張表現が含まれています（${forbiddenHits.join(" / ")}）`);
      }
      // プロンプトで禁止した誇張・結果保証の表現（一発起動・爆発的・収入の金額など）が残っていれば採用しない（新規生成物だけの検査）
      const hypeHits = [...findHype(noteText), ...findHype(result.web), ...findHype(result.x)];
      if (hypeHits.length) {
        throw new Error(`生成文面に誇張・結果保証の表現が含まれています（${hypeHits.join(" / ")}）`);
      }

      // X投稿スレッドの完全性検証（途中で切れた不完全なスレッドの書き込み防止）
      const cleanXBody = (result.x || "").replace(/^[=\-\s\n📱]+.*?X \(Twitter\) 投稿用スレッド[=\-\s\n]+/m, "").trim();
      if (!result.x || result.x.length < 200 || cleanXBody.length < 50) {
        throw new Error(`X投稿スレッドが不完全または不足しています（全体: ${result.x ? result.x.length : 0}B, 本文: ${cleanXBody.length}文字）`);
      }

      // Web記事のコードブロック構文不変条件保証（未クローズのバッククォートを自動補正）
      const webBackticks = (result.web.match(/```/g) || []).length;
      if (webBackticks % 2 !== 0) {
        result.web += "\n```\n";
      }

      writeSealedNote(noteFile, noteText);

      console.log(`✓ note有料記事ドラフト保存（有料部分は暗号化）: ${noteFile}`);

      fs.writeFileSync(webFile, result.web, "utf8");
      console.log(`✓ Web記事保存: ${webFile}`);

      fs.writeFileSync(xFile, result.x, "utf8");
      console.log(`✓ X投稿文（ワンクリックURL付）保存: ${xFile}`);

      // Zenn / Qiita 送客用ドラフト自動生成（アーキテクチャまでで確実にカットし、自社サイトへ完全送客）
      const cleanBody = result.web.replace(/^---[\s\S]*?---\n*/, "").trim();
      let teaserBody = cleanBody;
      const cutRegex = /##\s*(?:[💡🛠️📋💰⚡]\s*)?(?:【Auto Tech Radar PRO限定】|商用化マニュアル|1-Click MCP|MCP|ビジネス|マネタイズ|収益化|インストール|クイックスタート|社内DX|詳細工数|即時本番)/i;
      const cutMatch = teaserBody.match(cutRegex);
      if (cutMatch && cutMatch.index > 200) {
        teaserBody = teaserBody.substring(0, cutMatch.index).trim();
      } else {
        const cutMarkers = [
          "## 🛠️ 【Auto Tech Radar PRO限定】",
          "## ⚡ 1-Click MCP",
          "## 💡 ビジネス・マネタイズ活用アイデア",
          "## 💡 このOSSを活用した具体的なマネタイズ戦略",
          "## インストール & クイックスタート手順",
        ];
        for (const m of cutMarkers) {
          const idx = teaserBody.indexOf(m);
          if (idx !== -1) {
            teaserBody = teaserBody.substring(0, idx).trim();
            break;
          }
        }
      }

      // 構文不変条件保証: コードブロックが途中で切れていれば確実に閉じる
      const backtickCount = (teaserBody.match(/```/g) || []).length;
      if (backtickCount % 2 !== 0) {
        teaserBody += "\n```";
      }

      // Zenn公式トピック規格（半角英数字・ハイフン・アンダースコアのみ、1〜5個）厳格適合
      const langTopic = sanitizeZennTopic(repo.language);
      const repoTopics = Array.isArray(repo.topics) ? repo.topics.map(sanitizeZennTopic) : [];
      const topicCandidates = [langTopic, ...repoTopics, "oss", "github", "architecture", "programming"];
      const zennTopics = Array.from(new Set(topicCandidates.filter((t) => /^[a-z0-9_-]+$/.test(t)))).slice(0, 5);

      // Zenn への自動公開は停止（2026-10-21）。Zenn の規約（機械生成の文章・宣伝目的のコンテンツの禁止）に沿わないため、
      // 原稿は残すが published: false（下書き）で書き、articles/ に置いても Zenn の GitHub 連携で公開されないようにする
      const zennDraft = `---
title: "【徹底解剖】海外急上昇OSS「${repo.name}」のアーキテクチャと商用展開"
emoji: "⚡"
type: "tech"
topics: ${JSON.stringify(zennTopics)}
published: false
---

${teaserBody}

---

${zennCta(slug)}
`;
      fs.writeFileSync(zennFile, zennDraft, "utf8");
      console.log(`✓ Zenn/Qiita送客ドラフト保存: ${zennFile}`);

      // 📘 Zenn公式GitHub連携の形式 (articles/*.md) で保存（文字数12〜50文字厳格保証）。published: false のため公開はされない
      let zennSlug = slug;
      if (zennSlug.length < 12) zennSlug = `${zennSlug}-tech-radar`;
      if (zennSlug.length > 50) zennSlug = zennSlug.slice(0, 50).replace(/[-_]+$/, "");
      if (zennSlug.length < 12) zennSlug = (zennSlug + "-radar").slice(0, 50);

      let finalZennSlug = zennSlug;
      let collisionIdx = 1;
      while (fs.existsSync(path.join(articlesDir, `${finalZennSlug}.md`))) {
        finalZennSlug = `${zennSlug.slice(0, 45)}-${collisionIdx}`;
        collisionIdx++;
      }
      const zennArticleFile = path.join(articlesDir, `${finalZennSlug}.md`);
      fs.writeFileSync(zennArticleFile, zennDraft, "utf8");
      console.log(`✓ Zenn原稿を下書き（published: false）で保存 (articles/): ${zennArticleFile}`);

      try {
        const topics = Array.isArray(repo.topics) ? repo.topics : [];
        const combinedTags = [repo.language, ...topics, "OSS"].filter(Boolean);
        generateOgCardForPost({
          slug,
          title: repo.name,
          stars: repo.stargazers_count,
          tags: combinedTags,
          desc: repo.description,
        });
        console.log(`✓ 個別OGPカード（SVG ＆ PNG）自動生成完了: public/ogp/${slug}.png`);
      } catch (ogpErr) {
        console.warn(`OGP生成スキップ: ${ogpErr.message}`);
      }

      // OGP PNG存在保証（監査ゲート100%パスのフェイルセーフ）
      const pngPath = path.join(path.resolve("public/ogp"), `${slug}.png`);
      if (!fs.existsSync(pngPath)) {
        const defaultOg = path.resolve("public/og-card.png");
        if (fs.existsSync(defaultOg)) {
          fs.copyFileSync(defaultOg, pngPath);
          console.log(`✓ OGP PNGフォールバック配置: public/ogp/${slug}.png`);
        }
      }

      // インデックス済みセットに追加
      existingSlugs.add(slug);
      existingUrls.add(normUrl);
      generatedCount++;

      if (generatedCount < TARGET_NEW_COUNT) {
        await sleep(3000);
      }
    } catch (err) {
      console.error(`Failed to process ${repo.full_name}: ${err.message}`);
      rejections.push(`${repo.full_name}: ${err.message}`);
      // ロールバック: 途中で失敗した場合は不完全なファイルを削除して安全な状態を維持
      const cleanupTargets = [
        webFile,
        noteFile,
        sealedFileFor(noteFile),
        noteFile.replace(/\.md$/, ".paid.json"),
        xFile,
        zennFile,
        path.join(articlesDir, `${slug}.md`),
        path.join(articlesDir, `${slug}-tech-radar.md`),
        path.join(path.resolve("public/ogp"), `${slug}.png`),
        path.join(path.resolve("public/ogp"), `${slug}.svg`)
      ];
      for (const f of cleanupTargets) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
      if (isQuotaExhausted(err)) {
        console.log(`::warning title=Gemini quota exhausted::Gemini API の利用枠を使い切ったため、残りの候補の生成を中止しました（枠が戻る次回の実行で再開します）。`);
        break;
      }

    }
  }

  console.log(`\nPipeline finished. Total new packages created: ${generatedCount}`);
  if (generatedCount === 0 && attempts > 0) {
    // GitHub Actions の実行結果に警告として表示する（無言で記事ゼロの日を作らない）
    console.log(`::warning title=No new article::候補 ${attempts} 件をすべて不採用にしました: ${rejections.join(" | ").slice(0, 900)}`);
  }
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
