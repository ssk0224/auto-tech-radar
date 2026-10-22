// `npm test` の報告係。表示は標準の spec と同じ。ATR_FORBID_SKIP=1（Windows の CI）のときだけ、許可していない理由の skip を 1 件でも見つけたら失敗にする。
// 「Chrome・Chromium・実行ファイルが見つからないので skip」は、環境に依存する書き方（固定のパス・自前の探し方）をどう書いても同じ形で現れる。
// 書き方を文字列で探すのでなく、結果（緑のまま何も検証しなかったテスト）で止める。
import { Readable } from "node:stream";
import { spec as Spec } from "node:test/reporters";

// その環境では本質的に実行できないテスト（理由の文言で許可する）。ここに足すときは「なぜ Windows の CI で実行できないか」を説明できること
export const ALLOWED_SKIP_REASONS = [
  /秘密鍵が無い/, // 有料本文の復号は秘密鍵のある owner PC だけ（CI は秘密情報を使わない）
  /xvfb-run が無い/, // xvfb-run は Linux 専用
  /オーナー端末の状態ファイルが無い/, // 差し替えリストなどオーナー端末の状態は公開リポに置かない（scripts/utils/owner_dir.mjs）ため CI には無い
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
  if (process.env.ATR_FORBID_SKIP !== "1") return;
  const bad = unexpectedSkips(skipped);
  if (bad.length === 0) return;
  process.exitCode = 1;
  yield "\n許可していない理由で skip されたテストがある（緑のまま何も検証していない）:\n";
  for (const s of bad) yield `  - ${s.name} (${String(s.file).split(/[\\/]/).pop()}): ${s.skip === true ? "(理由なし)" : s.skip}\n`;
}
