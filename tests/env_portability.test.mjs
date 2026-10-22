// 「検証する環境」と「動かす環境」を分けない仕組みの検査（クラス 7: 検証が Linux の CI だけで、Windows・CRLF・権限・並列が検証の外だった）。
// owner PC（Windows 11・core.autocrlf=true・symlink の権限なし・テストを並列に走らせる）で落ちるのに CI（Linux）では緑、という種類の不具合を、
// ここで 2 段に止める。どちらも「書き方」を文字列で探さず、結果で止める（文字列の検査は別の書き方に必ずすり抜けられる）。
//   1. 全テストプロセスの先頭で読み込む tests/helpers/test_env.mjs・astro.config.mjs の拒否・tests/helpers/skip_gate_reporter.mjs（Linux の CI でも動く）:
//      git の global 設定を外す・junction 以外の symlink を拒否・テストからのリポ本体の astro build を拒否・許可していない理由の skip を失敗にする。
//      この検査は、それぞれを別々の書き方で実際に試して、拒否される／無害になることを確かめる。
//   2. .github/workflows/ci-windows.yml: 実際に Windows で、作業ツリーが LF（owner PC の実際の状態）と CRLF の両方で全テストを走らせる（書き方では見つけられない種類を止める）。
//      その手順（autocrlf を checkout の前に設定・改行の行列・symlink の権限を外す・Chrome が無ければ失敗・許可外の skip / todo は失敗）が崩れていないかもここで確かめる。
import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
import { spawnSync } from "child_process";
import { parseFrontmatter } from "astro/markdown";
import { unexpectedSkips } from "./helpers/skip_gate_reporter.mjs";
// 対照実験の子プロセスは、test_env.mjs の足し直しなしで起動する（仕組みが無いときに危険が見えることを確かめるため）
import { unguarded } from "./helpers/test_env.mjs";
const spawnRaw = unguarded.spawnSync;

const root = path.resolve(import.meta.dirname, "..");
const testsDir = path.join(root, "tests");

test("リポは改行を LF に宣言している（owner PC の core.autocrlf に挙動を預けない）", () => {
  const attrs = fs.readFileSync(path.join(root, ".gitattributes"), "utf8").replace(/\r\n/g, "\n");
  assert.match(attrs, /^\* +text=auto +eol=lf\s*$/m, ".gitattributes に `* text=auto eol=lf` が必要");
});

test("コミットされているテキストファイルはすべて LF（CRLF をリポに入れない）", () => {
  const r = spawnSync("git", ["ls-files", "--eol", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return; // git の履歴が無い環境（アーカイブの展開など）では確かめられない
  const bad = r.stdout.split("\0").filter(Boolean).filter((rec) => /^i\/(crlf|mixed)\s/.test(rec)).map((rec) => rec.split("\t")[1]);
  assert.deepEqual(bad, [], "index に CRLF を含むファイルがある（git add --renormalize . で直す）");
});

// ---- 環境依存の「書き方」でなく「結果」で止める検査 ----
// 以前はテストのソースを文字列で探していた（`"init", "-q"`・`symlinkSync(`・`bin.astro` など）。別の書き方（execFileSync・execSync の文字列・fs.promises.symlink・npx 経由の
// astro build）はすり抜けた。そこで危険な操作を実際に試し、どの書き方でも拒否される／無害になることを確かめる。
// 拒否・無害化の本体は helpers/test_env.mjs（git・symlink）・astro.config.mjs（astro build）・helpers/skip_gate_reporter.mjs（skip）。
const preload = path.join(testsDir, "helpers/test_env.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atr-envprobe-"));
// 終了時の検査（test_env.mjs: linkDir を通さないリンク）より前に、対照実験が作ったものを消す
after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
// owner PC を再現した環境: HOME / USERPROFILE に core.autocrlf=true の .gitconfig がある。このプロセスが npm test の隔離を受けていても、子は隔離なしで始める
const fakeHome = path.join(tmp, "home");
fs.mkdirSync(fakeHome);
fs.writeFileSync(path.join(fakeHome, ".gitconfig"), "[core]\n\tautocrlf = true\n");
const cleanEnv = ({ fakeGitHome = true } = {}) => {
  const env = { ...process.env, TMPDIR: tmp, TMP: tmp, TEMP: tmp };
  if (fakeGitHome) Object.assign(env, { HOME: fakeHome, USERPROFILE: fakeHome, XDG_CONFIG_HOME: path.join(fakeHome, "xdg") });
  for (const k of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "ATR_GIT_ISOLATED", "ATR_TEST_RUN", "ATR_SITE_BUILD_COPY", "ATR_FORBID_SKIP", "NODE_TEST_CONTEXT", "NODE_OPTIONS", "ATR_FAKE_HOME", "ATR_OWNER_DIR", "NOTE_VAULT_PRIVATE_KEY_FILE"]) delete env[k];
  return env;
};
const probeFile = (name, body) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, body);
  return f;
};
const runProbe = (file, { withPreload, cwd = tmp, env = cleanEnv(), args = [] }) =>
  spawnRaw(process.execPath, [...(withPreload ? ["--require", preload] : []), file, ...args], { cwd, env, encoding: "utf8", timeout: 180000 });

test("npm test は全テストプロセスで helpers/test_env.mjs を先に読み込み、skip を検査する報告係を使う", () => {
  const script = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts.test;
  // --import でなく --require: --import は、CommonJS の eval で起動した worker_threads の Worker では読み込まれない（--require はどの Worker でも読み込まれる）
  assert.match(script, /--require\s+\.?\/?tests\/helpers\/test_env\.mjs/, "package.json の test に `--require ./tests/helpers/test_env.mjs` が必要");
  assert.match(script, /--test-reporter[= ]\.?\/?tests\/helpers\/skip_gate_reporter\.mjs/, "package.json の test に skip_gate_reporter が必要");
  assert.match(script, /tests\/\*\.test\.mjs/, "tests/*.test.mjs を全部走らせる");
  // npm test から走っているとき、この検査自身がその仕組みの下にあること（直接 node --test したときは確かめない）
  if (process.env.npm_lifecycle_event === "test") {
    assert.equal(process.env.ATR_TEST_RUN, "1", "npm test なのに test_env.mjs が読み込まれていない");
    assert.equal(process.env.ATR_GIT_ISOLATED, "1");
  }
});

test("git: どう書いても（execSync の文字列・execFileSync・spawnSync）マシンの git 設定（autocrlf=true）を引き継がない", () => {
  const f = probeFile(
    "git_probe.mjs",
    `import { execSync, execFileSync, spawnSync } from "node:child_process";
import fs from "fs"; import os from "os"; import path from "path";
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "atr-gitprobe-"));
const cfg = (d) => spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8" }).stdout.trim();
const out = {};
const a = mk(); execSync("git init -q " + JSON.stringify(a)); out.shellString = cfg(a);
const b = mk(); execFileSync("git", ["init", "--quiet", b]); out.execFile = cfg(b);
const c = mk(); spawnSync("git", ["-C", c, "init"], { encoding: "utf8" }); out.spawn = cfg(c);
console.log(JSON.stringify(out));`
  );
  const control = runProbe(f, { withPreload: false });
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(JSON.parse(control.stdout), { shellString: "true", execFile: "true", spawn: "true" }, "対照: 隔離なしなら owner PC の autocrlf=true が見える（この検査が効く条件になっていない）");
  const isolated = runProbe(f, { withPreload: true });
  assert.equal(isolated.status, 0, isolated.stderr);
  assert.deepEqual(JSON.parse(isolated.stdout), { shellString: "", execFile: "", spawn: "" }, "test_env.mjs の下ではマシンの git 設定が見えない");
});

