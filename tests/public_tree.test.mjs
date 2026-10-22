// 公開リポに置くのは公開する出力だけ。オーナー端末の状態・内部の文書・CI の診断結果は ownerDir / $RUNNER_TEMP に置く。
// 既知の実例を文字列の一覧で探すのでなく、(a) 内容の形、(b) コードから導いた書き出し先、(c) workflow の git add を、
// scripts/utils/public_tree.mjs の台帳と突き合わせる
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { PUBLIC_OUTPUTS, RETIRED_OUTPUTS, publicOutputOf, isRetiredOutput, privateShapeHits, outputPathsWrittenBy } from "../scripts/utils/public_tree.mjs";
import { trackedFiles, isGitIgnored } from "./helpers/tracked_files.mjs";
import { scriptFiles, writeTargetsOf } from "./helpers/write_targets.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rel = (f) => path.relative(root, f).split(path.sep).join("/");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");

test("(a) 追跡ファイルに、オーナー端末・個人・ログイン専用の情報の形が無い（メール・ホームのパス・同期フォルダ・鍵・40 桁の hex・ログイン後の URL と統計）", () => {
  const hits = [];
  for (const f of trackedFiles(root)) {
    const p = path.join(root, f);
    if (!fs.existsSync(p)) continue;
    const b = fs.readFileSync(p);
    if (b.subarray(0, 8000).includes(0)) continue; // 画像などのバイナリ
    for (const h of privateShapeHits(b.toString("utf8"))) hits.push(`${f}:${h.line} ${h.kind}`);
  }
  assert.deepEqual(hits, []);
});

test("(a) 形の検査は、書き方を変えた実例を捕まえ、許可した形（noreply・例示用ドメイン・上流のライセンス表記・公開鍵）は通す", () => {
  const at = "@";
  const bs = "\\";
  const j = (...parts) => parts.join("");
  const pem = j(".", "pem");
  const bad = {
    email: [`連絡先 taro.yamada${at}gmail.com まで`, `<a href="mailto:x_y${at}corp.co.jp">`, `"contact": "ops+form${at}mail.example-shop.jp"`],
    // 実例はこのファイル自体が検査に引っかからないよう、つなぎ合わせて作る
    "user-home-path": [`C:${bs}Users${bs}alice${bs}repo`, `"C:${bs}${bs}Users${bs}${bs}bob${bs}${bs}x"`, j("D:/", "Users/carol/a"), j("cd /ho", "me/dave/repo"), j("open /Us", "ers/erin/Library"), j("/c/Us", "ers/frank/x")],
    "cloud-sync-folder": [`backup: ${bs}${"One" + "Drive"}${bs}keys`, j("~/Drop", "box/notes"), j('"Goo', 'gle Drive/vault"'), `G:${bs}${j("マイ", "ドライブ")}${bs}x`],
    "pem-path": [`%USERPROFILE%${bs}.atr${bs}secret${pem}`, j("~/.ssh/deploy", pem), j("./keys/other", pem), `D:${bs}backup${bs}vault_20261019${pem}`],
    "private-key-block": [`-----BEGIN ${"RSA "}PRIVATE KEY-----`, `-----BEGIN ${""}PRIVATE KEY-----`],
    hex40: [`old main ${crypto.randomBytes(20).toString("hex")}`, `sha=${crypto.randomBytes(20).toString("hex").toUpperCase()}`],
    "login-only-resource": [j("https://editor.note.com/notes/", "n0123456789ab/edit/"), j("see https://claude.ai/code/", "session_01AbCdEf9"), j('{ "total', 'Pv": 237 }')],
  };
  for (const [kind, samples] of Object.entries(bad)) {
    for (const s of samples) assert.ok(privateShapeHits(s).some((h) => h.kind === kind), `${kind} を見逃した: ${s}`);
  }
  const ok = [
    `ssk0224${at}users.noreply.github.com`,
    `Co-Authored-By: Claude <noreply${at}anthropic.com>`,
    `placeholder="name${at}example.com"`,
    `git${at}github.com:owner/repo.git`,
    `<!-- SPDX-FileCopyrightText: 2024-2026 dev${at}upstream.ai -->`,
    String.raw`Sync configs under C:\Users\you`,
    "keys/note_vault_public.pem",
    "!keys/note_vault_public.pem",
    "*.pem",
    "%USERPROFILE%\\.auto-tech-radar\\",
    `https://editor.note.com/notes/n1/edit/`,
    `public/${crypto.randomBytes(16).toString("hex")}.txt`,
  ];
  for (const s of ok) assert.deepEqual(privateShapeHits(s), [], s);
  // 見つけた文字列そのものは返さない（CI のログも公開される）
  assert.ok(!JSON.stringify(privateShapeHits(`x taro${at}gmail.com`)).includes("taro"));
});

