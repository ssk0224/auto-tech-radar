// 全テストプロセスの先頭で読み込む（package.json の test が `node --import` で指定する）。
// 「環境に依存する書き方をソースの文字列で探す」やり方は、別の書き方（execSync の文字列・fs.promises・npx 経由）をすり抜ける。
// ここは書き方でなく結果で止める: 危険な操作を、どう書いても同じ入口で拒否するか、無害にする。
//   1. git: マシンの global / system 設定（owner PC の core.autocrlf=true など）を、子プロセスの git も含めて外す。
//   2. symlink: Windows で権限が要る fs の symlink 系は、junction 以外すべて拒否する（fs.symlinkSync・fs.symlink・fs.promises.symlink）。
//   3. astro build: リポ本体での実行は astro.config.mjs が拒否する（ATR_TEST_RUN で検知。ビルド用コピーだけ ATR_SITE_BUILD_COPY=1）。
import fs from "fs";
import module from "node:module";
import { isolateGitConfig } from "./git_env.mjs";

process.env.ATR_TEST_RUN = "1";
isolateGitConfig();

const refuse = (target, p, type) =>
  new Error(
    `テストが fs の symlink を直接作ろうとした (${String(target)} -> ${String(p)}, type=${type ?? "未指定"})。` +
      "Windows では権限が無いと EPERM になる。tests/helpers/links.mjs の linkDir（junction）を使う"
  );
const typeOf = (type) => (typeof type === "function" ? undefined : type);

const symlinkSync = fs.symlinkSync;
const symlink = fs.symlink;
const promisesSymlink = fs.promises.symlink;
fs.symlinkSync = function (target, p, type) {
  if (typeOf(type) !== "junction") throw refuse(target, p, typeOf(type));
  return symlinkSync.call(this, target, p, type);
};
fs.symlink = function (target, p, type, cb) {
  if (typeOf(type) !== "junction") throw refuse(target, p, typeOf(type));
  return symlink.call(this, target, p, type, cb);
};
fs.promises.symlink = async function (target, p, type) {
  if (typeOf(type) !== "junction") throw refuse(target, p, typeOf(type));
  return promisesSymlink.call(this, target, p, type);
};
module.syncBuiltinESMExports(); // `import { symlinkSync } from "fs"` で束縛された名前にも効かせる
