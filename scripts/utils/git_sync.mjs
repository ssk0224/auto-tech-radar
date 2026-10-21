// オーナー端末（ランチャー）から出品履歴などを GitHub に同期する共通処理。CI と同じマージドライバを使う。
// 失敗を握りつぶさない: 取り込みに失敗したら rebase を中止して作業ツリーを元に戻し、理由を返す
// CI（.github/workflows/daily-crawl.yml）も `node scripts/utils/git_sync.mjs configure` で同じマージドライバを設定する（定義はここだけ）
import fs from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { pathToFileURL } from "url";

// .gitattributes の merge=<名前> ごとのドライバ（tests/workflow.test.mjs が .gitattributes と突き合わせる）
export const MERGE_DRIVERS = {
  "merge.publish-history.driver": "node scripts/merge_publish_history.mjs %O %A %B",
  "merge.note-urls.driver": "node scripts/merge_note_urls.mjs %O %A %B",
  "merge.note-status.driver": "node scripts/merge_note_status.mjs %O %A %B",
};

const git = (cwd, args, timeout) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", ...(timeout ? { timeout } : {}) });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}`.trim() || (r.error ? r.error.message : "") };
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

// 途中で止まった rebase を中止し、衝突の印（<<<<<<<）が入ったまま残っているファイルを最新の版（HEAD）に戻す。戻したファイルを返す。
// `git pull --rebase --autostash` は、手元の未コミットの変更が取り込んだ更新とぶつかると、成功（終了コード 0）を返したまま
// そのファイルに衝突の印を書き込む（手元の変更は stash に残る）。そのままだと出品履歴などの JSON が読めず（出品の上限が効かない）、
// 以後の取り込み・コミットもすべて失敗して、ランチャーが古い版のまま動き続ける
export function repairWorkingTree(cwd) {
  for (const p of ["rebase-merge", "rebase-apply"]) {
    const dir = git(cwd, ["rev-parse", "--git-path", p]);
    if (dir.ok && fs.existsSync(path.resolve(cwd, dir.out))) {
      git(cwd, ["rebase", "--abort"]);
      break;
    }
  }
  const u = git(cwd, ["diff", "--name-only", "--diff-filter=U"]);
  const files = u.ok ? u.out.split("\n").map((s) => s.trim()).filter(Boolean) : [];
  if (files.length) git(cwd, ["checkout", "HEAD", "--", ...files]);
  return files;
}

// 最新の branch を取り込む（未コミットの変更は autostash で退避して戻す）。戻り値 { ok, message, restored }。
// restored: 手元の変更が更新とぶつかったため最新の版に戻したファイル（手元の変更は git stash に残っている）
export function pullLatest(cwd, branch = "main", { timeout } = {}) {
  configureMergeDrivers(cwd);
  const restored = repairWorkingTree(cwd);
  const r = git(cwd, ["pull", "--rebase", "--autostash", "origin", branch], timeout);
  if (!r.ok) {
    git(cwd, ["rebase", "--abort"]);
    restored.push(...repairWorkingTree(cwd));
    return { ok: false, message: r.out, restored };
  }
  restored.push(...repairWorkingTree(cwd));
  return { ok: true, message: r.out, restored };
}

// paths をコミットし、最新の main に載せ直して push する。戻り値 { ok, step, message, restored }
export function commitAndSync(cwd, paths, message, branch = "main") {
  configureMergeDrivers(cwd);
  const restored = repairWorkingTree(cwd);
  let r = git(cwd, ["add", "--", ...paths]);
  if (!r.ok) return { ok: false, step: "add", message: r.out, restored };
  const staged = !git(cwd, ["diff", "--cached", "--quiet", "--", ...paths]).ok;
  if (staged) {
    r = git(cwd, ["commit", "-m", message, "--", ...paths]);
    if (!r.ok) return { ok: false, step: "commit", message: r.out, restored };
  }
  // 他の未コミットの変更があっても取り込めるよう autostash を使う
  const p = pullLatest(cwd, branch);
  restored.push(...p.restored);
  if (!p.ok) return { ok: false, step: "pull", message: p.message, restored };
  r = git(cwd, ["push", "origin", `HEAD:${branch}`]);
  if (!r.ok) return { ok: false, step: "push", message: r.out, restored };
  return { ok: true, step: "done", message: staged ? "pushed" : "nothing to commit", restored };
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
