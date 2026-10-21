// 品質ゲートが本当に不具合を止めるかを、わざと不具合を入れた複製で確かめる（ゲートが「常に合格」になる事故を防ぐ）
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", "dist", ".git", ".astro"]);

function cloneRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gate-"));
  fs.cpSync(root, dir, { recursive: true, filter: (src) => !SKIP.has(path.basename(src)) });
  // 監査は依存パッケージ（Mermaid の構文解析）を使うので node_modules を参照させる
  fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "junction");
  return dir;
}
const audit = (dir, script) => spawnSync(process.execPath, [path.join(dir, "scripts", script)], { cwd: dir, encoding: "utf8" });

test("現在のリポジトリは監査に合格する", () => {
  const r = audit(root, "audit_quality.mjs");
  assert.equal(r.status, 0, r.stdout.split("\n").filter((l) => l.includes("❌")).join("\n"));
});

// [名前, 不具合を入れる処理, 監査が出すべき ❌ メッセージの一部]。終了コードだけだと監査自体のクラッシュでも通ってしまうため、出力も確かめる
const mutations = [
  ["note 原稿の有料部分が平文になる", "PAID CONTENT IN PLAINTEXT", (d) => {
    const f = path.join(d, "note_drafts", fs.readdirSync(path.join(d, "note_drafts")).find((x) => x.endsWith("_note.md") && !x.startsWith("LEAD")));
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(/^<!-- PAID_SEALED: .*-->$/m, "## 有料の本文\n" + "秘密 ".repeat(200)));
  }],
  ["Web 記事に PRO 見出しが混入する", "PRO CONTENT ON WEB", (d) => {
    const f = path.join(d, "src/pages/radar", fs.readdirSync(path.join(d, "src/pages/radar"))[0]);
    fs.appendFileSync(f, "\n## 🛠️ 【Auto Tech Radar PRO限定】商用化マニュアル\n秘密\n");
  }],
  ["クライアント側の解除コードが戻る", "有料解除処理が残っています", (d) => {
    const f = path.join(d, "src/layouts/Layout.astro");
    fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("</script>", "localStorage.setItem('atr_pro_unlocked','true');</script>"));
  }],
  ["暗号化ファイルが別記事のものにすり替わる", "SEALED PAID PART INVALID", (d) => {
    const nd = path.join(d, "note_drafts");
    const enc = fs.readdirSync(nd).filter((x) => x.endsWith(".paid.enc"));
    fs.copyFileSync(path.join(nd, enc[0]), path.join(nd, enc[1]));
  }],
];
for (const [name, expected, mutate] of mutations) {
  test(`監査が止める: ${name}`, () => {
    const dir = cloneRepo();
    try {
      mutate(dir);
      const r = audit(dir, "audit_quality.mjs");
      assert.notEqual(r.status, 0);
      const out = r.stdout + r.stderr;
      assert.ok(out.split("\n").some((l) => l.includes("❌") && l.includes(expected)), `期待する ❌ が出ていない: ${expected}\n${out}`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

test("配信物の監査が有料本文の混入を止める", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-dist-"));
  try {
    fs.cpSync(path.join(root, "scripts"), path.join(dir, "scripts"), { recursive: true });
    fs.cpSync(path.join(root, "src/config"), path.join(dir, "src/config"), { recursive: true });
    const page = (body) => `<html><head><meta property="og:url" content="x"></head><body>${body}</body></html>`;
    fs.mkdirSync(path.join(dir, "dist/radar/a"), { recursive: true });
    fs.writeFileSync(path.join(dir, "dist/radar/a/index.html"), page("無料の解説"));
    assert.equal(audit(dir, "audit_dist.mjs").status, 0);
    fs.writeFileSync(path.join(dir, "dist/radar/a/index.html"), page("【Auto Tech Radar PRO限定】秘密"));
    const r = audit(dir, "audit_dist.mjs");
    assert.notEqual(r.status, 0);
    assert.ok((r.stdout + r.stderr).includes("PRO CONTENT IN DIST"), r.stdout + r.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("出品履歴のマージは両側の投稿済みフラグを残す", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-merge-"));
  try {
    const [o, a, b] = ["o", "a", "b"].map((n) => path.join(dir, n));
    fs.writeFileSync(o, "{}");
    fs.writeFileSync(a, JSON.stringify({ x: { note: true }, y: { x: false } }));
    fs.writeFileSync(b, JSON.stringify({ y: { x: true, xAt: "2026-10-19" }, z: { note: true } }));
    const r = spawnSync(process.execPath, [path.join(root, "scripts/merge_publish_history.mjs"), o, a, b]);
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(a, "utf8")), { x: { note: true }, y: { x: true, xAt: "2026-10-19" }, z: { note: true } });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
