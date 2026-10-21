// 作業ツリーの改行を一括で LF / CRLF にそろえる（コミットされる内容は変えない）。
//   node tests/helpers/worktree_eol.mjs crlf   … Windows の owner PC と同じ「全部 CRLF の作業ツリー」を作る（Windows CI が使う）
//   node tests/helpers/worktree_eol.mjs lf     … LF に戻す
// 対象は git が「LF のテキスト」として管理しているファイルだけ（画像などのバイナリには触れない）
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { pathToFileURL } from "url";

export function convertWorktree(cwd, mode) {
  if (mode !== "crlf" && mode !== "lf") throw new Error(`mode は crlf か lf: ${mode}`);
  const r = spawnSync("git", ["ls-files", "--eol", "-z"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ls-files に失敗: ${r.stderr}`);
  let changed = 0;
  for (const rec of r.stdout.split("\0").filter(Boolean)) {
    const m = rec.match(/^i\/(\S+)\s+w\/(\S+)\s+attr\/[^\t]*\t(.+)$/s);
    if (!m || m[1] !== "lf") continue;
    const file = path.join(cwd, m[3]);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    const next = mode === "crlf" ? text.replace(/\n/g, "\r\n") : text;
    if (next !== fs.readFileSync(file, "utf8")) {
      fs.writeFileSync(file, next);
      changed++;
    }
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const n = convertWorktree(process.cwd(), process.argv[2]);
  console.log(`${process.argv[2]}: ${n} files rewritten`);
}