test("symlink: fs の symlink 系は、書き方（Sync・コールバック・promises・fs/promises・型の省略）によらず junction 以外を拒否する", () => {
  const f = probeFile(
    "symlink_probe.mjs",
    `import fs, { symlinkSync as bound } from "fs";
import fsp, { symlink as boundP } from "fs/promises";
import path from "path"; import os from "os";
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-linkprobe-")); fs.mkdirSync(path.join(d, "t"));
const t = path.join(d, "t"); let n = 0; const L = () => path.join(d, "l" + n++);
const res = {};
const attempt = async (name, fn) => { try { await fn(); res[name] = "created"; } catch (e) { res[name] = /links\.mjs/.test(String(e.message)) ? "guarded" : "failed-elsewhere:" + e.code; } };
await attempt("sync-dir", () => fs.symlinkSync(t, L(), "dir"));
await attempt("sync-file", () => fs.symlinkSync(t, L(), "file"));
await attempt("sync-notype", () => fs.symlinkSync(t, L()));
await attempt("bound-named-import", () => bound(t, L(), "dir"));
await attempt("callback", () => new Promise((ok, ng) => fs.symlink(t, L(), "dir", (e) => (e ? ng(e) : ok()))));
await attempt("callback-notype", () => new Promise((ok, ng) => fs.symlink(t, L(), (e) => (e ? ng(e) : ok()))));
await attempt("promises", () => fs.promises.symlink(t, L(), "dir"));
await attempt("fs/promises", () => fsp.symlink(t, L(), "dir"));
await attempt("fs/promises-named", () => boundP(t, L()));
await attempt("junction", () => fs.symlinkSync(t, L(), "junction"));
console.log(JSON.stringify(res));`
  );
  const control = runProbe(f, { withPreload: false });
  assert.equal(control.status, 0, control.stderr);
  const c = JSON.parse(control.stdout);
  assert.equal(c.junction, "created", "対照: 拒否なしでも junction は作れるはず（作れないと、この検査は何も確かめない）");
  assert.ok(Object.values(c).every((v) => !v.startsWith("guarded")), "対照: 拒否なしでは、この検査の拒否の文言は出ない");
  const guarded = runProbe(f, { withPreload: true });
  assert.equal(guarded.status, 0, guarded.stderr);
  const r = JSON.parse(guarded.stdout);
  // OS の権限エラー（Windows の EPERM）でなく、test_env.mjs の拒否で止まっていること（権限のある環境・Linux でも同じ結果になる）
  const notGuarded = Object.entries(r).filter(([k, v]) => k !== "junction" && v !== "guarded").map(([k, v]) => `${k}=${v}`);
  assert.deepEqual(notGuarded, [], "junction 以外の symlink が test_env.mjs の拒否を通り抜ける書き方がある");
  assert.equal(r.junction, "created", "junction（linkDir が使う）は作れる");
});

test("helpers/links.mjs の linkDir は、symlink の拒否の下でも動く（junction）", () => {
  const f = probeFile(
    "linkdir_probe.mjs",
    `import fs from "fs"; import path from "path"; import os from "os";
import { linkDir } from ${JSON.stringify(pathToFileURL(path.join(testsDir, "helpers/links.mjs")).href)};
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-linkdir-")); fs.mkdirSync(path.join(d, "t")); fs.writeFileSync(path.join(d, "t", "x.txt"), "ok");
linkDir(path.join(d, "t"), path.join(d, "l"));
console.log(fs.readFileSync(path.join(d, "l", "x.txt"), "utf8"));`
  );
  const r = runProbe(f, { withPreload: true });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), "ok");
});

test("astro: テストの中でリポ本体を astro build すると、どう呼んでも（bin・npx）設定の読み込みで止まる", () => {
  const astroBin = path.join(root, "node_modules", "astro", JSON.parse(fs.readFileSync(path.join(root, "node_modules/astro/package.json"), "utf8")).bin.astro);
  const out = path.join(tmp, "astro_out");
  const probe = probeFile(
    "astro_probe.mjs",
    `import { spawnSync } from "node:child_process";
const out = process.argv[2];
const via = { bin: [process.execPath, [${JSON.stringify(astroBin)}, "build", "--outDir", out], false], npx: ["npx", ["astro", "build", "--outDir", out], process.platform === "win32"] };
const res = {};
for (const [k, [cmd, args, shell]] of Object.entries(via)) {
  const r = spawnSync(cmd, args, { cwd: process.cwd(), encoding: "utf8", shell, timeout: 150000 });
  res[k] = { status: r.status, blocked: /site_build\\.mjs/.test(String(r.stdout) + String(r.stderr)) };
}
console.log(JSON.stringify(res));`
  );
  // プローブ自身が preload を読み込む（ATR_TEST_RUN=1 が子の astro に引き継がれる）。リポ本体が cwd
  const r = runProbe(probe, { withPreload: true, cwd: root, env: cleanEnv({ fakeGitHome: false }), args: [out] });
  assert.equal(r.status, 0, r.stderr);
  for (const [k, v] of Object.entries(JSON.parse(r.stdout))) {
    assert.notEqual(v.status, 0, `${k}: リポ本体の astro build が成功してしまった`);
    assert.ok(v.blocked, `${k}: astro.config.mjs の拒否で止まっていない`);
  }
  assert.ok(!fs.existsSync(out), "リポ本体のビルドが出力を作った");
});

test("skip: Windows の CI（ATR_FORBID_SKIP=1）は、許可していない理由の skip が 1 件でもあれば失敗にする（Chrome の探し方をどう書いても同じ）", () => {
  assert.equal(unexpectedSkips([{ skip: "Chrome が無い環境では未実施" }, { skip: "Chromium が無い環境" }, { skip: true }, { skip: "何かの理由" }]).length, 4);
  // 許可は理由の文言でなく、この実行の印（helpers/skips.mjs が、本当に無いと確かめてから付ける）で決める
  assert.equal(unexpectedSkips([{ skip: "秘密鍵が無いため未実施（オーナー端末で npm test すると実行される）" }, { skip: "xvfb-run が無い環境では未実施" }], "0123abcd").length, 2);
  assert.deepEqual(unexpectedSkips([{ skip: "秘密鍵が無いため未実施 [atr-skip:0123abcd]" }], "0123abcd"), []);
  assert.equal(unexpectedSkips([{ skip: "秘密鍵が無いため未実施 [atr-skip:ffff0000]" }], "0123abcd").length, 1, "別の実行の印は通さない");
  const reporter = pathToFileURL(path.join(testsDir, "helpers/skip_gate_reporter.mjs")).href;
  const run = (reason, forbid) => {
    const dir = fs.mkdtempSync(path.join(tmp, "skip-"));
    const file = path.join(dir, "s.test.mjs");
    fs.writeFileSync(file, `import test from "node:test";\ntest("環境依存", { skip: ${JSON.stringify(reason)} }, () => {});\ntest("普通", () => {});\n`);
    const env = cleanEnv({ fakeGitHome: false });
    if (forbid) env.ATR_FORBID_SKIP = "1";
    return spawnRaw(process.execPath, ["--test", "--test-reporter", reporter, file], { cwd: dir, env, encoding: "utf8", timeout: 60000 });
  };
  assert.equal(run("Chrome が無い環境では未実施", false).status, 0, "ふだん（Linux の CI・owner PC）は skip で失敗にしない");
  const bad = run("Chrome が無い環境では未実施", true);
  assert.notEqual(bad.status, 0, "ATR_FORBID_SKIP=1 で Chrome 無しの skip を失敗にしていない");
  assert.match(bad.stdout, /許可していない理由で skip/);
  assert.notEqual(run("秘密鍵が無いため未実施", true).status, 0, "許可した理由の文言を書いただけの skip が通る（印のある理由は、下の「skip の理由」のテストで確かめる）");
});

