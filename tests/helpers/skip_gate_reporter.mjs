// `npm test` の報告係。表示は標準の spec と同じ。ATR_FORBID_SKIP=1（Windows の CI）のときだけ、許可していない理由の skip を 1 件でも見つけたら失敗にする。
// 「Chrome・Chromium・実行ファイルが見つからないので skip」は、環境に依存する書き方（固定のパス・自前の探し方）をどう書いても同じ形で現れる。
// 書き方を文字列で探すのでなく、結果（緑のまま何も検証しなかったテスト）で止める。
// もう一つ、常に（どの環境でも）: テストの実行中にリポの作業ツリーへ新しく現れた変更・ファイルがあれば失敗にする。
// リポの中に書くテストは、並列に走る別のテストファイルと同じ場所を取り合い（片方だけ落ちる・順番で結果が変わる）、コミットにも混ざる。
// どの書き方（fs・子プロセス・相対パス）で書いても、結果（git status に現れた）で止める。テストの一時ファイルは os.tmpdir() に置く。
// 状態は、テストを走らせる親プロセスがこの報告係を読み込んだ時点（テストファイルより先）で取る（tests/env_portability.test.mjs が確かめる）。
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { spec as Spec } from "node:test/reporters";

// 作業ツリーの、コミットされていない変更・追跡していないファイル・.gitignore に当たるもの（node_modules/ などはディレクトリ単位）の一覧
const worktreeState = () => {
  const args = ["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching"];
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return r.status === 0 ? new Set(r.stdout.split("\0").filter(Boolean)) : null; // git の作業ツリーの外では調べない
};
// テストファイルの中から（unexpectedSkips を使うために）読み込まれたときは取らない
const before = process.env.NODE_TEST_CONTEXT ? null : worktreeState();
export const newEntries = (a, b) => (a && b ? [...b].filter((e) => !a.has(e)) : []);

// その環境では本質的に実行できないテスト（理由の文言で許可する）。ここに足すときは「なぜ Windows の CI で実行できないか」を説明できること
export const ALLOWED_SKIP_REASONS = [
  /秘密鍵が無い/, // 有料本文の復号は秘密鍵のある owner PC だけ（CI は秘密情報を使わない）
  /xvfb-run が無い/, // xvfb-run は Linux 専用
];

export const unexpectedSkips = (skipped) => skipped.filter((s) => !ALLOWED_SKIP_REASONS.some((re) => re.test(String(s.skip))));

export default async function* skipGateReporter(source) {
  const skipped = [];
  const tapped = Readable.from(
    (async function* () {
      for await (const ev of source) {
        if (ev.type === "test:pass" && ev.data.skip) skipped.push({ file: ev.data.file, name: ev.data.name, skip: ev.data.skip });
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
  if (process.env.ATR_FORBID_SKIP !== "1") return;
  const bad = unexpectedSkips(skipped);
  if (bad.length === 0) return;
  process.exitCode = 1;
  yield "\n許可していない理由で skip されたテストがある（緑のまま何も検証していない）:\n";
  for (const s of bad) yield `  - ${s.name} (${String(s.file).split(/[\\/]/).pop()}): ${s.skip === true ? "(理由なし)" : s.skip}\n`;
}
