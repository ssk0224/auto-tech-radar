// 「検証する環境」と「動かす環境」を分けない仕組みの検査（クラス 7: 検証が Linux の CI だけで、Windows・CRLF・権限・並列が検証の外だった）。
// owner PC（Windows 11・core.autocrlf=true・symlink の権限なし・テストを並列に走らせる）で落ちるのに CI（Linux）では緑、という種類の不具合を、
// ここで 2 段に止める。どちらも「書き方」を文字列で探さず、結果で止める（文字列の検査は別の書き方に必ずすり抜けられる）。
//   1. 全テストプロセスの先頭で読み込む tests/helpers/test_env.mjs・astro.config.mjs の拒否・tests/helpers/skip_gate_reporter.mjs（Linux の CI でも動く）:
//      git の global 設定を外す・junction 以外の symlink を拒否・テストからのリポ本体の astro build を拒否・許可していない理由の skip を失敗にする。
//      この検査は、それぞれを別々の書き方で実際に試して、拒否される／無害になることを確かめる。
//   2. .github/workflows/ci-windows.yml: 実際に Windows・CRLF の作業ツリーで全テストを走らせる（書き方では見つけられない種類を止める）。
//      その手順（autocrlf を checkout の前に設定・全ファイルを CRLF にする・Chrome が無ければ失敗・許可外の skip は失敗）が崩れていないかもここで確かめる。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { pathToFileURL } from "url";
import { spawnSync } from "child_process";
import { parseFrontmatter } from "astro/markdown";
import { unexpectedSkips } from "./helpers/skip_gate_reporter.mjs";

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
process.on("exit", () => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
// owner PC を再現した環境: HOME / USERPROFILE に core.autocrlf=true の .gitconfig がある。このプロセスが npm test の隔離を受けていても、子は隔離なしで始める
const fakeHome = path.join(tmp, "home");
fs.mkdirSync(fakeHome);
fs.writeFileSync(path.join(fakeHome, ".gitconfig"), "[core]\n\tautocrlf = true\n");
const cleanEnv = ({ fakeGitHome = true } = {}) => {
  const env = { ...process.env };
  if (fakeGitHome) Object.assign(env, { HOME: fakeHome, USERPROFILE: fakeHome, XDG_CONFIG_HOME: path.join(fakeHome, "xdg") });
  for (const k of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "ATR_GIT_ISOLATED", "ATR_TEST_RUN", "ATR_SITE_BUILD_COPY", "ATR_FORBID_SKIP", "NODE_TEST_CONTEXT"]) delete env[k];
  return env;
};
const probeFile = (name, body) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, body);
  return f;
};
const runProbe = (file, { withPreload, cwd = tmp, env = cleanEnv(), args = [] }) =>
  spawnSync(process.execPath, [...(withPreload ? ["--import", pathToFileURL(preload).href] : []), file, ...args], { cwd, env, encoding: "utf8", timeout: 180000 });

test("npm test は全テストプロセスで helpers/test_env.mjs を先に読み込み、skip を検査する報告係を使う", () => {
  const script = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts.test;
  assert.match(script, /--import\s+\.?\/?tests\/helpers\/test_env\.mjs/, "package.json の test に `--import ./tests/helpers/test_env.mjs` が必要");
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
  assert.deepEqual(unexpectedSkips([{ skip: "秘密鍵が無いため未実施（オーナー端末で npm test すると実行される）" }, { skip: "xvfb-run が無い環境では未実施" }]), []);
  const reporter = pathToFileURL(path.join(testsDir, "helpers/skip_gate_reporter.mjs")).href;
  const run = (reason, forbid) => {
    const dir = fs.mkdtempSync(path.join(tmp, "skip-"));
    const file = path.join(dir, "s.test.mjs");
    fs.writeFileSync(file, `import test from "node:test";\ntest("環境依存", { skip: ${JSON.stringify(reason)} }, () => {});\ntest("普通", () => {});\n`);
    const env = cleanEnv({ fakeGitHome: false });
    if (forbid) env.ATR_FORBID_SKIP = "1";
    return spawnSync(process.execPath, ["--test", "--test-reporter", reporter, file], { cwd: dir, env, encoding: "utf8", timeout: 60000 });
  };
  assert.equal(run("Chrome が無い環境では未実施", false).status, 0, "ふだん（Linux の CI・owner PC）は skip で失敗にしない");
  const bad = run("Chrome が無い環境では未実施", true);
  assert.notEqual(bad.status, 0, "ATR_FORBID_SKIP=1 で Chrome 無しの skip を失敗にしていない");
  assert.match(bad.stdout, /許可していない理由で skip/);
  assert.equal(run("秘密鍵が無いため未実施", true).status, 0, "許可した理由（秘密鍵が無い）は通る");
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
  const crlf = idx(/worktree_eol\.mjs crlf/);
  const tests = idx(/npm test/);
  for (const [name, i] of Object.entries({ autocrlf, checkout, crlf, tests })) assert.ok(i >= 0, `${name} の手順がありません`);
  assert.ok(autocrlf < checkout, "core.autocrlf=true は checkout より前に設定する（owner PC と同じ条件で作業ツリーを作る）");
  assert.ok(checkout < crlf && crlf < tests, "checkout → 作業ツリーを CRLF にする → テスト、の順");
  assert.equal(steps[tests].env?.ATR_REQUIRE_CHROME, "1", "Chrome が見つからないときに skip で緑にしない");
  assert.equal(steps[tests].env?.ATR_FORBID_SKIP, "1", "許可していない理由の skip（環境依存で何も検証しない）を失敗にする");
  for (const [i, s] of steps.entries()) {
    assert.ok(!s["continue-on-error"], `手順 ${i} に continue-on-error がある（赤を隠す）`);
    assert.doesNotMatch(s.run || "", /\|\|\s*(true|exit 0)/, `手順 ${i} が失敗を握りつぶしている`);
  }
  assert.ok(Number(job["timeout-minutes"]) > 0, "timeout-minutes が必要");
  assert.doesNotMatch(text, /secrets\./, "Windows の CI は秘密情報を使わない（有料本文の復号をしない）");
});