// ---- 2 回目の敵対検証（2026-10-22）ですり抜けた書き方 ----
// 子プロセスに env を「...process.env の写し」でなく一から渡す・git の GIT_* 環境変数を受け継ぐ・OS のコマンドでリンクを作る・
// 固定名の一時ディレクトリを並列のテストファイルで共有する・リポの中にファイルを書く・owner PC と違う Node / ロケール / 時間帯で CI を回す。
test("子プロセス: env を一から渡しても（execFileSync・execSync・exec・spawnSync・fork）git の隔離と astro の拒否が外れない", () => {
  const astroCfg = pathToFileURL(path.join(root, "astro.config.mjs")).href;
  const f = probeFile(
    "bare_env_probe.mjs",
    `import { execFileSync, execSync, exec, spawnSync, fork } from "node:child_process";
import fs from "fs"; import os from "os"; import path from "path"; import { promisify } from "util";
const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "atr-bareenv-"));
// 一から作った env（PATH と HOME だけ）。HOME は owner PC を再現した .gitconfig（autocrlf=true）を指す
const bare = () => ({ PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE });
const cfg = (d) => spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8", env: bare() }).stdout.trim();
const out = {};
{ const d = mk(); execFileSync("git", ["init", "-q", d], { env: bare() }); out.execFileSync = cfg(d); }
{ const d = mk(); execSync("git init -q " + JSON.stringify(d), { env: bare() }); out.execSync = cfg(d); }
{ const d = mk(); await promisify(exec)("git init -q " + JSON.stringify(d), { env: bare() }); out.exec = cfg(d); }
const load = "import(" + JSON.stringify(${JSON.stringify(astroCfg)}) + ").then(() => console.log('LOADED'), (e) => console.log(/site_build/.test(e.message) ? 'BLOCKED' : 'ERR ' + e.message))";
out.astroSpawnSync = spawnSync(process.execPath, ["--input-type=module", "-e", load], { env: bare(), encoding: "utf8" }).stdout.trim();
const child = path.join(os.tmpdir(), "fork_child.mjs"); fs.writeFileSync(child, load);
out.astroFork = await new Promise((ok) => { let s = ""; const p = fork(child, [], { env: bare(), silent: true }); p.stdout.on("data", (b) => (s += b)); p.on("exit", () => ok(s.trim())); });
console.log(JSON.stringify(out));`
  );
  const control = runProbe(f, { withPreload: false, cwd: root });
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(JSON.parse(control.stdout), { execFileSync: "true", execSync: "true", exec: "true", astroSpawnSync: "LOADED", astroFork: "LOADED" }, "対照: 仕組みなしなら、マシンの git 設定が見え、リポ本体の astro 設定が読み込める");
  const guarded = runProbe(f, { withPreload: true, cwd: root });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.deepEqual(JSON.parse(guarded.stdout), { execFileSync: "", execSync: "", exec: "", astroSpawnSync: "BLOCKED", astroFork: "BLOCKED" }, "env を一から渡した子プロセスで、test_env.mjs の隔離・拒否が外れる");
});

test("git: 受け継いだ GIT_* 環境変数（git の hook・owner のシェル）で、テストの git が別の設定・別のリポを使わない", () => {
  const decoy = path.join(tmp, "decoy.git");
  const f = probeFile(
    "git_vars_probe.mjs",
    `import { spawnSync } from "node:child_process"; import fs from "fs"; import os from "os"; import path from "path";
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gitvars-"));
spawnSync("git", ["init", "-q", d]);
console.log(JSON.stringify({ autocrlf: spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8" }).stdout.trim(), ownGitDir: fs.existsSync(path.join(d, ".git")) }));`
  );
  const env = { ...cleanEnv({ fakeGitHome: false }), GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "input", GIT_DIR: decoy };
  const control = runProbe(f, { withPreload: false, env });
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(JSON.parse(control.stdout), { autocrlf: "input", ownGitDir: false }, "対照: GIT_* を受け継ぐと、設定が入り、git init が GIT_DIR（別の場所）に作られる");
  fs.rmSync(decoy, { recursive: true, force: true });
  const guarded = runProbe(f, { withPreload: true, env });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.deepEqual(JSON.parse(guarded.stdout), { autocrlf: "", ownGitDir: true }, "test_env.mjs の下でも、受け継いだ GIT_* がテストの git に効いている");
  assert.ok(!fs.existsSync(decoy), "受け継いだ GIT_DIR の先に git が書いた");
});

test("一時ディレクトリ: テストのプロセスごとに別の os.tmpdir() になり、終わったら消える（固定名を並列のテストファイルで共有しても衝突しない）", () => {
  const f = probeFile("tmp_probe.mjs", `import os from "os"; import fs from "fs"; fs.writeFileSync(os.tmpdir() + "/shared-fixed-name.txt", "x"); console.log(os.tmpdir());`);
  const env = cleanEnv({ fakeGitHome: false });
  const control = [1, 2].map(() => runProbe(f, { withPreload: false, env }));
  assert.equal(control[0].stdout.trim(), control[1].stdout.trim(), "対照: 仕組みなしなら、どのプロセスも同じ os.tmpdir() を使う");
  const runs = [1, 2].map(() => runProbe(f, { withPreload: true, env }));
  for (const r of runs) assert.equal(r.status, 0, r.stderr);
  const [a, b] = runs.map((r) => r.stdout.trim());
  assert.notEqual(a, b, "テストのプロセスどうしが同じ os.tmpdir() を共有している");
  for (const d of [a, b]) {
    assert.equal(fs.realpathSync(path.dirname(d)), fs.realpathSync(tmp), "プロセスごとの一時ディレクトリは、元の一時ディレクトリの中に作る");
    assert.ok(!fs.existsSync(d), "プロセスの終了後に一時ディレクトリが残っている");
  }
});

