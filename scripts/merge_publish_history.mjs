// git のマージドライバ: scripts/publish_history.json を両側の記録の和集合で統合する
// （投稿済みフラグを片側が上書きして消し、同じ記事を二重に出品・投稿する事故を防ぐ）
// 使い方: git config merge.publish-history.driver "node scripts/merge_publish_history.mjs %O %A %B"
import fs from "fs";

const [, , basePath, oursPath, theirsPath] = process.argv;
const read = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    return {};
  }
};
const ours = read(oursPath);
const theirs = read(theirsPath);
const merged = {};
for (const slug of new Set([...Object.keys(ours), ...Object.keys(theirs)])) {
  const a = ours[slug] || {};
  const b = theirs[slug] || {};
  const m = { ...b, ...a };
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // 投稿済みフラグはどちらかが true なら true、次に "failed"（自動投稿の失敗記録）を残す。日時は遅い方を残す
    if (a[k] === true || b[k] === true) m[k] = true;
    else if (a[k] === "failed" || b[k] === "failed") m[k] = "failed";
    else if (typeof a[k] === "boolean" || typeof b[k] === "boolean") m[k] = false;
    else if (typeof a[k] === "string" && typeof b[k] === "string" && /At$/.test(k)) m[k] = a[k] > b[k] ? a[k] : b[k];
  }
  merged[slug] = m;
}
fs.writeFileSync(oursPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
void basePath;
