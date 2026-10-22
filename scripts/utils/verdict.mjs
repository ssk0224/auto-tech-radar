// 検査の結果は ok / bad / unknown の 3 値で表す。
// 「取得できなかった・読めなかった・位置が分からない」を ok・0・空・false に潰すと、下流の集計・警告・ランチャーが
// 「問題なし」と読む（2026-10-22 の洗い出し: note の有料ライン監視が 37 本中 24 本で盲目のまま「0 本」と報告していた）。
// unknown は必ず数えて表に出す（::error / ::warning）。
import fs from "fs";
import path from "path";

export const OK = "ok";
export const BAD = "bad";
export const UNKNOWN = "unknown";

export const verdict = (status, reason = "", extra = {}) => ({ status, reason, ...extra });
export const ok = (extra = {}) => verdict(OK, "", extra);
export const bad = (reason, extra = {}) => verdict(BAD, reason, extra);
export const unknown = (reason, extra = {}) => verdict(UNKNOWN, reason, extra);

// verdict の配列を数える。status の無いもの・想定外の値は unknown として数える
export function tally(verdicts) {
  const counts = { ok: 0, bad: 0, unknown: 0 };
  for (const v of verdicts) counts[v?.status === OK || v?.status === BAD ? v.status : UNKNOWN]++;
  return counts;
}

// JSON ファイルを読む。無いときは missing を返す（missing を渡さなければ失敗）。壊れていれば必ず失敗にする
// （壊れた記録を {} として読むと、「記録が無い＝問題なし」と同じに扱われる）
export function readJsonStrict(file, { missing } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT" && missing !== undefined) return missing;
    throw new Error(`${path.basename(file)} を読めません（${e.code || e.message}）`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${path.basename(file)} を JSON として読めません（${e.message}）`);
  }
}

// GitHub Actions の注釈（::error / ::warning）。改行は注釈を切るので空白にする
export const annotation = (level, title, message) => `::${level} title=${title}::${String(message).replace(/\r?\n/g, " ")}`;
