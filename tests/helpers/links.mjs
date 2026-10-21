// ディレクトリへのリンクを作る。Windows の symlink（type "dir"）は管理者権限か開発者モードが無いと EPERM になるので、権限のいらない junction を使う
// （Linux・macOS では普通の symlink）。テストが特別な権限を前提にしないための唯一の入口
import fs from "fs";

export function linkDir(target, linkPath) {
  fs.symlinkSync(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}
