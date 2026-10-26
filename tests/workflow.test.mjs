// 毎日の定期実行（.github/workflows/daily-crawl.yml）の手順の並び・失敗時のふるまいの不変条件。
// 手順を足したり並べ替えたりしたときに、黙って記録を失う・無言で何時間も止まる手順を作らないための検査
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { parseFrontmatter } from "astro/markdown";
import { MERGE_DRIVERS } from "../scripts/utils/git_sync.mjs";
import { RUN_REASONS } from "../scripts/utils/run_status.mjs";
import { isolateGitConfig } from "./helpers/git_env.mjs";

const root = path.resolve(import.meta.dirname, "..");

// このテストが作る git リポジトリを、マシンの git 設定（owner PC の core.autocrlf=true など）から切り離す
isolateGitConfig();
const WORKFLOW = fs.readFileSync(path.join(root, ".github/workflows/daily-crawl.yml"), "utf8");
// YAML の解析は、サイトのビルドと同じ Astro の frontmatter 用の解析器を使う（依存パッケージを増やさない）
const wf = parseFrontmatter(`---\n${WORKFLOW}\n---\n`).frontmatter;
const steps = wf.jobs["run-radar"].steps;
const label = (s, i) => `${i}: ${s.name || s.run || s.uses}`;

test(".gitattributes の merge=<名前> にはすべてマージドライバがあり、CI はどの git pull よりも前にそれを設定する", () => {
  const names = [...fs.readFileSync(path.join(root, ".gitattributes"), "utf8").matchAll(/\bmerge=([\w-]+)/g)].map((m) => m[1]);
  assert.ok(names.length > 0);
  for (const n of names) {
    const driver = MERGE_DRIVERS[`merge.${n}.driver`];
    assert.ok(driver, `merge=${n} のドライバが scripts/utils/git_sync.mjs にありません`);
    const script = driver.match(/scripts\/[\w.]+\.mjs/)[0];
    assert.ok(fs.existsSync(path.join(root, script)), `${script} がありません`);
  }
  const configure = steps.findIndex((s) => /node scripts\/utils\/git_sync\.mjs configure/.test(s.run || ""));
  assert.ok(configure >= 0, "マージドライバを設定する手順がありません");
  steps.forEach((s, i) => {
    if (/\bgit (?:pull|rebase|merge)\b/.test(s.run || "")) assert.ok(i > configure, `${label(s, i)} がマージドライバの設定より前に git pull しています`);
  });
  // ドライバの定義は git_sync.mjs の 1 か所だけ（workflow に書き写すと片方だけ古くなる）
  assert.doesNotMatch(WORKFLOW, /git config merge\./);
});

test("git push / git pull の失敗を `|| true` で黙って捨てない", () => {
  steps.forEach((s, i) => {
    for (const line of String(s.run || "").split("\n")) {
      assert.doesNotMatch(line, /\bgit (?:push|pull)\b[^\n]*\|\|\s*true/, `${label(s, i)}: ${line.trim()}`);
    }
  });
});

test("失敗しても続行する手順（continue-on-error）には時間の上限がある（止まったまま後続の便を待たせない）", () => {
  steps.forEach((s, i) => {
    if (s["continue-on-error"]) assert.ok(Number(s["timeout-minutes"]) > 0, `${label(s, i)} に timeout-minutes がありません`);
  });
});

test("workflow が記録する実行結果の reason は run_status の一覧にあり、品質ゲートで取り除いた回は rejected を記録する", () => {
  const used = [...WORKFLOW.matchAll(/run_status\.mjs (\w+)/g)].map((m) => m[1]);
  assert.ok(used.includes("rejected"));
  for (const r of used) assert.ok(RUN_REASONS.includes(r), `${r} は RUN_REASONS にありません`);
  const gate = steps.find((s) => s.id === "gate");
  assert.ok(gate.run.indexOf("run_status.mjs rejected") < gate.run.indexOf("git checkout -- src/pages/radar"), "取り除く前に記録する");
});

