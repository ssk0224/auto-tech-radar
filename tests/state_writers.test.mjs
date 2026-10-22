// 共有する状態（公開リポの記録・オーナー端末の状態）の書き手を 1 つにし、再実行・同時実行・異常終了でも壊さない仕組みの検査。
// 書き手の台帳は scripts/utils/public_tree.mjs（PUBLIC_OUTPUTS の writers）
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "events";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync, spawnSync } from "child_process";
import { pathToFileURL } from "url";
import { parseFrontmatter } from "astro/markdown";
import { outputPathsWrittenBy, publicOutputOf } from "../scripts/utils/public_tree.mjs";
import { commitAndSync } from "../scripts/utils/git_sync.mjs";
import { onTermination, TERMINATION_SIGNALS } from "../scripts/utils/termination.mjs";
import { probePurged, parseShas } from "../scripts/probe_purged_shas.mjs";
import { isolateGitConfig } from "./helpers/git_env.mjs";
import { linkDir } from "./helpers/links.mjs";

const root = path.resolve(import.meta.dirname, "..");
isolateGitConfig();
const yaml = (f) => parseFrontmatter(`---\n${fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n")}\n---\n`).frontmatter;

test("CI は最新の main に進めてから、記録（data/・対応表）を書くスクリプトを動かす（再実行・待機した便が古い作業ツリーで決めない）", () => {
  const steps = yaml(".github/workflows/daily-crawl.yml").jobs["run-radar"].steps;
  const ff = steps.findIndex((s) => /git fetch origin main/.test(s.run || "") && /git merge --ff-only origin\/main/.test(s.run || ""));
  assert.ok(ff >= 0, "checkout の後に git fetch origin main と git merge --ff-only origin/main が無い");
  const firstScript = steps.findIndex((s) => /\bnode scripts\/(?!utils\/git_sync\.mjs)/.test(s.run || "") || /\bnpm (?:test|run)\b/.test(s.run || ""));
  assert.ok(firstScript > ff, `最新の main に進める前にスクリプトを動かしている（${firstScript} < ${ff}）`);
});

test("記事が無い日の監視は、監視される workflow と別の workflow・別の concurrency group で動く（取り消された定期便といっしょに消えない）", () => {
  const dir = path.join(root, ".github/workflows");
  const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f));
  const runsAlert = (wf) => Object.values(wf.jobs || {}).some((j) => (j.steps || []).some((s) => /alert_if_no_article\.mjs/.test(s.run || "")));
  const crawl = yaml(".github/workflows/daily-crawl.yml");
  assert.ok(!runsAlert(crawl), "daily-crawl.yml の中で監視している");
  const watchers = files.map((f) => [f, yaml(`.github/workflows/${f}`)]).filter(([, wf]) => runsAlert(wf));
  assert.equal(watchers.length, 1, "監視の workflow が 1 つではない");
  const [name, wf] = watchers[0];
  assert.ok(Array.isArray(wf.on?.schedule) && wf.on.schedule.length > 0, `${name} に定期実行が無い`);
  assert.ok(wf.concurrency?.group && wf.concurrency.group !== crawl.concurrency?.group, `${name} の concurrency group が daily-crawl と同じ`);
});

// テスト用の git リポ（remote と、オーナー端末の作業ツリー）
function ownerRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "atr-sw-"));
  const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const remote = path.join(tmp, "remote.git");
  g(tmp, "init", "-q", "--bare", "-b", "main", remote);
  const owner = path.join(tmp, "owner");
  g(tmp, "clone", "-q", remote, owner);
  g(owner, "config", "user.name", "t");
  g(owner, "config", "user.email", "t@example.com");
  const put = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(owner, rel)), { recursive: true });
    fs.writeFileSync(path.join(owner, rel), text);
  };
  put("scripts/publish_history.json", "{}\n");
  put("data/run_status/2026-10-22.json", '{"runs":[]}\n');
  put("note_drafts/a_note.md", "# a\n");
  g(owner, "add", "-A");
  g(owner, "commit", "-qm", "init");
  g(owner, "push", "-q", "origin", "main");
  return { tmp, owner, remote, g, put };
}

