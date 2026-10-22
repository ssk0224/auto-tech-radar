// 全テストプロセスの先頭で読み込む（package.json の test が `node --require` で指定する。子孫の node・Worker にも NODE_OPTIONS・execArgv で届ける）。
// 「環境に依存する書き方をソースの文字列で探す」やり方は、別の書き方（execSync の文字列・fs.promises・npx 経由）をすり抜ける。
// ここは書き方でなく結果で止める: 危険な操作を、どう書いても同じ入口で拒否するか、無害にする。
//   1. git: マシンの global / system 設定（owner PC の core.autocrlf=true・init.defaultBranch など）と、受け継いだ GIT_* 環境変数（git の hook の GIT_DIR・GIT_CONFIG_COUNT など）を外す。
//   2. symlink: Windows で権限が要る fs の symlink 系は、junction 以外すべて拒否する（fs.symlinkSync・fs.symlink・fs.promises.symlink）。
//      fs を通さずに作ったリンク（cmd の mklink など）は、終了時にプロセスの一時ディレクトリを調べて失敗にする（Windows）。
//   3. astro build: リポ本体（.git のある作業ツリー）での実行は astro.config.mjs が拒否する（ATR_TEST_RUN とプロセスの中の印で検知。ビルド用コピーには .git が無い）。
//   4. 子孫: env を一から渡しても（`{ PATH }` など）、1・3・5・6 の設定が届くよう、child_process の全関数と worker_threads の Worker で足し直す。
//      子孫の node（テストが起動した素の node・その先の孫・Worker）は、NODE_OPTIONS / execArgv の --require でこのファイルを読み込む。
//      （--import は、CommonJS の eval で起動した Worker では読み込まれない。--require はどの Worker でも読み込まれる）
//   5. 一時ディレクトリ: プロセスごとに別の os.tmpdir() にする（並列のテストファイルが固定名の一時ディレクトリを共有して壊し合わない）。終了時に消す。
//   6. owner のホーム: プロセスの環境そのもの（HOME・USERPROFILE・HOMEDRIVE/HOMEPATH・APPDATA・LOCALAPPDATA・XDG_*）と os.homedir()・ATR_OWNER_DIR を、
//      テストファイルごとの空のホームに向ける（本物の ~/.auto-tech-radar・Chrome のプロファイル・復号した原稿・~/.gitconfig に触れない）。
//      環境変数を直接読んでも、git の GIT_CONFIG_GLOBAL を消しても（git は既定の $HOME/.gitconfig を読む）、子孫が env を一から作っても、届くのは空のホーム。
//      Playwright のブラウザ（既定では LOCALAPPDATA・~/.cache の下）は、本物の置き場所を PLAYWRIGHT_BROWSERS_PATH で渡す（読むだけ）。
//      有料本文の復号を確かめるテストのためだけに、秘密鍵のファイルは NOTE_VAULT_PRIVATE_KEY_FILE で読めるようにする（owner PC にあれば。読むだけ）。
//   7. 空振り: テストファイルのプロセスでは、アサーションを一つも実行せずに通ったテスト（環境が無いので return した等）・
//      テストを登録しなかった・走らせ終える前に終わったファイルを失敗にする（helpers/assert_counter.mjs）。
//   8. skip の印: skip_gate_reporter.mjs が渡す、この実行だけの印（ATR_SKIP_STAMP）を受け取って環境から消す（helpers/skips.mjs だけが使う）。
// 同じプロセスで 2 回読み込まれても（--require と NODE_OPTIONS・import）1 回だけ効かせる。
import fs from "fs";
import path from "path";
import os from "os";
import childProcess from "node:child_process";
import workerThreads from "node:worker_threads";
import module from "node:module";
import { fileURLToPath } from "url";
import { isolateGitConfig } from "./git_env.mjs";
import { registerLink, unregisteredLinks } from "./links.mjs";
import { countAssertions } from "./assert_counter.mjs";

const STATE = Symbol.for("auto-tech-radar.test_env");
const first = !globalThis[STATE];
if (first) globalThis[STATE] = { unguarded: {} };
// 対照実験（仕組みが無いときに危険が見えることの確認）だけが使う、元の関数（spawnSync・symlinkSync・homedir・Worker など）
export const unguarded = globalThis[STATE].unguarded;
if (first) install();