test("リンク: fs を通さずに作ったリンク（OS のコマンド）も、テストのプロセスの終了時に見つけて失敗にする（Windows）", { skip: process.platform !== "win32" && "Windows 専用（Linux・macOS のリンクは権限が要らない。Windows の CI は管理者で動くので symlink が作れてしまい、owner PC との違いが出る）" }, () => {
  const f = probeFile(
    "oslink_probe.mjs",
    `import { execFileSync } from "node:child_process"; import fs from "fs"; import os from "os"; import path from "path";
import { linkDir } from ${JSON.stringify(pathToFileURL(path.join(testsDir, "helpers/links.mjs")).href)};
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-oslink-")); fs.mkdirSync(path.join(d, "t"));
if (process.argv[2] === "os") execFileSync("cmd.exe", ["/d", "/c", "mklink", "/J", path.join(d, "l"), path.join(d, "t")], { stdio: "pipe" });
else linkDir(path.join(d, "t"), path.join(d, "l"));
console.log(fs.lstatSync(path.join(d, "l")).isSymbolicLink());`
  );
  const env = cleanEnv({ fakeGitHome: false });
  const viaHelper = runProbe(f, { withPreload: true, env, args: ["helper"] });
  assert.equal(viaHelper.status, 0, viaHelper.stderr);
  const viaOs = runProbe(f, { withPreload: true, env, args: ["os"] });
  assert.equal(viaOs.stdout.trim(), "true", "対照: OS のコマンドでリンクが作れている");
  assert.notEqual(viaOs.status, 0, "linkDir を通さずに作ったリンクが、終了時の検査で止まらない");
  assert.match(viaOs.stderr, /links\.mjs/);
});

test("リポへの書き込み: テストが作業ツリーにファイルを残したら（並列のテストが壊し合う・コミットに混ざる）、npm test を失敗にする", () => {
  const reporter = pathToFileURL(path.join(testsDir, "helpers/skip_gate_reporter.mjs")).href;
  const run = (body) => {
    const repo = fs.mkdtempSync(path.join(tmp, "repo-"));
    const git = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" });
    git("init", "-q");
    fs.writeFileSync(path.join(repo, "w.test.mjs"), `import test from "node:test"; import fs from "fs";\n${body}\ntest("t", () => {});\n`);
    fs.writeFileSync(path.join(repo, "existing-untracked.txt"), "x"); // 走らせる前からある変更は、テストのせいにしない
    return spawnRaw(process.execPath, ["--test", "--test-reporter", reporter, "w.test.mjs"], { cwd: repo, env: cleanEnv({ fakeGitHome: false }), encoding: "utf8", timeout: 60000 });
  };
  assert.equal(run("").status, 0, "何も書かないテストは通る（走らせる前からある変更は数えない）");
  const atLoad = run(`fs.writeFileSync("stray-at-load.txt", "x");`);
  assert.notEqual(atLoad.status, 0, "テストファイルの読み込み時にリポへ書いたのに失敗にならない");
  assert.match(atLoad.stdout, /stray-at-load\.txt/);
  const inTest = run(`test("writes", () => { fs.mkdirSync("out", { recursive: true }); fs.writeFileSync("out/f.json", "{}"); });`);
  assert.notEqual(inTest.status, 0, "テストの中でリポへ書いたのに失敗にならない");
  assert.match(inTest.stdout, /out\/f\.json/);
});

test("サイトのビルド用コピーは、ビルド中に書かれる node_modules のキャッシュ（.vite・.astro）をリポ本体・ほかのコピーと共有しない", async () => {
  // node_modules を丸ごとリンクすると、並列の astro build が同じ node_modules/.vite/deps を作り直し合い、Windows で rename が EPERM になる（site_dist が 4 件落ちた）
  const { prepareBuildRoot, removeDir } = await import("./helpers/site_build.mjs");
  const [a, b] = [prepareBuildRoot("atr-cache-a-"), prepareBuildRoot("atr-cache-b-")];
  try {
    for (const cache of [".vite", ".astro"]) {
      fs.mkdirSync(path.join(a, "node_modules", cache, "probe"), { recursive: true });
      assert.ok(!fs.existsSync(path.join(b, "node_modules", cache, "probe")), `${cache}: ほかのビルド用コピーと共有している`);
      assert.ok(!fs.existsSync(path.join(root, "node_modules", cache, "probe")), `${cache}: リポ本体の node_modules と共有している`);
    }
    assert.ok(fs.existsSync(path.join(a, "node_modules", "astro", "package.json")), "パッケージはコピーから解決できる");
  } finally {
    for (const cache of [".vite", ".astro"]) fs.rmSync(path.join(root, "node_modules", cache, "probe"), { recursive: true, force: true }); // 共有していた場合の後始末
    removeDir(a);
    removeDir(b);
  }
});

// owner PC の Node・ロケール・時間帯（tests/helpers/owner_host.json）。Windows の CI はこれに合わせて走る。
// owner PC（CI でない）と、合わせているはずの Windows の CI（ATR_OWNER_MIRROR=1）では、実際の値がこれと一致することを確かめる（合わせ損ねたら赤になる）
const ownerHost = JSON.parse(fs.readFileSync(path.join(testsDir, "helpers/owner_host.json"), "utf8"));
// 権限の要る symlink（junction でないもの）を、このプロセスが実際に作れるか。test_env.mjs の拒否を通さない元の関数で試す
const canCreateSymlink = () => {
  const d = fs.mkdtempSync(path.join(tmp, "symcap-"));
  fs.mkdirSync(path.join(d, "t"));
  try {
    unguarded.symlinkSync(path.join(d, "t"), path.join(d, "l"), "dir");
    return true;
  } catch (e) {
    if (e.code === "EPERM") return false;
    throw e;
  } finally {
    fs.rmSync(d, { recursive: true, force: true });
  }
};
test("owner PC の Node・ロケール・時間帯・symlink の権限を宣言し、owner PC と Windows の CI の実際の値がそれと一致する", () => {
  assert.ok(Number.isInteger(ownerHost.node) && ownerHost.locale && ownerHost.timeZone, "owner_host.json に node（メジャー）・locale・timeZone が必要");
  assert.equal(typeof ownerHost.canCreateSymlink, "boolean", "owner_host.json に canCreateSymlink（権限の要る symlink を作れるか）が必要");
  if (process.env.CI && process.env.ATR_OWNER_MIRROR !== "1") return; // Linux の CI（本番と同じ環境）は owner PC に合わせない
  const actual = { node: Number(process.versions.node.split(".")[0]), locale: Intl.DateTimeFormat().resolvedOptions().locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, canCreateSymlink: canCreateSymlink() };
  // Windows の CI は管理者で動き、symlink を作れる（owner PC は作れない）。ci-windows.yml がテストの前にその権限を外す。外せたかをここで実際に確かめる
  assert.deepEqual(actual, { node: ownerHost.node, locale: ownerHost.locale, timeZone: ownerHost.timeZone, canCreateSymlink: ownerHost.canCreateSymlink }, "この環境は owner PC の宣言（tests/helpers/owner_host.json）と違う。owner PC が変わったなら宣言と ci-windows.yml を直す");
});

