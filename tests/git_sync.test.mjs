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
