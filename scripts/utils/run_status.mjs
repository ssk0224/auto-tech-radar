// 記事生成の実行結果を data/run_status/YYYY-MM-DD.json（日本時間の日付ごとに 1 ファイル）へ追記する。
// 「今日は記事が出なかった」ときに理由を後から確認でき、scripts/alert_if_no_article.mjs がアラートに載せる
import fs from "fs";
import path from "path";

export const RUN_REASONS = ["ok", "quota", "no_candidates", "model_unavailable", "error", "cap_reached"];

export function jstDate(now = Date.now()) {
  return new Date(new Date(now).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function runStatusFile(rootDir, date) {
  return path.join(rootDir, "data", "run_status", `${date}.json`);
}

// 既存の記録（壊れていれば作り直す）に 1 回分を追記した新しい記録を返す
export function appendRun(existing, date, run) {
  const reason = RUN_REASONS.includes(run.reason) ? run.reason : "error";
  const runs = existing && existing.date === date && Array.isArray(existing.runs) ? existing.runs : [];
  return {
    date,
    runs: [...runs, {
      at: run.at,
      event: run.event || "local",
      generated: Number(run.generated) || 0,
      reason,
      model: run.model || null,
    }],
  };
}

export function readRunStatus(rootDir, date) {
  try {
    return JSON.parse(fs.readFileSync(runStatusFile(rootDir, date), "utf8"));
  } catch {
    return null;
  }
}

// 実行結果を記録する。記録の失敗で生成処理を落とさない（警告のみ）
export function recordRunStatus({ rootDir = process.cwd(), now = Date.now(), generated = 0, reason, model = null, event } = {}) {
  try {
    const date = jstDate(now);
    const schedule = process.env.RUN_SCHEDULE ? ` (${process.env.RUN_SCHEDULE})` : "";
    const ev = event || `${process.env.GITHUB_EVENT_NAME || "local"}${schedule}`;
    const next = appendRun(readRunStatus(rootDir, date), date, { at: new Date(now).toISOString(), event: ev, generated, reason, model });
    const file = runStatusFile(rootDir, date);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf8");
    console.log(`run_status: ${path.relative(rootDir, file)} に記録しました（generated: ${next.runs.at(-1).generated}, reason: ${next.runs.at(-1).reason}）`);
    return next;
  } catch (e) {
    console.warn(`run_status の記録に失敗しました: ${e.message}`);
    return null;
  }
}