test("(b) scripts の書き出し先は、公開出力の台帳にあるか gitignore 済み（止めた出力 x_posts・zenn_drafts・articles には書かない）", () => {
  const bad = [];
  for (const f of scriptFiles(root)) {
    for (const w of writeTargetsOf(root, f)) {
      const at = `${rel(f)}:${w.line} ${w.call}`;
      for (const u of w.unresolved) bad.push(`${at}: 書き先をたどれない (${u})`);
      for (const p of w.repoPaths) {
        if (isRetiredOutput(p)) bad.push(`${at}: 止めた出力に書く ${p}`);
        else if (!publicOutputOf(p) && !isGitIgnored(root, p.replace(/\*/g, "x"))) bad.push(`${at}: 公開出力の台帳に無く gitignore もされていない ${p}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});

test("(b) 書き出し先のたどり方: 基点（__dirname・cwd・ownerDir・一時フォルダ）・定数・既定値・for-of・分割代入・import した関数をたどる", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wt-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts", "utils"), { recursive: true });
    fs.writeFileSync(path.join(dir, "scripts", "utils", "where.mjs"), 'import path from "path";\nexport function stateFile(rootDir, name) {\n  return path.join(rootDir, "state", `${name}.json`);\n}\n');
    const src = [
      'import fs from "fs";',
      'import os from "os";',
      'import path from "path";',
      'import { fileURLToPath } from "url";',
      'import { ownerDir } from "./utils/owner_dir.mjs";',
      'import { stateFile } from "./utils/where.mjs";',
      "const here = path.dirname(fileURLToPath(import.meta.url));",
      "const ROOT = path.resolve(here, '..');",
      "const LOG = process.env.X_LOG || path.join(here, 'run_log.json');",
      "const [, , outArg] = process.argv;",
      "export function save({ rootDir = process.cwd() } = {}) {",
      "  fs.writeFileSync(stateFile(rootDir, 'today'), '{}');",
      "}",
      "fs.writeFileSync(LOG, '{}');",
      "fs.writeFileSync(path.join(ownerDir, 'private.json'), '{}');",
      "fs.writeFileSync(path.join(os.tmpdir(), 'x.txt'), '');",
      "fs.writeFileSync(outArg, '');",
      "for (const d of ['outbox', 'drafts']) {",
      "  fs.writeFileSync(path.join(ROOT, d, 'a.md'), '');",
      "}",
      "fs.copyFileSync(LOG, path.resolve('mirror/copy.json'));",
    ].join("\n");
    const file = path.join(dir, "scripts", "sample.mjs");
    fs.writeFileSync(file, src);
    const got = writeTargetsOf(dir, file).map((w) => [w.call, w.targets]);
    assert.deepEqual(got, [
      ["writeFileSync", ["<repo>/state/today.json"]],
      ["writeFileSync", ["<arg>", "<repo>/scripts/run_log.json"]],
      ["writeFileSync", ["<outside>"]],
      ["writeFileSync", ["<outside>"]],
      ["writeFileSync", ["<arg>"]],
      ["writeFileSync", ["<repo>/outbox/a.md", "<repo>/drafts/a.md"]],
      ["copyFileSync", ["<repo>/mirror/copy.json"]],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// workflow の run の中の git add の引数（行の継続 \ もつなげる）
function gitAddArgs(yml) {
  const joined = yml.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n").replace(/\\\n\s*/g, " ");
  return [...joined.matchAll(/\bgit\s+add\b([^\n;&|]*)/g)].map((m) => m[1].trim().split(/\s+/).filter(Boolean));
}

test("(c) workflow の git add は、CI が書く公開出力の明示パスだけ（. ・-A・--all・台帳に無いパスを足さない）", () => {
  const ciPaths = outputPathsWrittenBy("ci");
  const bad = [];
  const dir = path.join(root, ".github/workflows");
  for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    for (const args of gitAddArgs(read(`.github/workflows/${f}`))) {
      if (args.length === 0) bad.push(`${f}: 引数の無い git add`);
      for (const a of args) {
        if (a === "--") continue;
        if (a.startsWith("-") || a === "." || a === "*") bad.push(`${f}: git add ${a}`);
        else if (!ciPaths.includes(a) && !ciPaths.includes(`${a.replace(/\/$/, "")}/`)) bad.push(`${f}: 台帳で CI が書く出力ではない ${a}`);
      }
    }
  }
  assert.deepEqual(bad, []);
  // 検査そのものが動いている（daily-crawl.yml に git add がある）
  assert.ok(gitAddArgs(read(".github/workflows/daily-crawl.yml")).length > 0);
});

test("(c) git add の検査は、書き方を変えた全部入りの add を捕まえる", () => {
  const ciPaths = outputPathsWrittenBy("ci");
  const offending = (yml) => gitAddArgs(yml).flat().filter((a) => a !== "--" && (a.startsWith("-") || a === "." || !ciPaths.includes(a)));
  assert.deepEqual(offending("run: |\n  git add src/pages/radar/ public/\n"), []);
  for (const y of ["run: git add .", "run: |\n  git   add -A\n", "run: git add --all -- .", "run: |\n  git add src/pages/radar/ \\\n    data/\n", "run: git add scripts/note_status.json && git commit"]) {
    assert.ok(offending(y).length > 0, y);
  }
});

test("台帳: 追跡している状態ファイル（data/・scripts/*.json）はすべて台帳にあり、書く側が 2 つ以上の記録にはマージドライバがある", async () => {
  const { MERGE_DRIVERS } = await import("../scripts/utils/git_sync.mjs");
  const tracked = trackedFiles(root).filter((f) => f.startsWith("data/") || /^scripts\/[^/]+\.json$/.test(f));
  assert.ok(tracked.length > 0);
  for (const f of tracked) assert.ok(publicOutputOf(f)?.state, `${f} は公開出力の台帳に無い状態ファイル（オーナー端末か $RUNNER_TEMP に置く）`);
  const attrs = read(".gitattributes");
  for (const o of PUBLIC_OUTPUTS.filter((x) => x.state && x.writers.length > 1)) assert.ok(o.merge, `${o.path} は書く側が複数なのにマージドライバが無い`);
  for (const o of PUBLIC_OUTPUTS.filter((x) => x.merge)) {
    assert.ok(attrs.split("\n").includes(`${o.path} merge=${o.merge}`), `.gitattributes に ${o.path} merge=${o.merge} が無い`);
    assert.ok(MERGE_DRIVERS[`merge.${o.merge}.driver`], `MERGE_DRIVERS に ${o.merge} が無い`);
  }
  // .gitattributes のマージドライバは、台帳にある追跡ファイルにだけ付ける（消したファイルのドライバを残さない）
  for (const m of attrs.matchAll(/^(\S+)\s+merge=([\w-]+)/gm)) assert.ok(publicOutputOf(m[1])?.merge === m[2], `${m[1]} merge=${m[2]} は台帳に無い`);
});

test("止めた出力（x_posts・zenn_drafts・articles）に追跡ファイルが無い", () => {
  const left = trackedFiles(root).filter((f) => isRetiredOutput(f));
  assert.deepEqual(left, []);
  for (const r of RETIRED_OUTPUTS) assert.ok(isGitIgnored(root, `${r}x.txt`), `${r} を .gitignore に入れる（手元に残ったファイルを誤ってコミットしない）`);
});

test("公開ページが「リポジトリにある」と示すファイルは、実際に追跡されている（内部へ移したファイルを示し続けない）", () => {
  const tracked = new Set(trackedFiles(root));
  const roots = [...new Set(PUBLIC_OUTPUTS.map((o) => o.path.split("/")[0]))];
  const re = new RegExp(`\\b(?:${roots.join("|")})/[\\w./-]*\\.[a-z]{2,5}\\b`, "g");
  const bad = [];
  const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach((e) => {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(astro|md|js)$/.test(e.name) && !p.startsWith("src/pages/radar/")) {
      for (const m of read(p).matchAll(re)) if (!tracked.has(m[0])) bad.push(`${p}: ${m[0]}`);
    }
  });
  walk("src/pages");
  assert.deepEqual(bad, []);
});
