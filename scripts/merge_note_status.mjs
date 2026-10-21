// git のマージドライバ: scripts/note_status.json（CI が公開中の note を検査した結果）は、検査時刻が新しい方を採る。
// 同時に走った CI 同士がこのファイルで衝突し、記事の公開ごと失敗するのを防ぐ
// 使い方: git config merge.note-status.driver "node scripts/merge_note_status.mjs %O %A %B"
import fs from "fs";

const [, , , oursPath, theirsPath] = process.argv;
const read = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return null;
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
