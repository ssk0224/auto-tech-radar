// オーナー端末（Windows）で使うランチャー・補助スクリプトの安全性: クリップボード・GitHub からの取り込み・パッケージの版・note の出品の入口
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { copyTextToClipboard, CLIPBOARD_PS } from "../scripts/utils/clipboard.mjs";
import { dependencyProblems } from "../scripts/utils/deps.mjs";
import { readText } from "./helpers/read_src.mjs";

// リポ内の相対パスは区切りが / のもの（Windows の path.join は \ にしてしまい、"scripts/launcher.mjs" と比べられない）
const scripts = () => fs.readdirSync("scripts").filter((f) => f.endsWith(".mjs")).map((f) => path.posix.join("scripts", f)).concat(fs.readdirSync("scripts/utils").filter((f) => f.endsWith(".mjs")).map((f) => path.posix.join("scripts/utils", f)));

test("クリップボード: 本文（改行・引用符・数千字）をコマンドラインに入れず、UTF-8 のファイルから丸ごとコピーする", () => {
  const text = `1 行目 "引用" と 'シングル' & | ^ %OS% 💡\n2 行目\nhttps://example.com/?a=1&b=2\n${"長い本文。".repeat(4000)}`;
  const calls = [];
  const run = (exe, args, opts) => {
    calls.push({ exe, args, file: opts.env.ATR_CLIP_FILE, content: fs.readFileSync(opts.env.ATR_CLIP_FILE, "utf8") });
    return true;
  };
  assert.equal(copyTextToClipboard(text, { run }), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].exe, "powershell");
  assert.equal(calls[0].content, text, "改行・記号を含めて同じ文字列");
  const cmdLine = [calls[0].exe, ...calls[0].args].join(" ");
  assert.ok(!cmdLine.includes("2 行目") && !/\n/.test(cmdLine), "本文はコマンドラインに入れない");
  assert.ok(cmdLine.length < 8191, "cmd.exe のコマンドラインの上限より短い");
  assert.ok(calls[0].args.includes(CLIPBOARD_PS));
  assert.equal(fs.existsSync(calls[0].file), false, "一時ファイルは消す");
  // コピーに失敗したら false（呼び出し側は「コピーした」と表示しない）
  assert.equal(copyTextToClipboard("x", { run: () => false }), false);
  assert.equal(copyTextToClipboard("x", { run: () => { throw new Error("powershell が無い"); } }), false);
  assert.equal(copyTextToClipboard("", { run }), false);
});

test("クリップボード: スクリプトは本文を Set-Clipboard -Value の引数に埋め込まない。コピーの成否を見ずに「コピーしました」と言わない", () => {
  for (const f of scripts()) {
    const src = readText(f);
    assert.doesNotMatch(src, /Set-Clipboard -Value/, `${f}: 本文をコマンドラインに入れている`);
    assert.doesNotMatch(src, /^\s*copyTextToClipboard\([^)]*\);/m, `${f}: コピーの成否を見ていない`);
  }
});

