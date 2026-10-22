import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateOgCardForPost } from "./generate_og_cards.mjs";
import { splitPaid, writeSealedNote, noteDraftProblems, publicNoteProblems, sealedFileFor } from "./utils/note_vault.mjs";
import { normalizeReceiptLine, receiptProblems } from "./utils/receipt.mjs";

import { findMissingReferences } from "./utils/reference_check.mjs";
import { zennCta } from "./utils/funnel_copy.mjs";
import { NOISE_FILTER_REGEX } from "./utils/noise_filter.mjs";
import { findForbiddenClaims, findWebArticleClaims, WEB_CLAIMS_PROMPT_RULE } from "./utils/claims_check.mjs";
import { resolveLicense, licensePromptText, licenseStatementProblems, LICENSE_PROMPT_RULE } from "./utils/license_resolver.mjs";
import { findHype, HYPE_PROMPT_RULE, findUnverifiablePraise, UNVERIFIABLE_PRAISE_PROMPT_RULE } from "./utils/hype_check.mjs";
import { trendingSearchQueries, searchReposUrl } from "./utils/github_queries.mjs";
import { resolveModelOrder, classifyGeminiError, GeminiStopError } from "./utils/gemini_models.mjs";
import { recordRunStatus as writeRunStatus, jstDate as jstToday } from "./utils/run_status.mjs";
import { rankCandidates, watchlistDocument, pubDateProblem, SELECTION_CONFIG, REJECTION_REASONS } from "./utils/selection.mjs";
import { slugForRepoName } from "./utils/blocklist.mjs";
import { isPublishedOn, radarArticlesOnRef, fetchOriginMain } from "./utils/published_articles.mjs";
import { unwrapMarkdownFence, sanitizeMarkdownContent, finalWebArticleProblems } from "./utils/generated_content.mjs";
import { readmeFacts, ungroundedTokens, factsFileFor, renderableDiagrams } from "./utils/readme_facts.mjs";
import { WEB_H2, LLM_OVERVIEW_H2, NOTE_FIXED_TEXT, paidHeadingsToBold } from "./utils/article_template.mjs";
import { renderWebPage, webPageProblems, noteHeadProblems, noteTailProblems, renderNoteDraft } from "./utils/page_shape.mjs";
import { parseQuotes, QUOTE_LINE } from "./utils/anchored.mjs";
import { xThreadText } from "./utils/x_thread.mjs";
import { findProLeaks } from "./utils/pro_boundary.mjs";
import { normalizeEol } from "./utils/eol.mjs";
import { paidContentSummary } from "./utils/note_vault.mjs";