function install() {
  const self = fileURLToPath(import.meta.url);
  // NODE_OPTIONS の中のパスは " で囲む（空白を含むパス）。\ は NODE_OPTIONS ではエスケープになるので / にする（Windows の require も / を読める）
  const preloadOption = `--require "${self.split(path.sep).join("/")}"`;
  const withPreload = (opts) => (opts && opts.includes(preloadOption) ? opts : [opts, preloadOption].filter(Boolean).join(" "));
  const isTestFile = workerThreads.isMainThread && Boolean(process.env.NODE_TEST_CONTEXT) && /\.test\.[cm]?js$/.test(process.argv[1] ?? "");
  const nested = process.env.ATR_TEST_RUN === "1" && !isTestFile; // テストが起動した子孫（テストファイルの設定を受け継ぐ）

  // ---- 5. プロセスごとの一時ディレクトリ ----
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "atr-proc-"));
  for (const k of ["TMPDIR", "TMP", "TEMP"]) process.env[k] = tmpRoot;
  // リンクの登録簿（下の fs.symlink* が、作った junction を書く）。入れ子のテストプロセスは外側のものを使う
  if (!process.env.ATR_LINK_REGISTRY) process.env.ATR_LINK_REGISTRY = path.join(tmpRoot, ".links");

  // ---- 8. skip の印 ----
  if (process.env.ATR_SKIP_STAMP) globalThis[STATE].skipStamp = process.env.ATR_SKIP_STAMP;
  delete process.env.ATR_SKIP_STAMP;

  // ---- 1. git ----
  for (const k of Object.keys(process.env)) if (/^GIT_/i.test(k)) delete process.env[k];
  process.env.ATR_TEST_RUN = "1";
  isolateGitConfig();

  // ---- 6. owner のホーム ----
  unguarded.homedir = os.homedir;
  if (!nested && !process.env.NOTE_VAULT_PRIVATE_KEY_FILE) {
    const key = path.join(process.env.ATR_OWNER_DIR || path.join(os.homedir(), ".auto-tech-radar"), "note_vault_private.pem");
    if (fs.existsSync(key)) process.env.NOTE_VAULT_PRIVATE_KEY_FILE = key;
  }
  if (!nested || !process.env.ATR_FAKE_HOME || !fs.existsSync(process.env.ATR_FAKE_HOME)) {
    const home = path.join(tmpRoot, "home");
    fs.mkdirSync(home);
    process.env.ATR_FAKE_HOME = home;
    process.env.ATR_OWNER_DIR = path.join(home, ".auto-tech-radar");
  }
  const fakeHome = process.env.ATR_FAKE_HOME;
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
    const cache = { win32: process.env.LOCALAPPDATA, darwin: path.join(os.homedir(), "Library", "Caches") }[process.platform] ?? (process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"));
    const browsers = cache && path.join(cache, "ms-playwright");
    if (browsers && fs.existsSync(browsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
  }
  const homeEnv = {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    APPDATA: path.join(fakeHome, "AppData", "Roaming"),
    LOCALAPPDATA: path.join(fakeHome, "AppData", "Local"),
    XDG_CONFIG_HOME: path.join(fakeHome, ".config"),
    XDG_CACHE_HOME: path.join(fakeHome, ".cache"),
    XDG_DATA_HOME: path.join(fakeHome, ".local", "share"),
    XDG_STATE_HOME: path.join(fakeHome, ".local", "state"),
  };
  if (process.platform === "win32") {
    const { root } = path.parse(fakeHome); // "C:\\"
    Object.assign(homeEnv, { HOMEDRIVE: root.slice(0, -1), HOMEPATH: fakeHome.slice(root.length - 1) });
  }
  for (const [k, v] of Object.entries(homeEnv)) {
    if (k !== "HOMEDRIVE" && k !== "HOMEPATH") fs.mkdirSync(v, { recursive: true });
    process.env[k] = v;
  }
  os.homedir = function homedir() {
    return fakeHome;
  };
  unguarded.userInfo = os.userInfo;
  os.userInfo = function userInfo(options) {
    const info = unguarded.userInfo.call(os, options);
    return { ...info, homedir: options?.encoding === "buffer" ? Buffer.from(fakeHome) : fakeHome };
  };

  // ---- 4. 子孫 ----
  process.env.NODE_OPTIONS = withPreload(process.env.NODE_OPTIONS);
  // テストの子孫に必ず届ける値（呼び出し側が明示した値は上書きしない。NODE_OPTIONS は呼び出し側の値に --require を足す）
  const INHERIT = ["ATR_TEST_RUN", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_SYSTEM", "ATR_GIT_ISOLATED", "ATR_LINK_REGISTRY", "TMPDIR", "TMP", "TEMP", "ATR_FAKE_HOME", "ATR_OWNER_DIR", "NOTE_VAULT_PRIVATE_KEY_FILE", "PLAYWRIGHT_BROWSERS_PATH", ...Object.keys(homeEnv)];
  // 値は読み込んだ時点のものを固定して使う（テストが process.env を置き換えたり、GIT_CONFIG_GLOBAL などを消したりしても、子に届ける）
  const pinned = Object.fromEntries(INHERIT.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  const keyOf = (env, k) => Object.keys(env).find((x) => (process.platform === "win32" ? x.toUpperCase() === k : x === k));
  const testEnv = (given) => {
    const env = { ...given };
    // 呼び出し側が明示した値は残す。ただし undefined・null（子には渡らない）は「指定なし」と同じに扱う
    for (const [k, v] of Object.entries(pinned)) {
      const key = keyOf(env, k);
      if (key !== undefined && env[key] != null) continue;
      if (key !== undefined) delete env[key];
      env[k] = v;
    }
    const nodeOptions = keyOf(env, "NODE_OPTIONS") ?? "NODE_OPTIONS";
    env[nodeOptions] = withPreload(env[nodeOptions]);
    return env;
  };
  // env を指定しない呼び出し（子は process.env を受け継ぐ）も、process.env を元に足し直した env を明示して渡す
  const withTestEnv = (opts) => ({ ...opts, env: testEnv(opts.env ?? process.env) });
  const isOptions = (a) => a !== null && typeof a === "object" && !Array.isArray(a);
  // options の位置: spawn 系は (file, args?, options?, cb?)、exec 系は (command, options?, cb?)。options が無ければ、その位置（コールバックの前）に入れる
  const patchArgs = (args, spawnLike) => {
    const a = [...args];
    const at = spawnLike && (Array.isArray(a[1]) || a[1] == null) ? 2 : 1;
    if (isOptions(a[at])) a[at] = withTestEnv(a[at]);
    else if (a[at] == null) a[at] = withTestEnv({});
    else if (typeof a[at] === "function") a.splice(at, 0, withTestEnv({}));
    return a;
  };
  for (const [name, spawnLike] of Object.entries({ spawn: true, spawnSync: true, execFile: true, execFileSync: true, fork: true, exec: false, execSync: false })) {
    const orig = childProcess[name];
    unguarded[name] = orig;
    childProcess[name] = function (...args) {
      return orig.apply(this, patchArgs(args, spawnLike));
    };
  }
  // Worker: env を渡すと、NODE_OPTIONS も含めて親の env を受け継がない。execArgv を渡すと、親の --require を受け継がない
  const OrigWorker = workerThreads.Worker;
  unguarded.Worker = OrigWorker;
  workerThreads.Worker = class Worker extends OrigWorker {
    constructor(filename, options = {}) {
      const o = { ...options };
      if (o.env !== workerThreads.SHARE_ENV) o.env = testEnv(o.env && typeof o.env === "object" ? o.env : process.env);
      if (Array.isArray(o.execArgv) && !o.execArgv.some((a) => String(a).includes("test_env"))) o.execArgv = [...o.execArgv, "--require", self];
      super(filename, o);
    }
  };

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
  unguarded.symlinkSync = symlinkSync;
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

  // ---- 7. 空振り ----
  if (isTestFile) countAssertions();

  // `import { symlinkSync } from "fs"`・`import { spawnSync } from "child_process"`・`import { Worker } from "worker_threads"`・`import { equal } from "assert"`
  // のように名前で束縛された import にも効かせる
  module.syncBuiltinESMExports();

  // テストを走らせる親（node --test）の一時ディレクトリは、全テストファイルのプロセスの一時ディレクトリ（atr-proc-*）の親で、全員から os.tmpdir()/.. で届く。
  // そこに各プロセスの外の名前が現れたら（消されても）、並列のテストファイルが取り合える場所に書いたということなので失敗にする
  const shared = [];
  if (!isTestFile && !nested && workerThreads.isMainThread && process.execArgv.includes("--test")) {
    const existing = new Set(fs.readdirSync(tmpRoot));
    const watcher = fs.watch(tmpRoot, (event, name) => {
      if (name && !existing.has(name) && !name.startsWith("atr-proc-") && name !== path.basename(process.env.ATR_LINK_REGISTRY) && !shared.includes(name)) shared.push(name);
    });
    watcher.unref();
  }

  process.on("exit", () => {
    if (shared.length) {
      process.exitCode = 1;
      fs.writeSync(2, `\nテストが、テストファイルのプロセスの一時ディレクトリの外（npm test 全体の一時ディレクトリ・並列のテストファイルと共有）に書いた。os.tmpdir() の中に作る:\n${shared.map((n) => `  - <npm test の一時ディレクトリ>/${n}\n`).join("")}`);
    }
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
}