test("GitHub からの取り込みは utils/git_sync.mjs の pullLatest だけで行う（衝突の印を残さない・失敗したら元に戻す）", () => {
  for (const f of ["scripts/launcher.mjs", "scripts/publish_helper.mjs", "scripts/note_browser.mjs", "scripts/setup_wizard.mjs"]) {
    const src = readText(f);
    assert.doesNotMatch(src, /exec(Sync)?\(\s*['"`]git pull/, `${f}: git pull を直接実行している`);
    assert.doesNotMatch(src, /spawnSync\(\s*['"]git['"],\s*\[\s*['"]pull/, `${f}: git pull を直接実行している`);
  }
  const launcher = readText("scripts/launcher.mjs");
  assert.equal((launcher.match(/pullLatest\(rootDir/g) || []).length, 3, "起動時・メニュー実行前・[S] の 3 か所");
  // [S] は git add . の前に衝突の印・壊れた出品履歴を直す（そのままコミットして GitHub に送らない）
  const sync = launcher.match(/function runCloudSync\(\) \{[\s\S]*?\n\}/)[0];
  const add = sync.indexOf("execSync('git add .'");
  assert.ok(add > 0 && sync.indexOf("repairWorkingTree(rootDir)") < add);
  assert.ok(sync.indexOf("historyUnreadable()") < add);
});

test("note の新規出品の画面を開くのはランチャーだけ（ランチャーは出品の上限を確かめてから開き、出品を記録する）", () => {
  const opens = scripts().filter((f) => /notes\/new/.test(readText(f)));
  assert.deepEqual(opens, ["scripts/launcher.mjs"]);
  const helper = readText("scripts/publish_helper.mjs");
  assert.match(helper, /if \(mode === 'note'\) \{\n[^\n]*ランチャー[^\n]*\n\s*process\.exit\(1\);/);
  assert.ok(helper.indexOf("if (mode === 'note')") < helper.indexOf("pullLatest("), "note のときは何もせずに終わる");
});

test("ランチャー: 出品履歴が壊れていたら出品させず、上書きもしない（空として扱うと上限が効かず、GitHub の履歴も消える）", () => {
  const src = readText("scripts/launcher.mjs");
  const save = src.match(/function saveHistory\(history\) \{[\s\S]*?\n\}/)[0];
  assert.match(save, /if \(historyUnreadable\(\)\) \{[\s\S]*?return false;/);
  assert.match(src, /function noteListingRefused\(\) \{\n  const why = historyUnreadable\(\)/);
});

test("ランチャー [U]: 後回し（s）はどの記事でも一覧の末尾に回し、GitHub で管理しているファイルを書き換えない", () => {
  const src = readText("scripts/launcher.mjs");
  const fn = src.match(/function runNoteUpdates\(\) \{[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(fn, /writeFileSync\(noteUpdatesFile/);
  assert.match(fn, /if \(a === 's'\) \{[\s\S]*?skippedUpdates\.add\(item\.slug\);\n\s*return runNoteUpdates\(\);/);
  assert.match(fn, /getPendingNoteUpdates\(\)\.sort\(\(a, b\) => skippedUpdates\.has\(a\.slug\) - skippedUpdates\.has\(b\.slug\)\)/);
});

test("パッケージの確認: 入っているかだけでなく、package-lock.json と版が違えば入れ直す対象にする", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atr-deps-"));
  try {
    const w = (f, o) => {
      fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
      fs.writeFileSync(path.join(root, f), JSON.stringify(o));
    };
    w("package.json", { dependencies: { sharp: "^0.35.5", "@scope/a": "^1.0.0" }, devDependencies: { "playwright-core": "1.57.0" } });
    w("package-lock.json", { packages: { "node_modules/sharp": { version: "0.35.5" }, "node_modules/@scope/a": { version: "1.2.0" }, "node_modules/playwright-core": { version: "1.57.0" }, "node_modules/dep-of-dep": { version: "2.0.0" }, "node_modules/@img/sharp-win32-x64": { version: "0.35.5" } } });
    w("node_modules/sharp/package.json", { version: "0.35.5" });
    w("node_modules/@scope/a/package.json", { version: "1.2.0" });
    w("node_modules/playwright-core/package.json", { version: "1.56.1" });
    w("node_modules/.package-lock.json", { packages: { "node_modules/sharp": { version: "0.35.5" }, "node_modules/@scope/a": { version: "1.2.0" }, "node_modules/playwright-core": { version: "1.56.1" }, "node_modules/dep-of-dep": { version: "1.0.0" } } });
    assert.deepEqual(dependencyProblems(root), ["playwright-core（1.56.1 → 1.57.0）", "dep-of-dep（1.0.0 → 2.0.0）"]);
    fs.rmSync(path.join(root, "node_modules/sharp"), { recursive: true });
    assert.ok(dependencyProblems(root).includes("sharp（未導入）"));
    // ランチャーは版の違いも見て入れ直す（起動時と、メニュー実行前に取り込んだ後）
    const src = readText("scripts/launcher.mjs");
    assert.match(src.match(/function ensureDependencies\(\) \{[\s\S]*?\n\}/)[0], /dependencyProblems\(rootDir\)/);
    assert.match(src.match(/function pullBeforeRun\(choice\) \{[\s\S]*?\n\}/)[0], /ensureDependencies\(\);/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  // このリポジトリの node_modules では問題なし（誤って毎回 npm ci しない）
  if (fs.existsSync("node_modules/.package-lock.json")) assert.deepEqual(dependencyProblems(process.cwd()), []);
});
