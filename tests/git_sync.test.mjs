// ランチャーの GitHub 同期: 未コミットの変更があっても、CI と同時に出品履歴を更新しても、記録を失わない
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { commitAndSync } from "../scripts/utils/git_sync.mjs";

const g = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("未コミットの別ファイルがあり、リモートでも出品履歴が更新されていても、両方の記録が残る", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atr-sync-"));
  try {
    const remote = path.join(root, "remote.git");
    g(root, "init", "-q", "--bare", "-b", "main", remote);
    const seed = path.join(root, "seed");
    g(root, "clone", "-q", remote, seed);
    for (const d of [seed]) { g(d, "config", "user.email", "t@t"); g(d, "config", "user.name", "t"); }
    fs.mkdirSync(path.join(seed, "scripts"));
    for (const f of ["merge_publish_history.mjs", "merge_note_urls.mjs"]) fs.copyFileSync(path.join("scripts", f), path.join(seed, "scripts", f));
    fs.writeFileSync(path.join(seed, ".gitattributes"), fs.readFileSync(".gitattributes"));
    fs.writeFileSync(path.join(seed, "scripts/publish_history.json"), JSON.stringify({ a: { note: true } }, null, 2) + "\n");
    fs.writeFileSync(path.join(seed, "other.txt"), "x\n");
    g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", "origin", "main");

    const owner = path.join(root, "owner");
    g(root, "clone", "-q", remote, owner);
    for (const d of [owner]) { g(d, "config", "user.email", "o@o"); g(d, "config", "user.name", "o"); }

    // CI 側: 別の記事を記録して push
    const h = { a: { note: true }, b: { x: true } };
    fs.writeFileSync(path.join(seed, "scripts/publish_history.json"), JSON.stringify(h, null, 2) + "\n");
    g(seed, "commit", "-qam", "ci"); g(seed, "push", "-q", "origin", "main");

    // オーナー側: 未コミットの別ファイルがある状態で、出品履歴を記録して同期
    fs.writeFileSync(path.join(owner, "other.txt"), "dirty\n");
    fs.writeFileSync(path.join(owner, "scripts/publish_history.json"), JSON.stringify({ a: { note: true }, c: { note: true } }, null, 2) + "\n");
    const r = commitAndSync(owner, ["scripts/publish_history.json"], "chore(history): record");
    assert.ok(r.ok, `${r.step}: ${r.message}`);

    const merged = JSON.parse(g(remote, "show", "main:scripts/publish_history.json"));
    assert.deepEqual(Object.keys(merged).sort(), ["a", "b", "c"]);
    assert.equal(fs.readFileSync(path.join(owner, "other.txt"), "utf8"), "dirty\n", "未コミットの変更は残す");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// 共通: GitHub（remote）・CI 側の clone（seed）・オーナーの clone（owner）を作る。files は最初のコミットの中身
function repos(root, files) {
  const remote = path.join(root, "remote.git");
  g(root, "init", "-q", "--bare", "-b", "main", remote);
  const seed = path.join(root, "seed");
  g(root, "clone", "-q", remote, seed);
  g(seed, "config", "user.email", "t@t"); g(seed, "config", "user.name", "t");
  fs.mkdirSync(path.join(seed, "scripts"));
  for (const f of ["merge_publish_history.mjs", "merge_note_urls.mjs"]) fs.copyFileSync(path.join("scripts", f), path.join(seed, "scripts", f));
  fs.writeFileSync(path.join(seed, ".gitattributes"), fs.readFileSync(".gitattributes"));
  for (const [f, s] of Object.entries(files)) fs.writeFileSync(path.join(seed, f), s);
  g(seed, "add", "-A"); g(seed, "commit", "-qm", "init"); g(seed, "push", "-q", "origin", "main");
  const owner = path.join(root, "owner");
  g(root, "clone", "-q", remote, owner);
  g(owner, "config", "user.email", "o@o"); g(owner, "config", "user.name", "o");
  return { remote, seed, owner };
}

// 手元の未コミットの変更が GitHub の更新とぶつかったとき、`git pull --rebase --autostash` は成功を返したまま衝突の印をファイルに書き込む。
// 出品履歴などの JSON が読めなくなる（出品の上限が効かない・全記事が未出品に見える）うえ、以後の取り込みとコミットがすべて失敗する
test("手元の未コミットの変更が GitHub の更新とぶつかっても、衝突の印を残さず最新の版に戻し、記録の同期を続けられる", async () => {
  const { pullLatest } = await import("../scripts/utils/git_sync.mjs");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atr-sync-"));
  try {
    const { remote, seed, owner } = repos(root, {
      "scripts/publish_history.json": JSON.stringify({ a: { note: true } }, null, 2) + "\n",
      "scripts/note_updates.json": JSON.stringify({ since: "2026-10-18", items: { a: {}, b: {} } }, null, 2) + "\n",
    });
    // GitHub 側で note_updates.json が更新され、オーナーの手元では同じファイルを書き換えたまま（以前の [U] の「後回し」）
    fs.writeFileSync(path.join(seed, "scripts/note_updates.json"), JSON.stringify({ since: "2026-10-21", items: { a: {}, c: {} } }, null, 2) + "\n");
    g(seed, "commit", "-qam", "dev"); g(seed, "push", "-q", "origin", "main");
    fs.writeFileSync(path.join(owner, "scripts/note_updates.json"), JSON.stringify({ since: "2026-10-18", items: { b: {}, a: {} } }, null, 2) + "\n");

    const p = pullLatest(owner);
    assert.ok(p.ok, p.message);
    assert.deepEqual(p.restored, ["scripts/note_updates.json"]);
    const text = fs.readFileSync(path.join(owner, "scripts/note_updates.json"), "utf8");
    assert.doesNotMatch(text, /<<<<<<<|>>>>>>>/);
    assert.equal(JSON.parse(text).since, "2026-10-21", "GitHub の最新の版");
    assert.equal(g(owner, "diff", "--name-only", "--diff-filter=U").trim(), "");

    // その後も出品履歴の記録を同期できる
    fs.writeFileSync(path.join(owner, "scripts/publish_history.json"), JSON.stringify({ a: { note: true }, c: { note: true } }, null, 2) + "\n");
    const r = commitAndSync(owner, ["scripts/publish_history.json"], "chore(history): record");
    assert.ok(r.ok, `${r.step}: ${r.message}`);
    assert.deepEqual(Object.keys(JSON.parse(g(remote, "show", "main:scripts/publish_history.json"))).sort(), ["a", "c"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("同期のときも、手元の変更と GitHub の更新がぶつかったファイルに衝突の印を残さない（以前に残った印も直す）", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atr-sync-"));
  try {
    const { remote, seed, owner } = repos(root, { "scripts/publish_history.json": "{}\n", "x.txt": "a\nb\nc\n" });
    fs.writeFileSync(path.join(seed, "x.txt"), "a\nCI\nc\n");
    g(seed, "commit", "-qam", "ci"); g(seed, "push", "-q", "origin", "main");
    fs.writeFileSync(path.join(owner, "x.txt"), "a\nOWNER\nc\n");
    fs.writeFileSync(path.join(owner, "scripts/publish_history.json"), JSON.stringify({ c: { note: true } }) + "\n");
    const r = commitAndSync(owner, ["scripts/publish_history.json"], "chore(history): record");
    assert.ok(r.ok, `${r.step}: ${r.message}`);
    assert.equal(fs.readFileSync(path.join(owner, "x.txt"), "utf8"), "a\nCI\nc\n");
    assert.deepEqual(r.restored, ["x.txt"]);
    assert.deepEqual(JSON.parse(g(remote, "show", "main:scripts/publish_history.json")), { c: { note: true } });

    // 以前の版のランチャーで衝突の印が残ったままの作業ツリー（未解決のファイル）でも、直してから同期する
    g(seed, "pull", "-q", "--rebase", "origin", "main");
    fs.writeFileSync(path.join(seed, "x.txt"), "a\nCI2\nc\n");
    g(seed, "commit", "-qam", "ci2"); g(seed, "push", "-q", "origin", "main");
    fs.writeFileSync(path.join(owner, "x.txt"), "a\nOWNER2\nc\n");
    g(owner, "pull", "--rebase", "--autostash", "origin", "main");
    assert.match(fs.readFileSync(path.join(owner, "x.txt"), "utf8"), /<<<<<<</, "以前の取り込み方では印が残る");
    fs.writeFileSync(path.join(owner, "scripts/publish_history.json"), JSON.stringify({ c: { note: true }, d: { note: true } }) + "\n");
    const r2 = commitAndSync(owner, ["scripts/publish_history.json"], "chore(history): record");
    assert.ok(r2.ok, `${r2.step}: ${r2.message}`);
    assert.equal(fs.readFileSync(path.join(owner, "x.txt"), "utf8"), "a\nCI2\nc\n");
    assert.deepEqual(Object.keys(JSON.parse(g(remote, "show", "main:scripts/publish_history.json"))).sort(), ["c", "d"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
