// オーナー端末（ランチャー）から出品履歴などを GitHub に同期する共通処理。CI と同じマージドライバを使う。
// 失敗を握りつぶさない: 取り込みに失敗したら rebase を中止して作業ツリーを元に戻し、理由を返す
import { spawnSync } from "child_process";

const MERGE_DRIVERS = {
  "merge.publish-history.driver": "node scripts/merge_publish_history.mjs %O %A %B",
  "merge.note-urls.driver": "node scripts/merge_note_urls.mjs %O %A %B",
  "merge.note-status.driver": "node scripts/merge_note_status.mjs %O %A %B",
};

const git = (cwd, args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
};

export function configureMergeDrivers(cwd) {
  for (const [k, v] of Object.entries(MERGE_DRIVERS)) git(cwd, ["config", k, v]);
}

// paths をコミットし、最新の main に載せ直して push する。戻り値 { ok, step, message }
export function commitAndSync(cwd, paths, message, branch = "main") {
  configureMergeDrivers(cwd);
  let r = git(cwd, ["add", "--", ...paths]);
  if (!r.ok) return { ok: false, step: "add", message: r.out };
  const staged = !git(cwd, ["diff", "--cached", "--quiet", "--", ...paths]).ok;
  if (staged) {
    r = git(cwd, ["commit", "-m", message, "--", ...paths]);
    if (!r.ok) return { ok: false, step: "commit", message: r.out };
  }
  // 他の未コミットの変更があっても取り込めるよう autostash を使う
  r = git(cwd, ["pull", "--rebase", "--autostash", "origin", branch]);
  if (!r.ok) {
    git(cwd, ["rebase", "--abort"]);
    return { ok: false, step: "pull", message: r.out };
  }
  r = git(cwd, ["push", "origin", `HEAD:${branch}`]);
  if (!r.ok) return { ok: false, step: "push", message: r.out };
  return { ok: true, step: "done", message: staged ? "pushed" : "nothing to commit" };
}