test("HANDOFF.md にテストの件数・合否の数字を手で書かない（書いた時点の数字は古くなり、Windows で落ちているのに「通る」と読める）", () => {
  const doc = fs.readFileSync(path.join(root, "docs/HANDOFF.md"), "utf8").replace(/\r\n/g, "\n");
  const stale = doc.split("\n").filter((l) => /テスト\s*\d+\s*件|\d+\s*\/\s*\d+\s*件(?:失敗|成功|通)|npm test[^\n]{0,20}\d+\s*件/.test(l));
  assert.deepEqual(stale, [], "テストの件数は書かない。現在の合否は ci-windows.yml と npm test の実行結果");
  assert.match(doc, /ci-windows\.yml/, "Windows の CI の存在を HANDOFF に書く");
});

test("Windows の CI（ci-windows.yml）は、owner PC と同じ条件で全テストを走らせ、環境依存の skip を失敗にする", () => {
  const file = path.join(root, ".github/workflows/ci-windows.yml");
  assert.ok(fs.existsSync(file), ".github/workflows/ci-windows.yml がありません");
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const wf = parseFrontmatter(`---\n${text}\n---\n`).frontmatter;
  const jobs = Object.values(wf.jobs);
  assert.equal(jobs.length, 1);
  const job = jobs[0];
  assert.equal(job["runs-on"], "windows-latest");
  assert.ok("push" in wf.on && "pull_request" in wf.on, "push と pull_request の両方で走らせる");
  const steps = job.steps;
  const idx = (re) => steps.findIndex((s) => re.test(`${s.run || ""} ${s.uses || ""}`));
  const autocrlf = idx(/core\.autocrlf true/);
  const checkout = idx(/actions\/checkout/);
  const eol = idx(/worktree_eol\.mjs \$\{\{ *matrix\.eol *\}\}/);
  const tests = idx(/npm test/);
  for (const [name, i] of Object.entries({ autocrlf, checkout, eol, tests })) assert.ok(i >= 0, `${name} の手順がありません`);
  assert.ok(autocrlf < checkout, "core.autocrlf=true は checkout より前に設定する（owner PC と同じ条件で作業ツリーを作る）");
  assert.ok(checkout < eol && eol < tests, "checkout → 作業ツリーの改行をそろえる → テスト、の順");
  // owner PC の作業ツリーは LF（.gitattributes の eol=lf）。CRLF だけで回すと「Windows で LF のファイル」（owner PC の実際の状態）がどこでも走らない。両方を回す
  assert.deepEqual([...(job.strategy?.matrix?.eol ?? [])].sort(), ["crlf", "lf"], "作業ツリーの改行 lf と crlf の両方で走らせる（strategy.matrix.eol）");
  assert.equal(job.strategy?.["fail-fast"], false, "片方が落ちても、もう片方の結果も見る");
  assert.match(String(steps[tests].env?.ATR_WORKTREE_EOL), /\$\{\{ *matrix\.eol *\}\}/, "各回が名乗った改行で走っていることをテストの中で確かめる");
  // Windows の CI は管理者で動き、権限の要る symlink を作れる（owner PC は作れない）。テストと同じプロセスの中で、その権限を外してから npm test する
  assert.match(steps[tests].run, /drop_symlink_privilege\.ps1[\s\S]*npm test/, "テストの前に、同じシェルの中で symlink の権限を外す");
  assert.equal(steps[tests].shell, "pwsh");
  assert.equal(steps[tests].env?.ATR_REQUIRE_CHROME, "1", "Chrome が見つからないときに skip で緑にしない");
  assert.equal(steps[tests].env?.ATR_FORBID_SKIP, "1", "許可していない理由の skip（環境依存で何も検証しない）を失敗にする");
  // owner PC と同じ Node・ロケール・時間帯（owner_host.json）。合わせたことはテストの中で実際の値で確かめる（ATR_OWNER_MIRROR=1）
  const node = steps.find((s) => /actions\/setup-node/.test(s.uses || ""));
  assert.equal(Number(node?.with?.["node-version"]), ownerHost.node, "Windows の CI の Node は owner PC と同じメジャーにする");
  const host = idx(/Set-Culture/);
  assert.ok(host >= 0 && host < tests, "テストの前にロケール・時間帯を owner PC に合わせる手順が必要");
  assert.match(steps[host].run, new RegExp(`Set-Culture\\s+${ownerHost.locale}\\b`));
  assert.match(steps[host].run, /tzutil\s+\/s\s+"[^"]+"/);
  assert.equal(steps[tests].env?.TZ, ownerHost.timeZone);
  assert.equal(steps[tests].env?.ATR_OWNER_MIRROR, "1", "合わせた値をテストの中で確かめる");
  for (const [i, s] of steps.entries()) {
    assert.ok(!s["continue-on-error"], `手順 ${i} に continue-on-error がある（赤を隠す）`);
    assert.doesNotMatch(s.run || "", /\|\|\s*(true|exit 0)/, `手順 ${i} が失敗を握りつぶしている`);
  }
  assert.ok(Number(job["timeout-minutes"]) > 0, "timeout-minutes が必要");
  assert.doesNotMatch(text, /secrets\./, "Windows の CI は秘密情報を使わない（有料本文の復号をしない）");
});

// ---- 3 回目の敵対検証（2026-10-22）ですり抜けた書き方 ----
// worker_threads の Worker に env を渡す・テストが起動した素の node（孫）が env を一から作る・skip の代わりに todo・skip せずに return・
// owner のホーム（~/.auto-tech-radar）を見る・OS のコマンドで権限の要る symlink を一時ディレクトリの外に作る・owner PC の LF の作業ツリー。
const astroCfgUrl = pathToFileURL(path.join(root, "astro.config.mjs")).href;
// 実体のパス（もう消えた部分は、残っている親を実体に解決してつなぐ。プロセスの終了で一時ディレクトリは消える）
const real = (p) => {
  try {
    return fs.realpathSync.native(p);
  } catch {
    const parent = path.dirname(p);
    return parent === p ? p : path.join(real(parent), path.basename(p));
  }
};
const under = (dir, p) => {
  const rel = path.relative(real(dir), real(p));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
};

test("worker_threads: env・execArgv を指定した Worker（CommonJS の eval を含む）でも、git の隔離・astro の拒否・一時ディレクトリが外れない", () => {
  const f = probeFile(
    "worker_probe.mjs",
    `import { Worker } from "node:worker_threads";
const code = \`const cp = require("child_process"), fs = require("fs"), os = require("os"), path = require("path"), { parentPort } = require("worker_threads");
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wk-"));
cp.spawnSync("git", ["init", "-q", d], { env });
const auto = cp.spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8", env }).stdout.trim();
import(${JSON.stringify(astroCfgUrl)}).then(() => "LOADED", (e) => (/site_build/.test(e.message) ? "BLOCKED" : "ERR " + e.message)).then((astro) => parentPort.postMessage({ auto, astro, tmp: os.tmpdir() }));\`;
const bare = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
const run = (opts) => new Promise((ok, ng) => { const w = new Worker(code, { eval: true, ...opts }); w.once("message", ok); w.once("error", ng); });
console.log(JSON.stringify({ explicitEnv: await run({ env: bare }), emptyExecArgv: await run({ env: bare, execArgv: [] }) }));`
  );
  const shape = (r) => Object.fromEntries(Object.entries(JSON.parse(r.stdout)).map(([k, v]) => [k, { auto: v.auto, astro: v.astro, testTmp: under(tmp, v.tmp) }]));
  const control = runProbe(f, { withPreload: false, cwd: root });
  assert.equal(control.status, 0, control.stderr);
  const off = { auto: "true", astro: "LOADED", testTmp: false };
  assert.deepEqual(shape(control), { explicitEnv: off, emptyExecArgv: off }, "対照: 仕組みなしの Worker では、マシンの git 設定・リポ本体の astro 設定・共有の一時ディレクトリが見える");
  const guarded = runProbe(f, { withPreload: true, cwd: root });
  assert.equal(guarded.status, 0, guarded.stderr);
  const on = { auto: "", astro: "BLOCKED", testTmp: true };
  assert.deepEqual(shape(guarded), { explicitEnv: on, emptyExecArgv: on }, "Worker の中で test_env.mjs の隔離・拒否が外れる");
});

