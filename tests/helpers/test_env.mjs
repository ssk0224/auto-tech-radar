// 全テストプロセスの先頭で読み込む（package.json の test が `node --import` で指定する）。
// 「環境に依存する書き方をソースの文字列で探す」やり方は、別の書き方（execSync の文字列・fs.promises・npx 経由）をすり抜ける。
// ここは書き方でなく結果で止める: 危険な操作を、どう書いても同じ入口で拒否するか、無害にする。
//   1. git: マシンの global / system 設定（owner PC の core.autocrlf=true など）と、受け継いだ GIT_* 環境変数（git の hook の GIT_DIR・GIT_CONFIG_COUNT など）を外す。
//   2. symlink: Windows で権限が要る fs の symlink 系は、junction 以外すべて拒否する（fs.symlinkSync・fs.symlink・fs.promises.symlink）。
//      fs を通さずに作ったリンク（cmd の mklink など）は、終了時にプロセスの一時ディレクトリを調べて失敗にする（Windows）。
//   3. astro build: リポ本体での実行は astro.config.mjs が拒否する（ATR_TEST_RUN で検知。ビルド用コピーだけ ATR_SITE_BUILD_COPY=1）。
//   4. 子プロセス: env を一から渡しても（`{ PATH }` など）、1・3 と一時ディレクトリの設定が子に届くよう、child_process の全関数で足し直す。
//   5. 一時ディレクトリ: プロセスごとに別の os.tmpdir() にする（並列のテストファイルが固定名の一時ディレクトリを共有して壊し合わない）。終了時に消す。
import fs from "fs";
import path from "path";
import os from "os";
import childProcess from "node:child_process";
import module from "node:module";
import { isolateGitConfig } from "./git_env.mjs";
import { registerLink, unregisteredLinks } from "./links.mjs";

// ---- 5. プロセスごとの一時ディレクトリ ----
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atr-proc-"));
for (const k of ["TMPDIR", "TMP", "TEMP"]) process.env[k] = tmpRoot;
// リンクの登録簿（下の fs.symlink* が、作った junction を書く）。入れ子のテストプロセスは外側のものを使う
if (!process.env.ATR_LINK_REGISTRY) process.env.ATR_LINK_REGISTRY = path.join(tmpRoot, ".links");

// ---- 1. git ----
for (const k of Object.keys(process.env)) if (/^GIT_/i.test(k)) delete process.env[k];
process.env.ATR_TEST_RUN = "1";
isolateGitConfig();

process.on("exit", () => {
  // Windows の CI は管理者で動くので、cmd の mklink /D などで symlink が作れてしまう（owner PC では EPERM）。作り方によらず、残ったリンクで止める
  const bad = process.platform === "win32" ? unregisteredLinks(tmpRoot, process.env.ATR_LINK_REGISTRY) : [];
  if (bad.length) {
    process.exitCode = 1;
    fs.writeSync(2, `\ntests/helpers/links.mjs の linkDir を通さずに作ったリンクがある（Windows では権限が無いと作れない。owner PC で EPERM になる）:\n${bad.map((p) => `  - <テストの一時ディレクトリ>/${path.relative(tmpRoot, p).split(path.sep).join("/")}\n`).join("")}`);
  }
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (e) {
    fs.writeSync(2, `テストの一時ディレクトリを消せなかった（${e.code}）: ${path.basename(tmpRoot)}\n`);
  }
});

// ---- 4. 子プロセス ----
// テストの子プロセスに必ず届ける値（呼び出し側が明示した値は上書きしない）
const INHERIT = ["ATR_TEST_RUN", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "ATR_GIT_ISOLATED", "ATR_LINK_REGISTRY", "TMPDIR", "TMP", "TEMP"];
const hasKey = (env, k) => Object.keys(env).some((x) => (process.platform === "win32" ? x.toUpperCase() === k : x === k));
const withTestEnv = (opts) => {
  if (!opts.env || opts.env === process.env) return opts;
  const env = { ...opts.env };
  for (const k of INHERIT) if (!hasKey(env, k) && process.env[k] !== undefined) env[k] = process.env[k];
  return { ...opts, env };
};
// options の位置: spawn 系は (file, args?, options?)、exec 系は (command, options?, cb?)
const patchArgs = (args, from) => args.map((a, i) => (i >= from && a && typeof a === "object" && !Array.isArray(a) ? withTestEnv(a) : a));
// 対照実験（仕組みが無いときに危険が見えることの確認）だけが使う、足し直さない元の関数
export const unguarded = {};
for (const [name, from] of Object.entries({ spawn: 1, spawnSync: 1, execFile: 1, execFileSync: 1, fork: 1, exec: 1, execSync: 1 })) {
  const orig = childProcess[name];
  unguarded[name] = orig;
  childProcess[name] = function (...args) {
    return orig.apply(this, patchArgs(args, from));
  };
}

// ---- 2. symlink ----
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
  const r = symlinkSync.call(this, target, p, type);
  registerLink(p);
  return r;
};
fs.symlink = function (target, p, type, cb) {
  if (typeOf(type) !== "junction") throw refuse(target, p, typeOf(type));
  return symlink.call(this, target, p, type, (err) => {
    if (!err) registerLink(p);
    cb(err);
  });
};
fs.promises.symlink = async function (target, p, type) {
  if (typeOf(type) !== "junction") throw refuse(target, p, typeOf(type));
  const r = await promisesSymlink.call(this, target, p, type);
  registerLink(p);
  return r;
};
module.syncBuiltinESMExports(); // `import { symlinkSync } from "fs"`・`import { spawnSync } from "child_process"` で束縛された名前にも効かせる
