// 記事にするリポジトリの選定（2026-10-21）。副作用のない純粋関数だけを置く。
// 以前は GitHub 検索のスター数順（sort=stars）で選んでいたため、累計スター数の大きいリポジトリや、
// 短期間に同じオーナーが作った高スターのリポジトリが続けて選ばれていた。
// ここでは「直近の伸び（7日間のスター増加数）」とテーマで並べ、下の条件に当たる候補を外す。
// サイトの「選定基準」ページ（src/pages/criteria.astro）は同じ SELECTION_CONFIG を表示する（公開している基準とコードがずれないように）
import { isNoise } from "./noise_filter.mjs";
import { BLOCKED_SLUGS, isBlockedSlug, slugForRepoName } from "./blocklist.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;

export const SELECTION_CONFIG = Object.freeze({
  // スコアの単位: 7日あたりのスター増加数
  score: {
    windowDays: 7,
    // 作成から日が浅いリポジトリは 7日間の増加数が「作成以来の全スター」とほぼ同じになるため、
    // この日数未満は増加数ではなく「累計スター数 ÷ 経過日数」（1日平均）から 7日分を見積もる
    minAgeDaysForVelocity: 30,
    velocityFile: "data/derived/velocity.json",
  },
  // 重点テーマ（名前・説明・トピックのどれかに当たれば、スコアに themeWeight を掛ける。複数当たっても 1 回だけ）
  themeWeight: 1.5,
  themes: Object.freeze([
    { id: "agent", label: "AI エージェント", pattern: /\bagents?\b|\bagentic\b|エージェント/i },
    { id: "mcp", label: "MCP（Model Context Protocol）", pattern: /\bmcp\b|model context protocol/i },
    { id: "claude-code", label: "Claude Code", pattern: /\bclaude[- ]?code\b/i },
    { id: "codex", label: "Codex", pattern: /\bcodex\b/i },
    { id: "llm-inference", label: "LLM 推論基盤", pattern: /\b(?:llm|language models?)\b[^.。]{0,40}\binferen(?:ce|cing)\b|\binference (?:engine|server|framework|runtime)\b|\bvllm\b|\bsglang\b/i },
    { id: "local-llm", label: "ローカル LLM", pattern: /\blocal[- ](?:llms?|ai|models?|inference)\b|\bollama\b|llama\.cpp|\bon[- ]device\b|\bmlx\b|consumer hardware|ローカル\s*LLM/i },
    { id: "rag", label: "RAG（検索拡張生成）", pattern: /\brag\b|retrieval[- ]augmented/i },
  ].map(Object.freeze)),
  // 同じ GitHub オーナーの記事は、この日数のあいだに maxArticles 本まで
  ownerCap: Object.freeze({ maxArticles: 1, windowDays: 30 }),
  // 同じオーナーが windowDays 日以内に作ったリポジトリのうち、スターが minStars を超えるものが minRepos 本以上あれば、
  // そのオーナーのリポジトリは選定を見送る（理由の推測や評価はしない）
  cluster: Object.freeze({
    windowDays: 14,
    minRepos: 3,
    minStars: 1000,
    caution: "cluster",
    notice: "短期間に同一オーナーの高スター新規リポジトリが集中している場合は選定を見送ります",
  }),
  // 書籍・リンク集など（ソースコードではないもの）の判定。言語が無い（または文書だけの言語の）リポジトリで、
  // 説明・トピックが書籍・一覧のように見えるものだけを外す（コードを含むリポジトリは外さない、控えめな判定）
  docOnly: Object.freeze({
    languages: Object.freeze([null, "HTML", "TeX", "Markdown"]),
    pattern: /\bawesome\b|\bbooks?\b|\bebooks?\b|\bhandbook\b|\bguide\b|curated list|\blist of\b|cheat ?sheets?|\broadmap\b|\binterview\b|全书|书籍|指南|教程|書籍|電子書籍|まとめ|一覧/i,
  }),
  // 有料の外部モデル（GPT・Claude 等）を無料・無制限で使えるとうたう説明
  freePaidModel: Object.freeze({
    free: /無料|免费|免費|\bfree\b|タダ/i,
    unlimited: /無制限|使い放題|不限量|无限|無限|\bunlimited\b|no usage (?:cap|limit)|no (?:rate )?limits?\b|无上限/i,
    paidModel: /\bgpt-?\d|\bchatgpt\b|\bopenai\b|\bclaude\b|\banthropic\b|\bgemini\b|\bdeepseek\b|\bkimi\b|\bgrok\b|frontier models?|前沿模型|最先端モデル/i,
  }),
  watchlistSize: 9,
  blockedSlugs: BLOCKED_SLUGS,
});

