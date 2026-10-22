// git のマージドライバ: scripts/note_status.json（CI が公開中の note を検査した結果）は、検査時刻が新しい方を採る。
// 同時に走った CI 同士がこのファイルで衝突し、記事の公開ごと失敗するのを防ぐ
// 使い方: git config merge.note-status.driver "node scripts/merge_note_status.mjs %O %A %B"
import fs from "fs";

const [, , , oursPath, theirsPath] = process.argv;
// 読めない・壊れた入力を空（{}）として合わせると、片側の記録がすべて消える。失敗で終わり、git に衝突として止めさせる（結果は書かない）。
// 共通の祖先（%O）だけは、両側で新しく作ったファイルのとき空なので {} として扱う
const read = (p, { emptyOk = false } = {}) => {
  const text = fs.readFileSync(p, "utf8");
  if (emptyOk && !text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error(`${p} を JSON として読めないため、自動では合わせません（${e.message}）`);
    process.exit(1);
  }
};
export function newerStatus(a, b) {
  if (!a) return b;
  if (!b) return a;
  return String(b.checkedAt || "") > String(a.checkedAt || "") ? b : a;
}
if (process.argv[1] && process.argv[1].endsWith("merge_note_status.mjs")) {
  const merged = newerStatus(read(oursPath), read(theirsPath));
  fs.writeFileSync(oursPath, JSON.stringify(merged || {}, null, 2) + "\n", "utf8");
}