test("孫プロセス: テストが起動した素の node が env を一から作って git・node を起動しても、隔離・拒否が外れない", () => {
  const child = `const cp = require("child_process"), fs = require("fs"), os = require("os"), path = require("path");
const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
const d = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gc-"));
cp.spawnSync("git", ["init", "-q", d], { env });
const auto = cp.spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8", env }).stdout.trim();
const load = "import(" + JSON.stringify(${JSON.stringify(astroCfgUrl)}) + ").then(() => console.log('LOADED'), (e) => console.log(/site_build/.test(e.message) ? 'BLOCKED' : 'ERR ' + e.message))";
const astro = cp.spawnSync(process.execPath, ["--input-type=module", "-e", load], { encoding: "utf8", env }).stdout.trim();
console.log(JSON.stringify({ auto, astro }));`;
  const f = probeFile(
    "grandchild_probe.mjs",
    `import { spawnSync } from "node:child_process";
// --import / --require なしの素の node（本番のスクリプトをテストから起動する形）。env は受け継ぐ
const r = spawnSync(process.execPath, ["-e", ${JSON.stringify(child)}], { encoding: "utf8" });
process.stdout.write(r.stdout); process.stderr.write(r.stderr);`
  );
  const control = runProbe(f, { withPreload: false, cwd: root });
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(JSON.parse(control.stdout), { auto: "true", astro: "LOADED" }, "対照: 仕組みなしなら孫からマシンの git 設定・リポ本体の astro 設定が見える");
  const guarded = runProbe(f, { withPreload: true, cwd: root });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.deepEqual(JSON.parse(guarded.stdout), { auto: "", astro: "BLOCKED" }, "孫プロセスで test_env.mjs の隔離・拒否が外れる");
});

// テストファイルを、npm test と同じ形（preload・報告係）で一時ディレクトリの中で走らせる
const runTestFile = (body, { forbid = false, withPreload = true } = {}) => {
  const dir = fs.mkdtempSync(path.join(tmp, "tf-"));
  fs.writeFileSync(path.join(dir, "x.test.mjs"), `import test from "node:test";\nimport assert from "node:assert/strict";\n${body}\n`);
  const env = cleanEnv({ fakeGitHome: false });
  if (forbid) env.ATR_FORBID_SKIP = "1";
  const reporter = path.join(testsDir, "helpers/skip_gate_reporter.mjs");
  return spawnRaw(process.execPath, [...(withPreload ? ["--require", preload] : []), "--test", "--test-reporter", pathToFileURL(reporter).href, "x.test.mjs"], { cwd: dir, env, encoding: "utf8", timeout: 60000 });
};

test("todo: 環境で実行できないテストを skip でなく todo にしても、失敗を隠さない（本体の失敗は常に・todo そのものは Windows の CI で失敗にする）", () => {
  const failing = `test("Chrome の確認", { todo: "Chrome が見つからない環境" }, () => { assert.ok(false, "Chrome が無い"); });`;
  const r1 = runTestFile(failing);
  assert.notEqual(r1.status, 0, "todo にした本体の失敗が隠れて緑になる");
  assert.match(r1.stdout, /todo/);
  const passing = `test("Chrome の確認", { todo: "Chrome が見つからない環境" }, () => { assert.ok(true); });`;
  assert.equal(runTestFile(passing).status, 0, "ふだんは、本体が通る todo では失敗にしない");
  const r2 = runTestFile(passing, { forbid: true });
  assert.notEqual(r2.status, 0, "ATR_FORBID_SKIP=1 で、許可していない理由の todo を失敗にしていない");
  assert.match(r2.stdout, /Chrome が見つからない環境/);
});