// 除外理由（サイトの「選定基準」ページにも同じ文言で表示する）
export const REJECTION_REASONS = Object.freeze({
  blocklist: "解説対象から外したリポジトリ（取り下げ済みの記事など）",
  archived: "アーカイブ（更新停止）済み",
  no_created_at: "作成日を取得できない",
  doc_only: "ソースコードを含まない書籍・リンク集など（言語なし・文書のみで、説明が書籍・一覧のもの）",
  noise_filter: "パッケージ辞書・求人リスト・チートシート集など（ノイズ判定）",
  free_paid_model: "有料の外部モデルを無料・無制限で使えるとうたう説明",
  owner_cap: `同じオーナーの記事を直近 ${SELECTION_CONFIG.ownerCap.windowDays} 日以内に ${SELECTION_CONFIG.ownerCap.maxArticles} 本掲載済み、または同じオーナーのより上位の候補がある`,
  cluster: "短期間に同一オーナーの高スター新規リポジトリが集中している",
});

const ownerOf = (fullName) => String(fullName || "").split("/")[0].toLowerCase();
const keyOf = (fullName) => String(fullName || "").toLowerCase();
const toTime = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

// velocity.json の読み込み結果を { full_name(小文字): {...} } にそろえる。ファイルが無い・形式が違う場合は空
export function normalizeVelocity(raw) {
  if (!raw || typeof raw !== "object") return {};
  const src = raw.repos && typeof raw.repos === "object" && !Array.isArray(raw.repos) ? raw.repos : raw;
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (k.includes("/") && v && typeof v === "object") out[keyOf(k)] = v;
  }
  return out;
}

function textOf(item) {
  const topics = Array.isArray(item.topics) ? item.topics.join(" ") : "";
  return `${item.name || ""} ${item.full_name || ""} ${item.description || ""} ${topics}`;
}

export function matchThemes(item, config = SELECTION_CONFIG) {
  const text = textOf(item);
  return config.themes.filter((t) => t.pattern.test(text)).map((t) => t.id);
}

// 7日あたりのスター増加数。velocity の gain_7d を優先し、無い（null）か作成から minAgeDaysForVelocity 日未満なら
// 累計スター数 ÷ max(1, 経過日数) × 7 で見積もる
export function baseScore(item, velocity, now, config = SELECTION_CONFIG) {
  const created = toTime(item.created_at);
  const ageDays = created === null ? null : Math.max(0, (now - created) / DAY_MS);
  const v = velocity[keyOf(item.full_name)];
  const gain = v && typeof v.gain_7d === "number" && Number.isFinite(v.gain_7d) ? v.gain_7d : null;
  if (gain !== null && ageDays !== null && ageDays >= config.score.minAgeDaysForVelocity) {
    return { base: gain, basis: "gain_7d", ageDays };
  }
  const stars = Number(item.stargazers_count) || 0;
  return { base: (stars / Math.max(1, ageDays ?? 1)) * config.score.windowDays, basis: "stars_per_age", ageDays };
}

export function isDocOnly(item, config = SELECTION_CONFIG) {
  const lang = item.language ?? null;
  if (!config.docOnly.languages.includes(lang)) return false;
  const text = `${item.description || ""} ${Array.isArray(item.topics) ? item.topics.join(" ") : ""}`;
  return config.docOnly.pattern.test(text);
}

export function promisesFreePaidModel(item, config = SELECTION_CONFIG) {
  const d = String(item.description || "");
  const { free, unlimited, paidModel } = config.freePaidModel;
  return free.test(d) && unlimited.test(d) && paidModel.test(d);
}

// オーナーごとに、短期間（windowDays 日以内）に作られた高スター（minStars 超）のリポジトリが minRepos 本以上あるか。
// repos: [{ full_name, created_at, stars }]
export function findClusterOwners(repos, config = SELECTION_CONFIG) {
  const { windowDays, minRepos, minStars } = config.cluster;
  const byOwner = new Map();
  const seen = new Set();
  for (const r of repos) {
    const key = keyOf(r.full_name);
    const t = toTime(r.created_at);
    if (!key || seen.has(key) || t === null || !(Number(r.stars) > minStars)) continue;
    seen.add(key);
    const owner = ownerOf(r.full_name);
    if (!byOwner.has(owner)) byOwner.set(owner, []);
    byOwner.get(owner).push(t);
  }
  const owners = new Set();
  for (const [owner, times] of byOwner) {
    times.sort((a, b) => a - b);
    for (let i = 0, j = 0; j < times.length; j++) {
      while (times[j] - times[i] > windowDays * DAY_MS) i++;
      if (j - i + 1 >= minRepos) {
        owners.add(owner);
        break;
      }
    }
  }
  return owners;
}

