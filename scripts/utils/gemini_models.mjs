// 記事生成に使う Gemini モデルの順番と、呼び出し失敗の分類（scripts/crawl_and_generate.mjs から使う）。
// 2026-10-20 に 503 → 429（利用枠切れ）で記事が 0 本になり、誰も気づかなかったことへの対策。

// 優先順。gemini-2.5-flash は 2026-10-21 の生成で動作を確認済みなので先頭に固定する。
// それ以外の ID は未確認のため、API のモデル一覧（ai.models.list()）に載っているものだけを使う
export const MODEL_PREFERENCE = ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

// モデル一覧を何件まで読むか（ページングが終わらない場合の歯止め）
const MAX_LISTED_MODELS = 500;

// 実行時のモデル順を決める。一覧が取れればそこに載っている（generateContent 対応の）ものだけに絞る。
// 一覧の取得に失敗した・優先リストのどれも載っていない場合は、静的な優先リストをそのまま使う
export async function resolveModelOrder(ai, preference = MODEL_PREFERENCE) {
  try {
    const pager = await ai.models.list({ config: { pageSize: 100 } });
    const available = new Set();
    let n = 0;
    for await (const m of pager) {
      if (++n > MAX_LISTED_MODELS) break;
      const name = String(m?.name || "").replace(/^models\//, "");
      const actions = m?.supportedActions;
      if (name && (!Array.isArray(actions) || actions.includes("generateContent"))) available.add(name);
    }
    const filtered = preference.filter((id) => available.has(id));
    if (filtered.length > 0) return filtered;
    console.warn(`[Gemini] モデル一覧に優先リストのモデルが見つからないため、静的リストを使います（一覧 ${available.size} 件）`);
  } catch (e) {
    console.warn(`[Gemini] モデル一覧を取得できないため、静的リストを使います: ${e?.message || e}`);
  }
  return [...preference];
}

// 呼び出し失敗の分類:
//  quota       … 429 / RESOURCE_EXHAUSTED（利用枠切れ）。この実行ではもう Gemini を呼ばない
//  unavailable … 404 / not found / is not supported / deprecated。次のモデルへ
//  transient   … 5xx・タイムアウト等の一時的な失敗。同じモデルで再試行してから次のモデルへ
//  other       … それ以外。次のモデルへ
export function classifyGeminiError(err) {
  const status = Number(err?.status || err?.code) || 0;
  const msg = String(err?.message || err || "");
  if (status === 429 || /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota|quota exceeded/i.test(msg)) return "quota";
  if (status === 404 || /\b404\b|NOT_FOUND|not found|is not supported|deprecated|no longer available/i.test(msg)) return "unavailable";
  if (status >= 500 || /\b50[0-4]\b|unavailable|overloaded|internal error|timeout|fetch failed|econnreset|etimedout/i.test(msg)) return "transient";
  return "other";
}

// 実行全体を止める失敗（reason: "quota" | "model_unavailable"）。run_status の reason にそのまま使う
export class GeminiStopError extends Error {
  constructor(reason, cause) {
    super(`${reason}: ${cause?.message || cause || "Gemini を呼び出せません"}`);
    this.name = "GeminiStopError";
    this.reason = reason;
    this.cause = cause;
  }
}