test("オーナー端末の同期は、台帳でオーナーが書く出力だけを送る（内部の状態・CI の記録・作業ツリーのほかの変更は送らない）", () => {
  const { tmp, owner, remote, g, put } = ownerRepo();
  try {
    put("scripts/publish_history.json", '{"a":{"note":true}}\n');
    put("data/run_status/2026-10-22.json", '{"runs":["owner"]}\n'); // CI だけが書く記録
    put("scripts/note_status.json", "{}\n"); // オーナー端末の状態（公開しない）
    put("docs/HANDOFF.md", "internal\n"); // 内部の文書
    const paths = outputPathsWrittenBy("owner").filter((p) => fs.existsSync(path.join(owner, p)));
    const r = commitAndSync(owner, paths, "chore(owner): sync");
    assert.equal(r.ok, true, r.message);
    const pushed = g(remote, "ls-tree", "-r", "--name-only", "main").split("\n").filter(Boolean).sort();
    assert.deepEqual(pushed, ["data/run_status/2026-10-22.json", "note_drafts/a_note.md", "scripts/publish_history.json"]);
    assert.equal(g(remote, "show", "main:scripts/publish_history.json"), '{"a":{"note":true}}\n');
    assert.equal(g(remote, "show", "main:data/run_status/2026-10-22.json"), '{"runs":[]}\n', "CI の記録をオーナー端末から送った");
    for (const p of pushed) assert.ok(publicOutputOf(p), `${p} は公開出力の台帳に無い`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("ランチャーの GitHub への同期は、台帳でオーナーが書く出力だけ（git add . ・記事の生成・実行記録の push をしない）", () => {
  const src = fs.readFileSync(path.join(root, "scripts/launcher.mjs"), "utf8");
  // git の add を直接呼ばない（同期は commitAndSync に台帳のパスを渡す）
  assert.doesNotMatch(src, /git\s+add\b|['"]add['"]\s*,/);
  const ownerPaths = new Set(outputPathsWrittenBy("owner"));
  const calls = [...src.matchAll(/commitAndSync\(\s*rootDir\s*,\s*([^,]+?)\s*,/g)].map((m) => m[1]);
  assert.ok(calls.length > 0);
  for (const arg of calls) {
    if (arg === "paths") continue;
    const list = arg.match(/^\[(.*)\]$/);
    assert.ok(list, `commitAndSync に台帳から作っていないパス: ${arg}`);
    for (const p of list[1].split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, ""))) assert.ok(ownerPaths.has(p), `${p} はオーナーが書く出力ではない`);
  }
  assert.match(src, /const paths = outputPathsWrittenBy\('owner'\)/);
  // CI だけが書く記事・記録（src/pages/radar・data/）を、この端末で生成しない
  assert.doesNotMatch(src, /scripts\/crawl_and_generate\.mjs|scripts\/snapshot_ledger\.mjs/);
});

test("公開中の note の検査をオーナー端末で取り直しても（--status-only）、CI だけが書く購入リンクの対応表は変えず、検査結果は指定の置き場所に書く", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-sns-"));
  try {
    for (const d of ["scripts", "src", "note_drafts"]) fs.cpSync(path.join(root, d), path.join(dir, d), { recursive: true });
    fs.copyFileSync(path.join(root, "package.json"), path.join(dir, "package.json"));
    linkDir(path.join(root, "node_modules"), path.join(dir, "node_modules"));
    const urlsFile = path.join(dir, "scripts/note_urls.json");
    const before = fs.readFileSync(urlsFile, "utf8");
    const [slug, entry] = Object.entries(JSON.parse(before)).find(([s]) => s !== "LEAD_MAGNET_CHEAT_SHEET");
    const stub = path.join(dir, "fetch_stub.mjs");
    fs.writeFileSync(stub, [
      `const note = ${JSON.stringify({ name: entry.title, noteUrl: entry.url, price: 980, publishAt: "2026-10-01T00:00:00+09:00" })};`,
      "globalThis.fetch = async (url) => {",
      "  const u = String(url);",
      "  const body = u.includes('/contents?') ? { data: { contents: [note], isLastPage: true } } : { data: { body: '<p>ThoughtWorks成熟度リング判定</p>', eyecatch: 'x', name: note.name } };",
      "  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };",
      "};",
    ].join("\n"));
    const run = (args, statusFile, ci) => spawnSync(process.execPath, ["--import", pathToFileURL(stub).href, "scripts/sync_note_urls.mjs", ...args], {
      cwd: dir, encoding: "utf8", timeout: 60000, env: { ...process.env, ATR_NOTE_STATUS: statusFile, ATR_OWNER_DIR: path.join(dir, ".owner"), GITHUB_ACTIONS: ci ? "true" : "" },
    });
    const ownerStatus = path.join(dir, ".owner", "note_status.json");
    const r = run(["--status-only"], ownerStatus, false);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.equal(fs.readFileSync(urlsFile, "utf8"), before, "--status-only で対応表を書き換えた");
    assert.ok(JSON.parse(fs.readFileSync(ownerStatus, "utf8")).notes[slug].issues.length > 0, "検査結果を書いていない");
    assert.ok(r.stdout.includes(slug), "オーナー端末では記事ごとの問題を表示する");
    // CI（--status-only なし）は対応表を書き、検査結果は渡された一時の置き場所に書く（リポの scripts/ には書かない）
    const ciStatus = path.join(dir, "runner-temp", "note_status.json");
    const ci = run([], ciStatus, true);
    assert.equal(ci.status, 0, ci.stdout + ci.stderr);
    // 公開される CI のログには、どの記事に問題が残っているかを出さない（本数だけを ::error で知らせる）
    assert.match(ci.stdout, /^::error title=note の公開内容::.*1 本/m);
    assert.deepEqual(ci.stdout.split(/\r?\n/).filter((l) => l.startsWith("::") && l.includes(slug)), []);
    assert.ok(fs.existsSync(ciStatus));
    assert.ok(!fs.existsSync(path.join(dir, "scripts/note_status.json")), "検査結果を公開リポの scripts/ に書いた");
    assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(urlsFile, "utf8"))), [slug]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("後片付け（復号した有料本文の削除）は、exit だけでなく Ctrl+C・窓を閉じる・kill のシグナルでも 1 回だけ走り、128+番号で終わる", () => {
  for (const [sig, num] of Object.entries(TERMINATION_SIGNALS)) {
    const proc = new EventEmitter();
    const exits = [];
    proc.exit = (code) => {
      exits.push(code);
      proc.emit("exit", code);
    };
    let n = 0;
    onTermination(() => n++, proc);
    proc.emit(sig);
    assert.equal(n, 1, `${sig} で後片付けが走らない`);
    assert.deepEqual(exits, [128 + num], sig);
  }
  const proc = new EventEmitter();
  let n = 0;
  onTermination(() => n++, proc);
  proc.emit("exit", 0);
  assert.equal(n, 1);
  // 後片付けが失敗しても、終了を止めない（例外を投げない）
  const p2 = new EventEmitter();
  p2.exit = () => {};
  onTermination(() => { throw new Error("x"); }, p2);
  assert.doesNotThrow(() => p2.emit("SIGTERM"));
});

test("消した旧履歴の probe: 1 件でも読める・確かめられない・SHA が未登録なら失敗にし、結果に SHA を出さない", async () => {
  const sha = (c) => c.repeat(40);
  const statusOf = { [sha("a")]: 422, [sha("b")]: 404, [sha("c")]: 200 };
  const fetchImpl = async (url) => ({ status: statusOf[String(url).split("/").pop()] ?? 500 });
  const ok = await probePurged({ shas: [sha("a"), sha("b")], repo: "o/r", fetchImpl });
  assert.equal(ok.ok, true);
  const bad = await probePurged({ shas: [sha("a"), sha("c")], repo: "o/r", fetchImpl });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.results.map((r) => r.state), ["purged", "readable"]);
  assert.ok(!JSON.stringify(bad).includes(sha("c")), "結果に SHA が入っている");
  assert.equal((await probePurged({ shas: [], repo: "o/r", fetchImpl })).ok, false, "未登録を合格にした");
  assert.equal((await probePurged({ shas: [sha("d")], repo: "o/r", fetchImpl })).ok, false, "確かめられない（500）を合格にした");
  assert.equal((await probePurged({ shas: [sha("a")], repo: "o/r", fetchImpl: async () => { throw new Error("net"); } })).ok, false);
  assert.deepEqual(parseShas(` ${sha("a")},${sha("b")}\n`), [sha("a"), sha("b")]);
  // workflow は Secret から渡し、SHA を書かない
  const wf = fs.readFileSync(path.join(root, ".github/workflows/purge-probe.yml"), "utf8");
  assert.match(wf, /PURGED_SHAS: \$\{\{ secrets\.PURGED_SHAS \}\}/);
  assert.match(wf, /node scripts\/probe_purged_shas\.mjs/);
});