// candidates: GitHub 検索 API の items。featured: 掲載済みの記事 [{ full_name, pubDate, stars?, created_at? }]
// 戻り値: { ranked（スコアの高い順）, rejected: [{ full_name, reason, caution? }], watchlist: ranked の 2〜10 位, clusterOwners }
export function rankCandidates(candidates, { velocity = {}, featured = [], now = Date.now(), config = SELECTION_CONFIG } = {}) {
  const nowMs = toTime(now) ?? Date.now();
  const vel = normalizeVelocity(velocity);
  const items = (candidates || []).filter((c) => c && c.full_name);

  const clusterOwners = findClusterOwners(
    [
      ...items.map((c) => ({ full_name: c.full_name, created_at: c.created_at, stars: c.stargazers_count })),
      ...featured.map((f) => ({ full_name: f.full_name, created_at: f.created_at, stars: f.stars })),
    ],
    config,
  );

  // 直近 windowDays 日以内に掲載した記事の数（オーナーごと）
  const recentByOwner = new Map();
  for (const f of featured) {
    const t = toTime(f.pubDate);
    if (t === null || nowMs - t >= config.ownerCap.windowDays * DAY_MS) continue;
    const o = ownerOf(f.full_name);
    recentByOwner.set(o, (recentByOwner.get(o) || 0) + 1);
  }

  const rejected = [];
  const scored = [];
  for (const item of items) {
    const reject = (reason, extra = {}) => rejected.push({ full_name: item.full_name, reason, ...extra });
    const owner = ownerOf(item.full_name);
    if (isBlockedSlug(slugForRepoName(item.name || item.full_name.split("/")[1]))) { reject("blocklist"); continue; }
    if (item.archived) { reject("archived"); continue; }
    if (toTime(item.created_at) === null) { reject("no_created_at"); continue; }
    if (isDocOnly(item, config)) { reject("doc_only"); continue; }
    if (isNoise(item.name || "") || isNoise(item.full_name)) { reject("noise_filter"); continue; }
    if (promisesFreePaidModel(item, config)) { reject("free_paid_model"); continue; }
    if (clusterOwners.has(owner)) { reject("cluster", { caution: config.cluster.caution }); continue; }
    if ((recentByOwner.get(owner) || 0) >= config.ownerCap.maxArticles) { reject("owner_cap"); continue; }

    const { base, basis, ageDays } = baseScore(item, vel, nowMs, config);
    const themes = matchThemes(item, config);
    const weight = themes.length ? config.themeWeight : 1;
    scored.push({
      full_name: item.full_name,
      score: Math.round(base * weight * 100) / 100,
      base: Math.round(base * 100) / 100,
      basis,
      weight,
      themes,
      ageDays: ageDays === null ? null : Math.round(ageDays * 10) / 10,
      stars: Number(item.stargazers_count) || 0,
      item,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.stars - a.stars || a.full_name.localeCompare(b.full_name));

  // 同じ実行の中でも、同じオーナーからは最上位の 1 件だけを残す
  const ranked = [];
  const ownersTaken = new Map();
  for (const s of scored) {
    const o = ownerOf(s.full_name);
    const taken = (ownersTaken.get(o) || 0) + (recentByOwner.get(o) || 0);
    if (taken >= config.ownerCap.maxArticles) {
      rejected.push({ full_name: s.full_name, reason: "owner_cap" });
      continue;
    }
    ownersTaken.set(o, (ownersTaken.get(o) || 0) + 1);
    ranked.push(s);
  }

  return { ranked, rejected, watchlist: ranked.slice(1, 1 + config.watchlistSize), clusterOwners: [...clusterOwners] };
}

// 記事の公開日はリポジトリの作成日より前にしない（JST の日付で比べる）
export function jstDate(t) {
  const ms = toTime(t);
  return ms === null ? null : new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export function pubDateProblem(pubDate, createdAt) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(pubDate || ""))) return `pubDate が YYYY-MM-DD ではありません (${pubDate})`;
  const created = jstDate(createdAt);
  if (!created) return null;
  return pubDate < created ? `pubDate (${pubDate}) がリポジトリの作成日 (${created}) より前です` : null;
}

// data/watchlist.json に書く内容（2〜10 位）
export function watchlistDocument(result, now = Date.now()) {
  return {
    date: jstDate(now),
    note: "選定スコアの 2〜10 位（記事化の候補。評価や推奨ではありません）",
    items: result.watchlist.map((s, i) => ({
      rank: i + 2,
      full_name: s.full_name,
      url: s.item?.html_url || `https://github.com/${s.full_name}`,
      score: s.score,
      basis: s.basis,
      themes: s.themes,
      stars: s.stars,
    })),
  };
}