test("空振り: 一つもアサーションを実行せずに通ったテスト（環境が無いので return した等）を失敗にする", () => {
  const vacuous = `test("ブラウザの確認", (t) => { const chrome = process.env.ATR_NO_SUCH_BROWSER; if (!chrome) { t.diagnostic("Chrome が無い"); return; } assert.ok(chrome); });`;
  const control = runTestFile(vacuous, { withPreload: false });
  assert.equal(control.status, 0, "対照: 仕組みなしなら空振りのテストは緑");
  const r = runTestFile(vacuous);
  assert.notEqual(r.status, 0, "アサーションを一つも実行しなかったテストが緑のまま");
  assert.match(r.stdout, /アサーションを一つも実行していない/);
  const fine = `import { equal } from "node:assert";
test("名前で import した assert", () => { equal(1, 1); });
test("strict", () => { assert.deepEqual([1], [1]); });
test("throws", () => { assert.throws(() => { throw new Error("x"); }); });
test("rejects", async () => { await assert.rejects(Promise.reject(new Error("x"))); });
test("skip の宣言", { skip: "秘密鍵が無い" }, () => {});
test("中で t.skip", (t) => { t.skip("秘密鍵が無い"); });
test("親は子のアサーションで足りる", async (t) => { await t.test("子", () => assert.ok(true)); });`;
  const ok = runTestFile(fine);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test("owner のホーム: テストは本物の ~/.auto-tech-radar（秘密鍵・Chrome のプロファイル・復号した原稿）を見ない（ATR_OWNER_DIR を消しても）", () => {
  const f = probeFile(
    "ownerdir_probe.mjs",
    `import os from "os";
delete process.env.ATR_OWNER_DIR;
const { ownerDir } = await import(${JSON.stringify(pathToFileURL(path.join(root, "scripts/utils/owner_dir.mjs")).href)});
console.log(JSON.stringify({ ownerDir, home: os.homedir(), userInfoHome: os.userInfo().homedir }));`
  );
  // このプロセスの環境はすでにテスト用のホームを指すので、対照は OS のアカウントの本物のホームで始める（子は表示するだけ）
  const realHome = unguarded.userInfo.call(os).homedir;
  const env = cleanEnv({ fakeGitHome: false });
  const control = runProbe(f, { withPreload: false, env: { ...env, HOME: realHome, USERPROFILE: realHome } });
  assert.equal(control.status, 0, control.stderr);
  const c = JSON.parse(control.stdout);
  assert.equal(c.ownerDir, path.join(c.home, ".auto-tech-radar"), "対照: 仕組みなしなら本物のホームの下を見る");
  assert.equal(c.userInfoHome, c.home, "対照: os.userInfo().homedir も本物のホーム");
  const guarded = runProbe(f, { withPreload: true, env });
  assert.equal(guarded.status, 0, guarded.stderr);
  const g = JSON.parse(guarded.stdout);
  assert.notEqual(g.ownerDir, c.ownerDir, "test_env.mjs の下でも本物の owner ディレクトリを見る");
  assert.ok(under(tmp, g.home), "テストのホームは、テストの一時ディレクトリの中");
  assert.equal(g.userInfoHome, g.home, "os.userInfo().homedir から本物のホームが見える");
});

test("子プロセス: テストが process.env を置き換えても・GIT_CONFIG_GLOBAL などを消しても、env を指定せずに起動した子で隔離・拒否が外れない", () => {
  const f = probeFile(
    "env_tamper_probe.mjs",
    `import { spawnSync, execSync, execFile } from "node:child_process"; import fs from "fs"; import os from "os"; import path from "path";
const base = os.tmpdir(); let n = 0;
const mk = () => { const d = path.join(base, "tamper-" + n++); fs.mkdirSync(d); return d; };
const cfg = (d) => spawnSync("git", ["-C", d, "config", "--get", "core.autocrlf"], { encoding: "utf8" }).stdout.trim();
const load = "import(" + JSON.stringify(${JSON.stringify(astroCfgUrl)}) + ").then(() => console.log('LOADED'), (e) => console.log(/site_build/.test(e.message) ? 'BLOCKED' : 'ERR ' + e.message))";
const out = {};
const saved = { ...process.env };
for (const k of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "ATR_TEST_RUN", "NODE_OPTIONS"]) delete process.env[k];
{ const d = mk(); execSync("git init -q " + JSON.stringify(d)); out.deleted = cfg(d); }
process.env = { PATH: saved.PATH, SystemRoot: saved.SystemRoot, HOME: saved.HOME, USERPROFILE: saved.USERPROFILE };
{ const d = mk(); spawnSync("git", ["init", "-q", d]); out.replaced = cfg(d); }
{ const d = mk(); await new Promise((ok) => execFile("git", ["init", "-q", d], ok)); out.callback = cfg(d); }
out.astro = spawnSync(process.execPath, ["--input-type=module", "-e", load], { encoding: "utf8" }).stdout.trim();
console.log(JSON.stringify(out));`
  );
  const control = runProbe(f, { withPreload: false, cwd: root });
  assert.equal(control.status, 0, control.stderr);
  assert.deepEqual(JSON.parse(control.stdout), { deleted: "true", replaced: "true", callback: "true", astro: "LOADED" }, "対照: 仕組みなしなら、マシンの git 設定・リポ本体の astro 設定が見える");
  const guarded = runProbe(f, { withPreload: true, cwd: root });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.deepEqual(JSON.parse(guarded.stdout), { deleted: "", replaced: "", callback: "", astro: "BLOCKED" }, "process.env を書き換えたテストの子で、test_env.mjs の隔離・拒否が外れる");
});

test("作業ツリーの改行: Windows の CI の各回は、名乗った改行（lf / crlf）の作業ツリーで実際に走っている", (t) => {
  const want = process.env.ATR_WORKTREE_EOL;
  if (!want) return t.skip("Windows の CI の行列（ATR_WORKTREE_EOL）の外");
  assert.match(want, /^(lf|crlf)$/);
  const r = spawnSync("git", ["ls-files", "--eol", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const other = r.stdout.split("\0").filter(Boolean).filter((rec) => /^i\/lf\s/.test(rec) && !new RegExp(`\\sw/(${want}|none)\\s`).test(rec));
  assert.deepEqual(other.slice(0, 5), [], `作業ツリーが ${want} でない`);
});

// ---- 4 回目の敵対検証（2026-10-22）ですり抜けた書き方 ----
// 隔離を関数（os.homedir・child_process）の差し替えだけで作ると、環境変数（HOME・USERPROFILE・LOCALAPPDATA）を直接読む・
// 値を undefined にして渡す・シェルで消す、で外れる。プロセスの環境そのものを、テスト用のホームに向ける。
test("owner のホーム（環境変数）: HOME・USERPROFILE・LOCALAPPDATA・APPDATA を直接読んでも、git の隔離を undefined・シェルで外しても、本物のホームに届かない", () => {
  const ownerHome = fakeHome; // owner PC を再現したホーム（.gitconfig に autocrlf=true）
  const f = probeFile(
    "home_env_probe.mjs",
    `import { spawnSync } from "node:child_process"; import fs from "fs"; import os from "os"; import path from "path";
const ownerHome = process.argv[2];
const key = (p) => path.resolve(p).toLowerCase();
const under = (p) => Boolean(p) && (key(p) + path.sep).startsWith(key(ownerHome) + path.sep);
const out = { env: ["HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "XDG_CONFIG_HOME"].filter((k) => under(process.env[k])) };
const d = fs.mkdtempSync(path.join(os.tmpdir(), "homeenv-"));
spawnSync("git", ["init", "-q", d]);
const get = ["-C", d, "config", "--get", "core.autocrlf"];
out.undef = spawnSync("git", get, { env: { ...process.env, GIT_CONFIG_GLOBAL: undefined, GIT_CONFIG_NOSYSTEM: undefined, GIT_CONFIG_SYSTEM: undefined }, encoding: "utf8" }).stdout.trim();
const unset = process.platform === "win32" ? 'set "GIT_CONFIG_GLOBAL=" && git ' : "unset GIT_CONFIG_GLOBAL; git ";
out.shell = spawnSync(unset + get.map((a) => JSON.stringify(a)).join(" "), { shell: true, encoding: "utf8" }).stdout.trim();
out.rebuilt = spawnSync("git", get, { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM: "1", HOME: process.env.USERPROFILE || process.env.HOME }, encoding: "utf8" }).stdout.trim();
console.log(JSON.stringify(out));`
  );
  const env = { ...cleanEnv(), LOCALAPPDATA: path.join(ownerHome, "AppData", "Local"), APPDATA: path.join(ownerHome, "AppData", "Roaming") };
  // 対照: 仕組みなしなら、環境変数がそのまま owner のホームを指し、git は owner の .gitconfig を読む
  const control = runProbe(f, { withPreload: false, env, args: [ownerHome] });
  assert.equal(control.status, 0, control.stderr);
  const c = JSON.parse(control.stdout);
  assert.deepEqual(c.env, ["HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "XDG_CONFIG_HOME"]);
  assert.equal(c.rebuilt, "true", "対照: 仕組みなしなら、USERPROFILE から組み立てた HOME で owner の .gitconfig が見える");
  const guarded = runProbe(f, { withPreload: true, env, args: [ownerHome] });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.deepEqual(JSON.parse(guarded.stdout), { env: [], undef: "", shell: "", rebuilt: "" }, "test_env.mjs の下で、環境変数・git の既定の置き場所から owner のホームに届く");
});

test("astro: テストのプロセスの中で ATR_TEST_RUN を消してから読み込んでも、リポ本体の astro 設定は拒否される", () => {
  const f = probeFile(
    "astro_inproc_probe.mjs",
    `delete process.env.ATR_TEST_RUN;
import(${JSON.stringify(astroCfgUrl)}).then(() => console.log("LOADED"), (e) => console.log(/site_build/.test(e.message) ? "BLOCKED" : "ERR " + e.message));`
  );
  const guarded = runProbe(f, { withPreload: true, cwd: root });
  assert.equal(guarded.status, 0, guarded.stderr);
  assert.equal(guarded.stdout.trim(), "BLOCKED");
  // ビルド用コピーの印（ATR_SITE_BUILD_COPY=1）を自分で立てても、リポ本体（git の作業ツリー）の設定は拒否される
  const forged = runProbe(f, { withPreload: true, cwd: root, env: { ...cleanEnv(), ATR_SITE_BUILD_COPY: "1" } });
  assert.equal(forged.status, 0, forged.stderr);
  assert.equal(forged.stdout.trim(), "BLOCKED", "ATR_SITE_BUILD_COPY=1 を立てるだけで、リポ本体の astro 設定が読み込める");
});

test("空振り（ファイル全体）: テストを登録する前・走らせ終える前にプロセスを終えたファイルは、緑にしない", () => {
  for (const exit of ["process.exit(0);", "process.reallyExit(0);"]) {
    const body = `${exit}\ntest("Windows では走らない", () => { assert.equal(1, 2); });`;
    assert.equal(runTestFile(body, { withPreload: false }).status, 0, `対照: 仕組みなしなら ${exit} のファイルは緑`);
    const r = runTestFile(body);
    assert.notEqual(r.status, 0, `${exit} でテストを走らせずに終えたファイルが緑のまま`);
    assert.match(r.stderr + r.stdout, /走らせ終える前に/);
  }
  const midway = runTestFile(`test("一つ目", () => { assert.ok(true); });\ntest("二つ目", () => { process.exit(0); });\ntest("三つ目", () => { assert.equal(1, 2); });`);
  assert.notEqual(midway.status, 0, "テストの途中で process.exit(0) したファイルが緑のまま");
  const none = runTestFile(`if (process.env.ATR_NO_SUCH_ENV) test("条件つき", () => { assert.ok(true); });`);
  assert.notEqual(none.status, 0, "テストが一つも登録されなかったファイルが緑のまま");
  assert.match(none.stdout + none.stderr, /一つも登録されなかった/);
});

test("空振り（並行）: 並行に走るテストでも、アサーションを実行しなかったテストを、隣のテストのアサーションで緑にしない", () => {
  const body = `test.describe("並行", { concurrency: true }, () => {
  test("検証する", async () => { await new Promise((r) => setTimeout(r, 50)); assert.ok(true); await new Promise((r) => setTimeout(r, 300)); });
  test("何もしない", async () => { await new Promise((r) => setTimeout(r, 200)); });
});`;
  const r = runTestFile(body);
  assert.notEqual(r.status, 0, "並行のテストで、空振りのテストが隣のアサーションで緑になる");
  assert.match(r.stdout, /アサーションを一つも実行していない/);
  const fine = `test.describe("並行", { concurrency: true }, () => {
  test("a", async () => { await new Promise((r) => setTimeout(r, 30)); assert.ok(true); });
  test("a", async () => { assert.ok(true); await new Promise((r) => setTimeout(r, 10)); });
});
test("t.assert だけ", (t) => { t.assert.strictEqual(1 + 1, 2); });
test("コールバックの中", async () => { await new Promise((ok) => setTimeout(() => { assert.ok(true); ok(); }, 10)); });`;
  const ok = runTestFile(fine);
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
});

test("skip の理由: 許可した理由の文言を書いただけの skip は、Windows の CI で通らない（理由は、実際に無いことを確かめた helpers/skips.mjs だけが出す）", () => {
  const skips = JSON.stringify(pathToFileURL(path.join(testsDir, "helpers/skips.mjs")).href);
  const forged = runTestFile(`test("Chrome の確認", { skip: "Chrome 未検出（秘密鍵が無い環境と同じ扱い）" }, () => { assert.equal(1, 2); });`, { forbid: true });
  assert.notEqual(forged.status, 0, "許可した理由の文言を含むだけの skip が ATR_FORBID_SKIP=1 で通る");
  assert.match(forged.stdout, /許可していない理由で skip/);
  const real = runTestFile(`const { noPrivateKey } = await import(${skips});\ntest("有料本文", (t) => { t.skip(noPrivateKey()); });`, { forbid: true });
  assert.equal(real.status, 0, "鍵が実際に無いことを確かめた skip が通らない: " + real.stdout + real.stderr);
});

test("リポの状態: テストが作業ツリーの外（.git/config・ブランチ・タグ・hooks）を書き換えたら、npm test を失敗にする", () => {
  const reporter = pathToFileURL(path.join(testsDir, "helpers/skip_gate_reporter.mjs")).href;
  const run = (body) => {
    const repo = fs.mkdtempSync(path.join(tmp, "repo-"));
    const git = (...a) => spawnSync("git", ["-C", repo, ...a], { encoding: "utf8" });
    git("init", "-q");
    git("-c", "user.name=t", "-c", "user.email=t@example.invalid", "commit", "-q", "--allow-empty", "-m", "init");
    fs.writeFileSync(path.join(repo, ".git", "info", "exclude"), "*.test.mjs\n");
    fs.writeFileSync(path.join(repo, "w.test.mjs"), `import test from "node:test"; import fs from "fs"; import { spawnSync } from "node:child_process";\n${body}\ntest("t", () => {});\n`);
    return spawnRaw(process.execPath, ["--test", "--test-reporter", reporter, "w.test.mjs"], { cwd: repo, env: cleanEnv({ fakeGitHome: false }), encoding: "utf8", timeout: 60000 });
  };
  assert.equal(run("").status, 0, "何も書き換えないテストは通る");
  for (const [body, what] of [
    [`spawnSync("git", ["config", "--local", "atr.injected", "yes"]);`, /\.git\/config/],
    [`spawnSync("git", ["tag", "atr-injected"]);`, /refs/],
    [`spawnSync("git", ["branch", "atr-injected"]);`, /ブランチの一覧/],
    [`fs.writeFileSync(".git/hooks/pre-commit", "#!/bin/sh\\n");`, /\.git\/hooks\/pre-commit/],
  ]) {
    const r = run(body);
    assert.notEqual(r.status, 0, `作業ツリーの外のリポの状態を書き換えたのに失敗にならない: ${body}`);
    assert.match(r.stdout, what);
  }
});

test("一時ディレクトリ（実行全体で共有）: os.tmpdir() の親（npm test 全体の一時ディレクトリ）に書いたら、消しても失敗にする（並列のテストファイルが同じ場所を取り合う）", () => {
  const body = `import fs from "fs"; import os from "os"; import path from "path";
test("隣の一時ディレクトリ", () => { const d = path.join(os.tmpdir(), "..", "atr-shared"); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, "x"), "1"); fs.rmSync(d, { recursive: true, force: true }); assert.ok(true); });`;
  assert.equal(runTestFile(body, { withPreload: false }).status, 0, "対照: 仕組みなしなら緑");
  const r = runTestFile(body);
  assert.notEqual(r.status, 0, "テストファイルのプロセスの外（実行全体の一時ディレクトリ）に書いたのに緑");
  assert.match(r.stdout + r.stderr, /atr-shared/);
});