// 不採用の理由。ログ（公開リポジトリの Actions ログ）には規則の名前だけを出し、一致した文面（有料本文の断片を含みうる）は出さない（leakhunt C4、2026-10-22）
class Rejection extends Error {
  constructor(ruleIds) {
    super([...new Set(ruleIds)].join(" / "));
    this.name = "Rejection";
  }
}
// 検査結果の文から、一致した文面などの詳細（末尾の ("…")・（…）・": …"）を除いた規則の名前だけを取り出す
const ruleId = (s) => String(s).replace(/\s*\(".*$/s, "").replace(/:\s.*$/s, "").replace(/\s*[（(][^（()）]*[）)]\s*$/, "").trim();
const readmeFixedFacts = readmeFacts(NOTE_FIXED_TEXT, {});

// 実行結果（data/run_status）は、どの終わり方でも必ず 1 回記録する（記録の無い日は、アラートが理由を示せない）
let runStatusRecorded = false;
function recordRunStatus(run) {
  runStatusRecorded = true;
  return writeRunStatus(run);
}

// 記事のスラグ（ページ・原稿のファイル名と X 投稿文のリンク）は scripts/utils/blocklist.mjs の 1 つの規則で作る
const slugOf = (repo) => slugForRepoName(repo.name) || `repo-${repo.id}`;

// Gemini の 1 回の呼び出しを待つ上限（応答が返らないまま CI の実行が何時間も止まらないように）。テストでは短くする。
// 記事 3 点を一度に書く長い出力でも通常は数分以内に返るため、正常な応答を切らないよう余裕を持たせる
// （全モデルが時間切れでも 4 モデル × 6 分で止まり、workflow の生成ステップの上限 60 分に収まる）
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 6 * 60 * 1000;
function withTimeout(promise, ms, what) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${what} timed out after ${ms}ms（時間切れ）`), { timedOut: true })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("⚠️ Warning: GEMINI_API_KEY is not set. Skipping crawl and generation gracefully.");
  // 定期実行で鍵が消えていた場合も「記事 0 本」の理由として残す（scripts/alert_if_no_article.mjs が拾う）
  recordRunStatus({ generated: 0, reason: "error" });
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
  // 検索クエリは scripts/utils/github_queries.mjs（日次スナップショットと共通）
  const queries = trendingSearchQueries();

  const candidateMap = new Map();

  for (const q of queries) {
    const url = searchReposUrl(q);
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
    if (existingSlugs.has(slugOf(r))) {
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

// ライセンスは GitHub の検索結果の表示（"Other" 等）ではなく LICENSE ファイルの本文から判定する（2026-10-21）。
// 生成プロンプトと生成後の検査で同じ判定結果を使うため、リポジトリごとに 1 回だけ取得する
const licenseCache = new Map();
function licenseFor(repo) {
  if (!licenseCache.has(repo.full_name)) {
    licenseCache.set(repo.full_name, resolveLicense(repo.owner.login, repo.name, { headers: getGithubHeaders() }));
  }
  return licenseCache.get(repo.full_name);
}

// 有料部分の作り方（節の構成と分量）は公開リポジトリに置かない（leakhunt #51、2026-10-22）。CI の秘密 NOTE_PAID_RECIPE
// （またはオーナー端末の NOTE_PAID_RECIPE_FILE が指すファイル）にあるときだけ、生成モデルに note の有料部分を書かせる。無ければ Web 記事と X だけを作る
function paidRecipe() {
  if (process.env.NOTE_PAID_RECIPE) return process.env.NOTE_PAID_RECIPE.trim();
  const f = process.env.NOTE_PAID_RECIPE_FILE;
  if (f && fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  return "";
}

// 1回のAI呼び出しで「Web記事に載せる README の原文」と（有料部分の作り方があれば）「note有料記事の有料部分」を一括生成する
// today: 実行開始時に決めた日本時間の日付（本日分の上限の判定と同じ日付を公開日にする）
// 公開する部分に生成モデルが書くのは、README から選んだ文（原文そのもの）だけ（scripts/utils/anchored.mjs）。訳は書かせない
// （訳は README と機械的に照合できない）。リード・成熟度・インストール・ライセンス・図・note の無料部分と末尾・X は、
// 生成スクリプトがデータから決まった形で作る（scripts/utils/page_shape.mjs。leakhunt C3、2026-10-22）
async function generateAllContent(repo, readme, recipe) {
  const licenseName = licensePromptText(await licenseFor(repo));

  const systemInstruction = `
あなたはオープンソース（OSS）の README から、内容を表す文を選ぶ編集者です。
README とリポジトリ情報だけを根拠に、次を作成してください。
1. Web記事に載せる README の文（README の文を選び、そのまま書き写したもの）
${recipe ? "2. note有料記事の有料部分の本文\n" : ""}
必ず指定のデリミタ（=== SECTION === の形）で正確に区切って出力してください。

【README の文の書き方】
- 1 文につき 1 行、「${QUOTE_LINE}」に続けて README の文をそのまま書くこと。言い換え・要約・省略・連結・翻訳をしないこと。
- 生成後に README と照合し、README の文と 1 文字でも違えば採用しない。
- 日本語の訳・説明・段落・表・図（Mermaid）・コードブロック・ほかの見出しは書かないこと（生成スクリプトが README・LICENSE ファイル・リポジトリの記録から作る）。
${recipe ? `
【有料部分の事実性】
- Dockerイメージ名、パッケージ名、CLIコマンド、ポート番号、設定キー、MCPサーバーの起動方法は、与えられたREADMEに記載があるものだけを使うこと。記載がないものを推測で作らないこと。
- READMEにMCPサーバーとしての起動方法の記載がない場合は、mcpServers の設定例を作らないこと。
- 金額は、見積表の工数×単価のように計算の前提を示せるものだけを書くこと。ROI・削減率・性能値の予測は書かないこと。
- 導入実績・連携実績・顧客数・受賞歴など、READMEで確認できない実績は書かないこと。
- README が利用を学習用途・非商用などに限っている場合は、収益化・商用展開の節を書かないこと。

【誇張・結果保証の禁止】
${HYPE_PROMPT_RULE}
${UNVERIFIABLE_PRAISE_PROMPT_RULE}
${WEB_CLAIMS_PROMPT_RULE}

【ライセンス】
${LICENSE_PROMPT_RULE}
` : ""}
`;

  const prompt = `
以下のGitHubリポジトリ情報を基に作成してください。

[リポジトリ情報]
名前: ${repo.full_name}
URL: ${repo.html_url}
言語: ${repo.language}
ライセンス: ${licenseName}
概要: ${repo.description}

[README]
${readme || "(READMEなし)"}

--------------------------------------------------
以下のフォーマット通りに出力してください。余計な挨拶は不要です。

=== WEB ARTICLE ===
${LLM_OVERVIEW_H2}
（README に書かれている目的を表す README の文を 3 つ）

${WEB_H2.architecture}
（README に書かれている主な機能・構成を表す README の文を 4〜6 つ）
${recipe ? `
=== NOTE ARTICLE ===
※ここには note 有料記事の有料部分の本文だけを書くこと（題名・無料部分・価格の案内・有料ライン・末尾の案内・ハッシュタグは生成スクリプトが書く）。
※Markdown の見出し（# で始まる行）を使わず、各節の題は **太字の行** で書くこと（note の目次に見出しが表示されるため）。

${recipe}
` : ""}
`;

  const { text, model } = await callGemini(prompt, systemInstruction, { needNote: Boolean(recipe) });
  return { ...parseGeneratedOutput(text), model };
}

// この実行で使えないと分かったモデル（404 等）と、利用枠を使い切ったモデル（429）は、以降の候補でも呼ばない
let modelOrderPromise = null;
const unavailableModels = new Set();
const quotaModels = new Set();
// 応答が時間切れになったモデル。この実行では以降呼ばない（待ち続けて実行が何時間も延びないように）
const timedOutModels = new Set();
const skipModel = (m) => unavailableModels.has(m) || quotaModels.has(m) || timedOutModels.has(m);
// 全モデルが使えないときに実行を止める理由（run_status の reason）
const stopReasonOf = (models) => (models.some((m) => quotaModels.has(m)) ? "quota" : models.some((m) => unavailableModels.has(m)) ? "model_unavailable" : "error");

// Gemini を呼び出し、3 セクションがそろった出力とそのモデル名を返す。
// - 404 / not found / is not supported / deprecated … 次のモデルへ
// - 429 / RESOURCE_EXHAUSTED（利用枠切れ）… 利用枠はモデルごとなので、そのモデルだけ以降は使わず次のモデルへ。
//   すべてのモデルが枠切れ（または使えない）なら実行全体を止める（GeminiStopError "quota"）
// - 5xx 等の一時的な失敗 … 同じモデルで再試行してから次のモデルへ
// - 応答が GEMINI_TIMEOUT_MS 以内に返らない … そのモデルは以降呼ばず次のモデルへ
// - すべてのモデルが使えない … 実行全体を止める（GeminiStopError "model_unavailable"、時間切れだけなら "error"）
// needNote: note の有料部分も求めたとき（有料部分の作り方があるとき）は NOTE の節もそろっていること
async function callGemini(prompt, systemInstruction, { needNote = true } = {}) {
  if (!modelOrderPromise) modelOrderPromise = resolveModelOrder({ models: { list: (o) => withTimeout(ai.models.list(o), GEMINI_TIMEOUT_MS, "Gemini models.list") } });
  const order = await modelOrderPromise;
  const models = order.filter((m) => !skipModel(m));
  if (!models.length) throw new GeminiStopError(stopReasonOf(order), "利用できるモデルがありません");
  let lastError = null;

  for (const model of models) {
    const maxRetriesPerModel = 2;
    for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
      try {
        console.log(`Generating with model: ${model} (attempt ${attempt}/${maxRetriesPerModel})`);
        const response = await withTimeout(ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        }), GEMINI_TIMEOUT_MS, `Gemini ${model}`);

        const text = response.text || "";
        if (text.includes("=== WEB ARTICLE ===") && (!needNote || text.includes("=== NOTE ARTICLE ==="))) {
          return { text, model };
        }
        console.warn(`[Gemini Format Warning] Model ${model} output was incomplete or missing section headers (needs WEB and NOTE).`);
        lastError = new Error(`Model ${model} の出力に必要なセクション（WEB / NOTE）がありません`);
      } catch (err) {
        lastError = err;
        if (err?.timedOut) {
          console.warn(`Model ${model} attempt ${attempt} failed (timeout): ${err.message}`);
          timedOutModels.add(model);
          break;
        }
        const kind = classifyGeminiError(err);
        console.warn(`Model ${model} attempt ${attempt} failed (${kind}): ${err.message}`);
        // 枠を使い切った 429 は、同じモデルでは待っても次の候補でも通らない。再試行せず、このモデルを外して次のモデルへ
        if (kind === "quota") {
          quotaModels.add(model);
          break;
        }
        if (kind === "unavailable") {
          unavailableModels.add(model);
          break; // 再試行せず次のモデルへ
        }
        if (attempt < maxRetriesPerModel && kind === "transient") {
          const waitTime = attempt * 3000;
          console.log(`Waiting ${waitTime}ms before retrying ${model}...`);
          await sleep(waitTime);
          continue;
        }
        break; // 非リトライ可能エラー、または最大試行回数到達時は次のモデルへフォールバック
      }
    }
  }

  if (models.every(skipModel)) {
    throw new GeminiStopError(stopReasonOf(models), lastError || "利用できるモデルがありません");
  }
  throw lastError || new Error("All Gemini models failed");
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

// 生成モデルの出力を「Web 記事」と「note の有料部分」に分ける
function parseGeneratedOutput(rawText) {
  let web = "";
  let note = "";
  const parts = rawText.split(/=== (WEB ARTICLE|NOTE ARTICLE|X THREAD) ===/g);
  for (let i = 1; i < parts.length; i += 2) {
    const body = (parts[i + 1] || "").trim();
    if (parts[i] === "WEB ARTICLE") web = unwrapMarkdownFence(body);
    else if (parts[i] === "NOTE ARTICLE") note = sanitizeMarkdownContent(body);
  }
  return { rawWeb: normalizeEol(web), rawNote: normalizeEol(note) };
}

// Web 記事の出力から README の原文の行を読み取る。見出し 2 つと原文の行以外（訳・段落・表・図・ほかの見出し）は stray として数える
function webQuotesOf(rawWeb) {
  const sections = { pre: [], overview: [], architecture: [], other: [] };
  const headings = [];
  let cur = "pre";
  for (const line of rawWeb.split("\n")) {
    if (/^#{1,6} /.test(line)) {
      const h = line.trimEnd();
      cur = h === LLM_OVERVIEW_H2 ? "overview" : h === WEB_H2.architecture ? "architecture" : "other";
      if (cur === "other") headings.push(h);
      continue;
    }
    sections[cur].push(line);
  }
  const ov = parseQuotes(sections.overview);
  const ar = parseQuotes(sections.architecture);
  const stray = [...sections.pre, ...sections.other].filter((l) => l.trim()).length + ov.stray.length + ar.stray.length + headings.length;
  return { overview: ov.quotes, architecture: ar.quotes, stray, otherHeadings: headings };
}

// note の出力: 有料部分の本文だけのはず。有料ラインの行があれば、その前（生成モデルが書いた無料部分）を別に返す
function notePartsOf(rawNote) {
  const lines = rawNote.split("\n");
  const at = lines.findIndex((l) => /有料ライン|ここから先は有料/.test(l));
  if (at === -1) return { free: "", paid: rawNote };
  return { free: lines.slice(0, at).join("\n"), paid: lines.slice(at + 1).join("\n") };
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

// 掲載済み記事の対象リポジトリ（選定のオーナー上限・集中の判定に使う）
function getFeaturedRepos(webDir) {
  if (!fs.existsSync(webDir)) return [];
  const out = [];
  for (const f of fs.readdirSync(webDir).filter((x) => x.endsWith(".md"))) {
    try {
      const fm = (fs.readFileSync(path.join(webDir, f), "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/) || [])[1] || "";
      const field = (k) => (fm.match(new RegExp(`^${k}:\\s*["']?([^"'\\n]*)["']?\\s*$`, "m")) || [])[1]?.trim() || null;
      const full = (field("repoUrl") || "").match(/github\.com\/([^/]+\/[^/#?]+)/)?.[1];
      if (!full) continue;
      out.push({ full_name: full, pubDate: field("pubDate"), stars: Number(field("stars")) || 0, created_at: field("repoCreatedAt") });
    } catch (e) {}
  }
  return out;
}

// 7日間のスター増加数（data/derived/velocity.json）。まだ無い場合は空（累計スター数 ÷ 経過日数で代用する）
function loadVelocity() {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(SELECTION_CONFIG.score.velocityFile), "utf8"));
  } catch (e) {
    return {};
  }
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
  // 日本時間の今日（この実行の間は固定。本日分の上限の判定と、生成する記事の公開日に同じ日付を使う）
  const today = jstToday(Date.now());
  // 手元の作業ツリーが古い（オーナー端末のランチャーから手動で実行した等）と、CI が今日すでに公開した記事を数えられず
  // 1 日に 2 本目を作ってしまうため、push 済みの記事（origin/main）も数える。取り込めない（オフライン・git でない）ときは手元だけで判定する
  const todaySlugs = new Set();
  try {
    fetchOriginMain(process.cwd());
    for (const a of radarArticlesOnRef(process.cwd(), "origin/main")) {
      existingSlugs.add(a.slug.toLowerCase());
      const url = (a.content.match(/repoUrl:\s*["']([^"']+)["']/i) || [])[1];
      if (url) existingUrls.add(url.trim().toLowerCase().replace(/\/$/, ""));
      if (isPublishedOn(a.content, today)) todaySlugs.add(a.slug);
    }
  } catch (e) {
    console.warn(`push 済みの記事（origin/main）を確認できないため、手元の記事だけで本日分を数えます: ${String(e.message).split("\n")[0]}`);
  }
  if (fs.existsSync(webDir)) {
    for (const f of fs.readdirSync(webDir).filter((x) => x.endsWith(".md"))) {
      try {
        if (isPublishedOn(fs.readFileSync(path.join(webDir, f), "utf8"), today)) todaySlugs.add(f.replace(/\.md$/, ""));
      } catch (e) {}
    }
  }
  const todayCount = todaySlugs.size;

  if (todayCount >= TARGET_NEW_COUNT) {
    console.log(`✓ 本日（${today} JST）の目標記事（${todayCount}本）はすでに生成完了しています。冗長便のため安全に終了します。`);
    recordRunStatus({ generated: 0, reason: "cap_reached" });
    return;
  }

  // 急上昇OSSの探索（既存記事のURL/スラグは除外済み）。検索は候補集めだけに使い、並べ替えは selection.mjs で行う
  const candidates = await fetchTrendingRepos(existingUrls, existingSlugs);
  if (candidates.length === 0) {
    console.log("ℹ️ 新規候補リポジトリが見つかりませんでした（全件インデックス済み、または一時的なGitHub検索制限）。安全に終了します。");
    recordRunStatus({ generated: 0, reason: "no_candidates" });
    return;
  }

  // 7日間のスター増加数とテーマで並べ、除外条件（オーナー上限・短期間の集中など）に当たる候補を外す
  const selection = rankCandidates(candidates, { velocity: loadVelocity(), featured: getFeaturedRepos(webDir), now: Date.now() });
  for (const r of selection.rejected) {
    console.log(`選定から除外: ${r.full_name}（${REJECTION_REASONS[r.reason] || r.reason}）`);
  }
  try {
    fs.mkdirSync(path.resolve("data"), { recursive: true });
    fs.writeFileSync(path.resolve("data/watchlist.json"), JSON.stringify(watchlistDocument(selection, Date.now()), null, 2) + "\n", "utf8");
    console.log(`✓ ウォッチリスト（2〜${selection.watchlist.length + 1} 位）を保存: data/watchlist.json`);
  } catch (e) {
    console.warn(`ウォッチリストの保存をスキップ: ${e.message}`);
  }
  const repos = selection.ranked.map((r) => r.item);
  if (repos.length === 0) {
    console.log("ℹ️ 選定条件を満たす候補がありませんでした。安全に終了します。");
    recordRunStatus({ generated: 0, reason: "no_candidates" });
    return;
  }

  let generatedCount = 0;
  let attempts = 0;
  const rejections = [];
  // 実行全体を止めた理由（"quota" | "model_unavailable"）と、実際に記事を生成したモデル
  let stopReason = null;
  let usedModel = null;

  for (const repo of repos) {
    if (attempts >= MAX_ATTEMPTS_PER_RUN) {
      console.log(`試行上限（${MAX_ATTEMPTS_PER_RUN}件）に達したため終了します。`);
      break;
    }
    if (todayCount + generatedCount >= TARGET_NEW_COUNT) {
      console.log(`Reached target count (${TARGET_NEW_COUNT}). Pipeline completed.`);
      break;
    }

    const slug = slugOf(repo);
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
      rejections.push(`${slug}: READMEが不十分`);
      continue;
    }

    try {
      const recipe = paidRecipe();
      const generated = await generateAllContent(repo, readme, recipe);
      const license = await licenseFor(repo);
      // README の事実の集合と掲載時の記録（data/readme_facts/<slug>.json）。公開する部分はこれと README の原文だけから作る
      const facts = readmeFacts(readme, {
        repo: repo.full_name,
        created_at: repo.created_at ?? null,
        language: repo.language ?? null,
        description: repo.description,
        license: { spdx: license.spdx, name: license.name, url: license.url, status: license.status, sourceAvailable: license.sourceAvailable, extraNotices: license.extraNotices },
      });
      facts.diagrams = await renderableDiagrams(facts.diagrams);
      const gain7d = loadVelocity().repos?.[repo.full_name]?.gain_7d ?? null;
      facts.publication = { date: today, stars: repo.stargazers_count, gain7d };
      facts.topics = Array.isArray(repo.topics) ? repo.topics.filter((t) => typeof t === "string") : [];
      // 不採用の理由（規則の名前だけ）。すべての検査を通してから、1 つでもあれば採用しない
      const problems = [];
      const { rawWeb, rawNote } = generated;

      // Web 記事: 生成モデルの出力は、見出し 2 つと README の原文の行だけ（それ以外の行があれば採用しない）
      const st = webQuotesOf(rawWeb);
      if (st.otherHeadings.length) problems.push("Web記事にテンプレート外の見出しがあります");
      if (st.stray) problems.push("Web記事に README の原文でない行があります");
      if (!st.overview.length) throw new Rejection([...problems, "Web記事の概要に README の原文がありません"]);
      const web = renderWebPage({ facts, overview: st.overview, architecture: st.architecture, generatorModel: generated.model });
      for (const p of webPageProblems(web, facts)) problems.push(`Web記事が公開物の形を満たしません（${p.kind}）`);

      // note: 生成モデルが書くのは有料部分だけ（末尾の案内・タグに見える行も含めて全部が有料部分）。
      // 無料部分（題名・リード・原文・有料版の内容一覧・価格の案内）と末尾（案内・タグ）はデータから作る
      const noteParts = notePartsOf(rawNote);
      const paid = recipe ? paidHeadingsToBold(noteParts.paid.split("\n").filter((l, i, a) => !(i === a.findIndex((x) => x.trim()) && /^-{3,}\s*$/.test(l))).join("\n")) : "";
      const features = recipe ? paidContentSummary(paid).features : [];
      const noteText = normalizeReceiptLine(recipe ? renderNoteDraft({ facts, quotes: [...st.overview, ...st.architecture], features, paid }) : "");
      if (recipe) {
        if (noteParts.free.trim()) problems.push("生成モデルが note の無料部分を書いています（無料部分はデータから作ります）");
        const parts = splitPaid(noteText);
        for (const p of [...noteHeadProblems(parts.head.join("\n"), facts, features), ...noteTailProblems(parts.tail, facts)]) problems.push(`note原稿の公開部分が決まった形を満たしません（${p.kind}）`);
        for (const p of [...noteDraftProblems(noteText), ...publicNoteProblems(noteFile, noteText), ...receiptProblems(noteText)]) problems.push(`note原稿が要件を満たしません（${ruleId(p)}）`);
      }
      // 有料部分の作り方が無いときは note の節を求めていない。出力にあっても保存しない（下の内容の検査にはかける）

      // 内容の検査は、保存するもの（Web 記事・note・X）と、生成モデルの出力そのもの（捨てた行を含む）の両方にかける
      const x = xThreadText({ facts, slug, quote: st.overview[0], features });
      const result = { web, x, model: generated.model };
      const head = noteText ? splitPaid(noteText).head.join("\n") : "";
      const publicTexts = [web, head, rawWeb, noteParts.free];
      const ungrounded = [...ungroundedTokens(web, facts), ...ungroundedTokens(head, facts, readmeFixedFacts), ...ungroundedTokens(rawWeb, facts), ...ungroundedTokens(noteParts.free, facts, readmeFixedFacts)];
      if (ungrounded.length) problems.push(`README で確かめられない数値・ホスト・コマンドがあります（${[...new Set(ungrounded.map((u) => u.kind))].join(", ")}）`);
      // 実在しないイメージ・パッケージを購入者に渡さない（参照名は有料部分から拾うことがあるので、ログには件数だけを出す）
      const missing = await findMissingReferences(`${noteText}\n${web}`);
      if (missing.length) problems.push(`実在を確認できない参照があります（${missing.length}件）`);
      if (/"mcpServers"/.test(noteText) && !/mcp/i.test(readme)) problems.push("READMEにMCPの記載が無いのにMCP設定が含まれています");
      // 禁止表現・誇張表現の有無を厳格検査（テスト・監査と共通定義。README の原文に該当する表現があっても、その文は載せない）
      const forbiddenHits = [noteText, web, x, rawWeb, rawNote].flatMap(findForbiddenClaims);
      if (forbiddenHits.length) problems.push(`生成文面に禁止・誇張表現が含まれています（${[...new Set(forbiddenHits.map(ruleId))].join(" / ")}）`);
      // Web 記事の検査: 導入の勧め・引用の無い比較・ライセンスの推測と、LICENSE ファイルの判定と食い違うライセンス表記
      const webHits = [...findWebArticleClaims(result.web), ...licenseStatementProblems(result.web, await licenseFor(repo)), ...findWebArticleClaims(rawWeb), ...licenseStatementProblems(rawWeb, license)];
      if (webHits.length) problems.push(`Web記事に根拠のない推奨・比較・ライセンス表記があります（${[...new Set(webHits.map(ruleId))].join(" / ")}）`);
      const leaks = findProLeaks(rawWeb);
      if (leaks.length) problems.push("Web記事に有料キットの内容が含まれています");
      // プロンプトで禁止した誇張・結果保証の表現（一発起動・爆発的・収入の金額など）
      const hypeHits = [...findHype(noteText), ...findHype(result.web), ...findHype(result.x), ...findHype(rawWeb), ...findHype(rawNote)];
      if (hypeHits.length) problems.push(`生成文面に誇張・結果保証の表現が含まれています（${[...new Set(hypeHits.map(ruleId))].join(" / ")}）`);
      // 公開する部分（Web 記事・note の無料部分・X）の確かめられない評価の語
      const praiseHits = [...publicTexts, result.x].flatMap((t) => findUnverifiablePraise(t));
      if (praiseHits.length) problems.push(`公開する文面に確かめられない評価の語があります（${[...new Set(praiseHits.map(ruleId))].join(" / ")}）`);

      // 公開日（生成した日の JST の日付）がリポジトリの作成日より前になる記事は書かない
      const dateProblem = pubDateProblem(today, repo.created_at);
      if (dateProblem) problems.push(dateProblem);
      // 保存するそのままの本文を、CI の品質ゲート・ビルドと同じ方法で最終検査する（途中の段階だけ検査して、ゲートで落ちる記事を保存しない）
      const finalProblems = await finalWebArticleProblems(web);
      if (finalProblems.length) problems.push(`Web記事が品質ゲートを満たしません（${[...new Set(finalProblems.map(ruleId))].join(" / ")}）`);
      if (problems.length) throw new Rejection(problems);

      fs.mkdirSync(path.dirname(factsFileFor(slug)), { recursive: true });
      fs.writeFileSync(factsFileFor(slug), JSON.stringify(facts, null, 2) + "\n", "utf8");
      if (noteText) {
        writeSealedNote(noteFile, noteText);
        console.log(`✓ note有料記事ドラフト保存（有料部分は暗号化）: ${noteFile}`);
      } else {
        console.log("ℹ️ 有料部分の作り方（NOTE_PAID_RECIPE）が無いため、note 原稿は作りません");
      }

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
title: "「${repo.name}」README の要点（原文）"
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
      usedModel = result.model || usedModel;

      if (generatedCount < TARGET_NEW_COUNT) {
        await sleep(3000);
      }
    } catch (err) {
      // ログには記事のスラッグと規則の名前だけを出す（生成物の断片・有料本文の断片は出さない）
      const why = err instanceof Rejection ? err.message : ruleId(err?.message ?? err);
      console.error(`Failed to process ${slug}: ${why}`);
      rejections.push(`${slug}: ${why}`);
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
        path.join(path.resolve("public/ogp"), `${slug}.svg`),
        factsFileFor(slug),
      ];
      for (const f of cleanupTargets) {
        try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
      if (err instanceof GeminiStopError && err.reason === "quota") {
        console.log(`::warning title=Gemini quota exhausted::Gemini API の利用枠を使い切ったため、残りの候補の生成を中止しました（枠が戻る次回の実行で再開します）。`);
        stopReason = "quota";
        break;
      }
      if (err instanceof GeminiStopError && err.reason === "model_unavailable") {
        console.log(`::warning title=Gemini model unavailable::生成に使える Gemini モデルが見つからないため、残りの候補の生成を中止しました（scripts/utils/gemini_models.mjs の優先リストを確認してください）。`);
        stopReason = "model_unavailable";
        break;
      }
      if (err instanceof GeminiStopError) {
        console.log(`::warning title=Gemini not responding::Gemini の応答が時間切れになったため、残りの候補の生成を中止しました（${err.message.slice(0, 200)}）。`);
        stopReason = err.reason;
        break;
      }

    }
  }

  console.log(`\nPipeline finished. Total new packages created: ${generatedCount}`);
  if (generatedCount === 0 && attempts > 0) {
    // GitHub Actions の実行結果に警告として表示する（無言で記事ゼロの日を作らない）
    console.log(`::warning title=No new article::候補 ${attempts} 件をすべて不採用にしました: ${rejections.join(" | ").slice(0, 900)}`);
  }
  const reason = generatedCount > 0 ? "ok" : (stopReason || (attempts === 0 ? "no_candidates" : "error"));
  recordRunStatus({ generated: generatedCount, reason, model: usedModel });
}

run().then(() => {
  // 記録せずに終わる道筋を作ってしまっても、記録の無い日を作らない
  if (!runStatusRecorded) recordRunStatus({ generated: 0, reason: "error" });
}).catch((err) => {
  console.error("Fatal error:", err);
  recordRunStatus({ generated: 0, reason: "error" });
  process.exit(1);
});
