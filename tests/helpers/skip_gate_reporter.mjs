// `npm test` の報告係。表示は標準の spec と同じ。ATR_FORBID_SKIP=1（Windows の CI）のときだけ、許可していない skip・todo を 1 件でも見つけたら失敗にする。
// todo の本体が失敗したときは、どの環境でも失敗にする。
// 「Chrome・Chromium・実行ファイルが見つからないので skip」は、環境に依存する書き方（固定のパス・自前の探し方）をどう書いても同じ形で現れる。
// 書き方を文字列で探すのでなく、結果（緑のまま何も検証しなかったテスト）で止める。
// もう一つ、常に（どの環境でも）: テストの実行中にリポの作業ツリーへ新しく現れた変更・ファイルがあれば失敗にする。
// リポの中に書くテストは、並列に走る別のテストファイルと同じ場所を取り合い（片方だけ落ちる・順番で結果が変わる）、コミットにも混ざる。
// どの書き方（fs・子プロセス・相対パス）で書いても、結果（git status に現れた）で止める。テストの一時ファイルは os.tmpdir() に置く。
// 作業ツリーの外のリポの状態（.git/config・このブランチ・タグ・stash・hooks・info/exclude）も同じ: テストが書き換えたら失敗にする（owner のリポの設定が変わったまま残る）。
// 状態は、テストを走らせる親プロセスがこの報告係を読み込んだ時点（テストファイルより先）で取る（tests/env_portability.test.mjs が確かめる）。
// skip の許可は、理由の文言でなく出どころで決める: helpers/skips.mjs が「本当に無い」ことを確かめてから、この実行だけの印（ATR_SKIP_STAMP）を付けた理由を返す。
// 印は子のテストファイルにだけ環境変数で渡り、test_env.mjs が受け取ってすぐ環境から消す（テストの子孫には渡らない）。
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { spec as Spec } from "node:test/reporters";

// 作業ツリーの、コミットされていない変更・追跡していないファイル・.gitignore に当たるもの（node_modules/ などはディレクトリ単位）の一覧
const worktreeState = () => {
  const args = ["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching"];
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? new Set(r.stdout.split("\0").filter(Boolean)) : null; // git の作業ツリーの外では調べない
};
const git = (...args) => {
  const r = spawnSync("git", ["--no-optional-locks", ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};
const read = (p) => {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
};
// 作業ツリーの外のリポの状態。ほかのブランチ（並行して作業する別の worktree が動かす）は見ない
export const repoState = () => {
  const gitDir = git("rev-parse", "--path-format=absolute", "--git-dir");
  const common = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  if (!gitDir || !common) return null;
  const state = new Map([
    [".git/config", read(path.join(common, "config"))],
    [".git/config.worktree", read(path.join(gitDir, "config.worktree"))],
    [".git/info/exclude", read(path.join(common, "info", "exclude"))],
    ["HEAD", git("symbolic-ref", "-q", "HEAD") ?? git("rev-parse", "HEAD")],
    // ブランチは名前の一覧だけ（ほかの worktree のコミットで先端は動くが、ブランチの作成・削除はテストのせい）
    ["ブランチの一覧", git("for-each-ref", "--format=%(refname)", "refs/heads")],
    ["refs (このブランチ・タグ・stash)", git("for-each-ref", "--format=%(refname) %(objectname)", "refs/tags", "refs/stash", git("symbolic-ref", "-q", "HEAD") || "refs/heads/")],
  ]);
  const hooks = path.join(common, "hooks");
  for (const f of fs.existsSync(hooks) ? fs.readdirSync(hooks) : []) state.set(`.git/hooks/${f}`, read(path.join(hooks, f)));
  return state;
};
export const changedState = (a, b) => (a && b ? [...new Set([...a.keys(), ...b.keys()])].filter((k) => a.get(k) !== b.get(k)) : []);
// テストファイルの中から（unexpectedSkips を使うために）読み込まれたときは取らない
const outer = !process.env.NODE_TEST_CONTEXT;
const before = outer ? worktreeState() : null;
const beforeRepo = outer ? repoState() : null;
const STAMP = outer ? randomBytes(8).toString("hex") : null;
if (STAMP) process.env.ATR_SKIP_STAMP = STAMP;
const stampTag = (stamp) => `[atr-skip:${stamp}]`;
const unstamp = (reason) => (typeof reason === "string" ? reason.replace(/\s*\[atr-skip:[0-9a-f]+\]/g, "") : reason);
export const newEntries = (a, b) => (a && b ? [...b].filter((e) => !a.has(e)) : []);

// 許可する skip は、helpers/skips.mjs が出した（この実行の印のある）理由だけ。理由の文言は問わない（文言を書き写しただけの skip は通らない）
export const unexpectedSkips = (skipped, stamp = STAMP) => skipped.filter((s) => !(stamp && typeof s.skip === "string" && s.skip.includes(stampTag(stamp))));

export default async function* skipGateReporter(source) {
  const skipped = [];
  const todoFailed = [];
  const tapped = Readable.from(
    (async function* () {
      for await (const ev of source) {
        // todo は skip と同じく「緑のまま検証しない」書き方（本体が失敗しても全体は通る）。理由の検査は skip と同じ
        if (ev.type === "test:pass" && ev.data.skip) skipped.push({ file: ev.data.file, name: ev.data.name, skip: ev.data.skip });
        if ((ev.type === "test:pass" || ev.type === "test:fail") && ev.data.todo) skipped.push({ file: ev.data.file, name: ev.data.name, skip: ev.data.todo });
        if (ev.type === "test:fail" && ev.data.todo) todoFailed.push({ file: ev.data.file, name: ev.data.name });
        if (ev.data && typeof ev.data.skip === "string") ev.data.skip = unstamp(ev.data.skip); // 表示には印を出さない
        yield ev;
      }
    })(),
    { objectMode: true }
  );
  yield* tapped.pipe(new Spec());
  const written = newEntries(before, before && worktreeState());
  if (written.length) {
    process.exitCode = 1;
    yield "\nテストの実行中に、リポの作業ツリーに新しい変更・ファイルが現れた（テストはリポの中に書かない。os.tmpdir() を使う。実行中に自分で編集したなら走らせ直す）:\n";
    for (const e of written) yield `  - ${e}\n`;
  }
  const changed = changedState(beforeRepo, beforeRepo && repoState());
  if (changed.length) {
    process.exitCode = 1;
    yield "\nテストの実行中に、作業ツリーの外のリポの状態が変わった（テストは owner のリポの設定・ブランチ・タグ・hooks を書き換えない。git は一時ディレクトリのリポで試す）:\n";
    for (const e of changed) yield `  - ${e}\n`;
  }
  // todo の本体の失敗は、どの環境でも失敗にする（node:test は todo の失敗を全体の合否に数えない）
  if (todoFailed.length) {
    process.exitCode = 1;
    yield "\ntodo にしたテストの本体が失敗している（todo は失敗を隠す。環境が無くて実行できないなら skip(理由)、直すべきなら直す）:\n";
    for (const s of todoFailed) yield `  - ${s.name} (${String(s.file).split(/[\\/]/).pop()})\n`;
  }
  if (process.env.ATR_FORBID_SKIP !== "1") return;
  const bad = unexpectedSkips(skipped);
  if (bad.length === 0) return;
  process.exitCode = 1;
  yield "\n許可していない理由で skip・todo にされたテストがある（緑のまま何も検証していない）:\n";
  for (const s of bad) yield `  - ${s.name} (${String(s.file).split(/[\\/]/).pop()}): ${s.skip === true ? "(理由なし)" : unstamp(s.skip)}\n`;
}
