// オーナー端末（ランチャー）から出品履歴などを GitHub に同期する共通処理。CI と同じマージドライバを使う。
// 失敗を握りつぶさない: 取り込みに失敗したら rebase を中止して作業ツリーを元に戻し、理由を返す
// CI（.github/workflows/daily-crawl.yml）も `node scripts/utils/git_sync.mjs configure` で同じマージドライバを設定する（定義はここだけ）
import { spawnSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";

// .gitattributes の merge=<名前> ごとのドライバ（tests/workflow.test.mjs が .gitattributes と突き合わせる）
export const MERGE_DRIVERS = {
  "merge.publish-history.driver": "node scripts/merge_publish_history.mjs %O %A %B",
  "merge.note-urls.driver": "node scripts/merge_note_urls.mjs %O %A %B",
  "merge.note-status.driver": "node scripts/merge_note_status.mjs %O %A %B",
};

const git = (cwd, args) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() };
};

// 設定に失敗した項目の説明を返す（空なら全部設定できた）
export function configureMergeDrivers(cwd) {
  const failed = [];
  for (const [k, v] of Object.entries(MERGE_DRIVERS)) {
    const r = git(cwd, ["config", k, v]);
    if (!r.ok) failed.push(`${k}: ${r.out}`);
  }
  return failed;
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

// CLI: node scripts/utils/git_sync.mjs configure（CI がどの git pull よりも前に実行する）
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href && process.argv[2] === "configure") {
  const failed = configureMergeDrivers(process.cwd());
  if (failed.length) {
    console.error(`マージドライバを設定できませんでした: ${failed.join(" / ")}`);
    process.exit(1);
  }
  console.log(`マージドライバを設定しました: ${Object.keys(MERGE_DRIVERS).join(", ")}`);
}