test("品質ゲートに落ちたとき、この実行が commit するもの（data/ の実行記録を除く）はすべて元に戻せる（戻せないものが原因で公開が止まらない）", () => {
  const commit = steps.find((s) => s.name === "Commit and push changes");
  const added = commit.run.match(/^\s*git add (.+)$/m)[1].trim().split(/\s+/).map((p) => p.replace(/\/$/, ""));
  const gate = steps.find((s) => s.id === "gate");
  const restored = [...gate.run.matchAll(/^\s*git checkout -- (.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/).map((p) => p.replace(/\/$/, "")));
  for (const p of added.filter((x) => x !== "data" && !x.startsWith("data/"))) assert.ok(restored.includes(p), `${p} を品質ゲートで元に戻していません`);
  // note の同期結果（scripts/note_urls.json など）は、生成物より先に戻して確かめる（同期の食い違いだけで記事を捨てない）
  assert.ok(gate.run.indexOf("scripts/note_urls.json") < gate.run.indexOf("git checkout -- src/pages/radar"));
  // 同期結果だけを戻して公開した回も、実行を失敗にして気づけるようにする
  const fail = steps.find((s) => s.name === "Fail if generated content was rejected");
  assert.match(fail.if, /sync_rejected/);
});

test("run_status の CLI は reason を記録し、一覧に無い reason では失敗する", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wf-"));
  try {
    const cli = path.join(root, "scripts/utils/run_status.mjs");
    const env = { ...process.env, GITHUB_EVENT_NAME: "schedule", RUN_SCHEDULE: "17 21 * * *" };
    assert.equal(spawnSync(process.execPath, [cli, "rejected"], { cwd: dir, env }).status, 0);
    assert.notEqual(spawnSync(process.execPath, [cli, "weird"], { cwd: dir, env }).status, 0);
    const [file] = fs.readdirSync(path.join(dir, "data/run_status"));
    const st = JSON.parse(fs.readFileSync(path.join(dir, "data/run_status", file), "utf8"));
    assert.deepEqual(st.runs.map((r) => [r.reason, r.generated, r.event]), [["rejected", 0, "schedule (17 21 * * *)"]]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("マージドライバを設定しないと X 投稿の記録が rebase で衝突し、設定すれば両方の記録が残る（CI の git pull --rebase の再現）", () => {
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wf-git-"));
  try {
    const remote = path.join(tmp, "remote.git");
    g(tmp, "init", "-q", "--bare", "-b", "main", remote);
    const seed = path.join(tmp, "seed");
    g(tmp, "clone", "-q", remote, seed);
    fs.mkdirSync(path.join(seed, "scripts/utils"), { recursive: true });
    for (const f of ["merge_publish_history.mjs", "merge_note_urls.mjs", "utils/git_sync.mjs", "utils/public_tree.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(seed, "scripts", f));
    fs.copyFileSync(path.join(root, ".gitattributes"), path.join(seed, ".gitattributes"));
    const history = (o) => fs.writeFileSync(path.join(seed, "scripts/publish_history.json"), JSON.stringify(o, null, 2) + "\n");
    history({ a: { x: true } });
    g(seed, "add", "-A"); g(seed, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "init"); g(seed, "push", "-q", "origin", "main");
    for (const [name, configure] of [["without", false], ["with", true]]) {
      const ci = path.join(tmp, name);
      g(tmp, "clone", "-q", remote, ci);
      if (configure) assert.equal(spawnSync(process.execPath, ["scripts/utils/git_sync.mjs", "configure"], { cwd: ci }).status, 0);
      // オーナー端末が別の記事の出品を記録して push した後で、CI が X 投稿の記録を push する
      history({ a: { x: true }, [`owner-${name}`]: { note: true } });
      g(seed, "-c", "user.name=o", "-c", "user.email=o@o", "commit", "-qam", "owner"); g(seed, "push", "-q", "origin", "main");
      const h = JSON.parse(fs.readFileSync(path.join(ci, "scripts/publish_history.json"), "utf8"));
      fs.writeFileSync(path.join(ci, "scripts/publish_history.json"), JSON.stringify({ ...h, [`ci-${name}`]: { x: true } }, null, 2) + "\n");
      g(ci, "-c", "user.name=c", "-c", "user.email=c@c", "commit", "-qam", "ci");
      const r = spawnSync("git", ["-c", "user.name=c", "-c", "user.email=c@c", "pull", "--rebase", "origin", "main"], { cwd: ci, encoding: "utf8" });
      if (!configure) {
        assert.notEqual(r.status, 0, "ドライバ無しでは衝突する（この再現が成り立たないなら検査を見直す）");
        g(ci, "rebase", "--abort");
      } else {
        assert.equal(r.status, 0, r.stderr);
        const merged = JSON.parse(fs.readFileSync(path.join(ci, "scripts/publish_history.json"), "utf8"));
        assert.ok(merged[`owner-${name}`] && merged[`ci-${name}`], JSON.stringify(merged));
      }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

// Radar Ledger（data/ledger/・data/derived/）は、過去の日の値を後から取り直せない唯一の記録。コードのテスト（品質ゲートの npm test）が赤の日も、
// 定期実行はその日の台帳を記録し、台帳だけをコミットして push する（10/23・10/24 は定期便が 9 回続けて npm test で落ち、2 日分の台帳が欠けた）。
// GitHub Actions は、失敗した手順より後の手順を、if に always() / failure() / !cancelled() が無ければ飛ばす
const LEDGER_PATHS = ["data/derived/", "data/ledger/"];
const addsOf = (run) => [...String(run || "").matchAll(/^\s*git add (.+)$/gm)].flatMap((m) => m[1].trim().split(/\s+/));
const runsAfterFailure = (s) => /\b(?:always|failure)\(\)|!\s*cancelled\(\)/.test(String(s.if ?? ""));
// if が event を絞っていなければどの event でも走る。絞っていれば、その event を == で挙げているときだけ走る
const runsOn = (s, event) => !/github\.event_name/.test(String(s.if ?? "")) || String(s.if).includes(`github.event_name == '${event}'`);
const testGate = steps.findIndex((s) => /^\s*npm test\s*$/m.test(s.run || ""));
// npm test が失敗した event の実行で、走る手順
const stepsRunWhenTestsFail = (event) => steps.map((s, i) => ({ s, i })).filter(({ s, i }) => runsOn(s, event) && (i < testGate || (i > testGate && runsAfterFailure(s))));
const ledgerCommitIn = (ran) => {
  const snap = ran.find(({ s }) => /node scripts\/snapshot_ledger\.mjs/.test(s.run || ""));
  const commit = snap && ran.find(({ s, i }) => i > snap.i && addsOf(s.run).length > 0 && /\bgit push\b/.test(s.run));
  return { snap, commit };
};

test("定期実行（schedule・workflow_dispatch）は、npm test が失敗しても、その日の台帳を記録し、台帳の出力だけをコミットして push する", () => {
  assert.ok(testGate >= 0, "品質ゲートの npm test が見つかりません");
  for (const event of ["schedule", "workflow_dispatch"]) {
    const ran = stepsRunWhenTestsFail(event);
    const { snap, commit } = ledgerCommitIn(ran);
    assert.ok(snap, `${event}: npm test が失敗した日に、台帳の記録（scripts/snapshot_ledger.mjs）が走りません`);
    assert.ok(commit, `${event}: npm test が失敗した日に、台帳をコミットして push する手順が走りません`);
    assert.deepEqual([...new Set(addsOf(commit.s.run))].sort(), LEDGER_PATHS, "台帳のコミットに足すのは台帳の出力の明示パスだけ");
    // 記事・原稿・サイト・デプロイは、テストが通ったときだけ
    for (const { s, i } of ran) {
      for (const p of addsOf(s.run)) assert.ok(LEDGER_PATHS.includes(p), `${label(s, i)}: npm test が失敗した日に ${p} をコミットに足しています`);
      assert.doesNotMatch(String(s.run || ""), /npm run build|crawl_and_generate|sync_note_urls|ping_search_engines/, `${label(s, i)} が npm test の失敗した日に走ります`);
      assert.doesNotMatch(String(s.uses || ""), /pages/, `${label(s, i)} が npm test の失敗した日に走ります`);
    }
  }
  // コードの push（event: push）では台帳を記録しない（定期実行の記録だけ）
  const { commit } = ledgerCommitIn(stepsRunWhenTestsFail("schedule"));
  assert.equal(runsOn(commit.s, "push"), false, "push の実行で台帳をコミットしています");
});

test("台帳のコミットを push できなかった日も、最後のコミットの手順が手元のコミットを一緒に push する（作業ツリーと一緒に台帳を捨てない）", () => {
  const { commit } = ledgerCommitIn(stepsRunWhenTestsFail("schedule"));
  assert.ok(commit, "台帳をコミットして push する手順がありません");
  if (commit.s["continue-on-error"]) {
    const last = steps.find((s) => s.name === "Commit and push changes");
    // 足すものが無くても、origin/main より先にあるコミット（台帳）があれば push する
    assert.match(last.run, /git log --oneline origin\/main\.\.HEAD/);
  }
});

// workflow の run を GitHub Actions と同じ bash（bash --noprofile --norc -eo pipefail）で動かす。Windows は Git for Windows の bash
// （PATH の bash は WSL の起動口のことがある）
function bashPath() {
  if (process.platform !== "win32") return "bash";
  const gitRoot = path.resolve(execFileSync("git", ["--exec-path"], { encoding: "utf8" }).trim(), "../../..");
  const found = ["usr/bin/bash.exe", "bin/bash.exe"].map((p) => path.join(gitRoot, p)).find((p) => fs.existsSync(p));
  assert.ok(found, `Git for Windows の bash が見つかりません（${gitRoot}）`);
  return found;
}
function runStep(cwd, script) {
  const file = path.join(path.dirname(cwd), `step-${path.basename(cwd)}.sh`);
  fs.writeFileSync(file, script.replace(/\r\n/g, "\n"));
  const r = spawnSync(bashPath(), ["--noprofile", "--norc", "-eo", "pipefail", file.split(path.sep).join("/")], { cwd, encoding: "utf8" });
  return { status: r.status, log: `${r.stdout || ""}${r.stderr || ""}${r.error ? r.error.message : ""}` };
}

test("台帳のコミットの手順は、GitHub の main が先に進んでいても台帳の出力だけを push し、同じ日の再実行では何もコミットしない（一時 git リポジトリで再現）", () => {
  const { commit } = ledgerCommitIn(stepsRunWhenTestsFail("schedule"));
  assert.ok(commit, "台帳をコミットして push する手順がありません");
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wf-ledger-"));
  try {
    const remote = path.join(tmp, "remote.git");
    g(tmp, "init", "-q", "--bare", "-b", "main", remote);
    const seed = path.join(tmp, "seed");
    g(tmp, "clone", "-q", remote, seed);
    g(seed, "config", "user.name", "o"); g(seed, "config", "user.email", "o@o");
    const write = (dir, f, s) => { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), s); };
    for (const f of ["merge_publish_history.mjs", "merge_note_urls.mjs", "utils/git_sync.mjs", "utils/public_tree.mjs"]) write(seed, `scripts/${f}`, fs.readFileSync(path.join(root, "scripts", f)));
    write(seed, ".gitattributes", fs.readFileSync(path.join(root, ".gitattributes")));
    const row = (date, stars) => JSON.stringify({ date, full_name: "a/b", stars }) + "\n";
    write(seed, "data/ledger/2026/10/25.jsonl", row("2026-10-25", 1));
    write(seed, "data/derived/velocity.json", JSON.stringify({ as_of: "2026-10-25" }) + "\n");
    write(seed, "src/pages/radar/a.md", "---\ntitle: a\n---\n");
    write(seed, "scripts/publish_history.json", "{}\n");
    g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", "origin", "main");

    // CI の clone（Configure git と同じくマージドライバを設定）。そのあとでオーナー端末が別の記録を push して、GitHub の main が先に進む
    const ci = path.join(tmp, "ci");
    g(tmp, "clone", "-q", remote, ci);
    g(ci, "config", "user.name", "c"); g(ci, "config", "user.email", "c@c");
    assert.equal(spawnSync(process.execPath, ["scripts/utils/git_sync.mjs", "configure"], { cwd: ci }).status, 0);
    write(seed, "scripts/publish_history.json", JSON.stringify({ x: { note: true } }) + "\n");
    g(seed, "commit", "-qam", "owner"); g(seed, "push", "-q", "origin", "main");

    // その日の台帳（scripts/snapshot_ledger.mjs が書くもの）と、コミットしてはいけない未追跡の生成物
    write(ci, "data/ledger/2026/10/26.jsonl", row("2026-10-26", 2));
    write(ci, "data/derived/velocity.json", JSON.stringify({ as_of: "2026-10-26" }) + "\n");
    write(ci, "src/pages/radar/b.md", "---\ntitle: b\n---\n");
    write(ci, "note_drafts/b_note.md", "draft\n");
    const r = runStep(ci, commit.s.run);
    assert.equal(r.status, 0, r.log);

    assert.equal(g(remote, "show", "main:data/ledger/2026/10/26.jsonl"), row("2026-10-26", 2));
    assert.equal(JSON.parse(g(remote, "show", "main:data/derived/velocity.json")).as_of, "2026-10-26");
    assert.deepEqual(JSON.parse(g(remote, "show", "main:scripts/publish_history.json")), { x: { note: true } }, "オーナー端末の記録も残る");
    assert.deepEqual(g(remote, "diff", "--name-only", "main~1", "main").trim().split("\n").sort(), ["data/derived/velocity.json", "data/ledger/2026/10/26.jsonl"]);
    const tree = g(remote, "ls-tree", "-r", "--name-only", "main");
    assert.doesNotMatch(tree, /b\.md|b_note\.md/, "台帳以外の生成物はコミットしない");
    assert.ok(fs.existsSync(path.join(ci, "src/pages/radar/b.md")), "未追跡の生成物は消さない（後の手順が使う）");

    // 同じ日の再実行: 最新の main に進めた clone では、その日のファイルが既にあり（API を呼ばない）、velocity.json は同じ内容に作り直される
    const head = g(remote, "rev-parse", "main").trim();
    const rerun = path.join(tmp, "rerun");
    g(tmp, "clone", "-q", remote, rerun);
    g(rerun, "config", "user.name", "c"); g(rerun, "config", "user.email", "c@c");
    write(rerun, "data/derived/velocity.json", JSON.stringify({ as_of: "2026-10-26" }) + "\n");
    const r2 = runStep(rerun, commit.s.run);
    assert.equal(r2.status, 0, r2.log);
    assert.equal(g(remote, "rev-parse", "main").trim(), head, "再実行では何もコミットしない");
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
