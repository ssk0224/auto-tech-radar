// 「検証する環境」と「動かす環境」を分けない仕組みの検査（クラス 7: 検証が Linux の CI だけで、Windows・CRLF・権限・並列が検証の外だった）。
// owner PC（Windows 11・core.autocrlf=true・symlink の権限なし・テストを並列に走らせる）で落ちるのに CI（Linux）では緑、という種類の不具合を、
// ここで 2 段に止める。
//   1. この検査（Linux の CI でも動く）: 環境に依存する書き方（symlink の type "dir"・リポ本体での astro build・固定の Linux の Chrome・
//      git 設定を固定しないテスト用リポジトリ・LF 以外でコミットされたファイル）をテストに入れさせない。
//   2. .github/workflows/ci-windows.yml: 実際に Windows・CRLF の作業ツリーで全テストを走らせる（書き方では見つけられない種類を止める）。
//      その手順（autocrlf を checkout の前に設定・全ファイルを CRLF にする・Chrome が無ければ失敗）が崩れていないかもここで確かめる。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { parseFrontmatter } from "astro/markdown";

const root = path.resolve(import.meta.dirname, "..");
const testsDir = path.join(root, "tests");
const THIS = "env_portability.test.mjs";
const testFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith(".test.mjs") && f !== THIS);
const source = (f) => fs.readFileSync(path.join(testsDir, f), "utf8").replace(/\r\n/g, "\n");
// 行コメントは対象にしない（説明に書いた語で誤検出しない）
const code = (f) => source(f).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

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

test("テストはディレクトリの symlink を直接作らない（Windows では権限が無いと EPERM）。helpers/links.mjs の linkDir を使う", () => {
  for (const f of testFiles) assert.doesNotMatch(code(f), /\bsymlinkSync\s*\(/, `${f}: symlinkSync を直接呼んでいる`);
  assert.match(fs.readFileSync(path.join(testsDir, "helpers/links.mjs"), "utf8"), /win32[\s\S]*junction/, "links.mjs が Windows で junction を使っていない");
});

test("テストはリポ本体の中で astro build をしない（並列のテストが .astro/ などの作業ファイルを壊し合う）。helpers/site_build.mjs を使う", () => {
  for (const f of testFiles) {
    const c = code(f);
    assert.doesNotMatch(c, /node_modules\/astro\/package\.json|bin\.astro|["']build["']\s*,\s*["']--outDir["']/, `${f}: astro build を直接実行している`);
  }
  const helper = fs.readFileSync(path.join(testsDir, "helpers/site_build.mjs"), "utf8");
  assert.match(helper, /mkdtempSync/, "ビルドごとに別のコピーを作る");
  assert.doesNotMatch(helper.split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"), /cwd:\s*repoRoot/, "リポ本体を cwd にしてビルドしている");
});

test("Chrome を使うテストは helpers/chrome.mjs の探し方を使う（Linux の固定パスだけだと owner PC では全部 skip になり、緑のまま何も検証しない）", () => {
  for (const f of testFiles) {
    const c = code(f);
    if (/google-chrome|chromium-\d|\/usr\/bin\/chromium/.test(c)) assert.match(c, /helpers\/chrome\.mjs/, `${f}: Chrome のパスを自前で持っている`);
  }
  const helper = fs.readFileSync(path.join(testsDir, "helpers/chrome.mjs"), "utf8");
  assert.match(helper, /ATR_REQUIRE_CHROME/, "Windows の CI が Chrome 無しを失敗にできない");
});

test("git のリポジトリを作るテストは、マシンの git 設定（autocrlf など）から切り離している", () => {
  for (const f of testFiles) {
    const c = code(f);
    if (/["']init["']\s*,\s*["']-q["']/.test(c)) {
      assert.match(c, /isolateGitConfig\(\)/, `${f}: git init するのに isolateGitConfig() を呼んでいない`);
    }
  }
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
  for (const [i, s] of steps.entries()) {
    assert.ok(!s["continue-on-error"], `手順 ${i} に continue-on-error がある（赤を隠す）`);
    assert.doesNotMatch(s.run || "", /\|\|\s*(true|exit 0)/, `手順 ${i} が失敗を握りつぶしている`);
  }
  assert.ok(Number(job["timeout-minutes"]) > 0, "timeout-minutes が必要");
  assert.doesNotMatch(text, /secrets\./, "Windows の CI は秘密情報を使わない（有料本文の復号をしない）");
});
