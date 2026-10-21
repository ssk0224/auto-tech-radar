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

const root = path.resolve(import.meta.dirname, "..");
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
  for (const p of added.filter((x) => x !== "data")) assert.ok(restored.includes(p), `${p} を品質ゲートで元に戻していません`);
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
    for (const f of ["merge_publish_history.mjs", "merge_note_urls.mjs", "merge_note_status.mjs", "utils/git_sync.mjs"]) fs.copyFileSync(path.join(root, "scripts", f), path.join(seed, "scripts", f));
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
