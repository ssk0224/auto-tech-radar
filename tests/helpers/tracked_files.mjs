// git が追跡しているファイルの一覧（公開リポにそのまま出るもの）。-z: 日本語・空白を含む名前でも崩さない
import { execFileSync } from "child_process";

export function trackedFiles(cwd) {
  return execFileSync("git", ["ls-files", "-z"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
}

// git が無視するパスか（.gitignore）。追跡外の書き出し先がコミットされないことの確認に使う
export function isGitIgnored(cwd, relPath) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", "--", relPath], { cwd, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// 公開リポに出うるファイル: 追跡中 + 未追跡で gitignore されていないもの（CI が生成し、これからコミットする記事など）
export function publishableFiles(cwd) {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return [...new Set(out.split("\0").filter(Boolean))];
}
