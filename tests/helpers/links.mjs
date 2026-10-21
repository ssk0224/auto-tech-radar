// ディレクトリへのリンクを作る。Windows の symlink（type "dir"）は管理者権限か開発者モードが無いと EPERM になるので、権限のいらない junction を使う
// （Linux・macOS では普通の symlink）。テストが特別な権限を前提にしないための唯一の入口
import fs from "fs";

export function linkDir(target, linkPath) {
  // 型は全 OS で "junction"（Linux・macOS では型が無視されて普通の symlink になる）。helpers/test_env.mjs は junction 以外の symlink を拒否する
  fs.symlinkSync(target, linkPath, "junction");
}
