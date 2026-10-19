// git のマージドライバ: scripts/note_urls.json を両側の記録の和集合で統合する
// 使い方: git config merge.note-urls.driver "node scripts/merge_note_urls.mjs %O %A %B"
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

const allSlugs = new Set([...Object.keys(ours), ...Object.keys(theirs)]);
for (const slug of allSlugs) {
  const a = ours[slug] || {};
  const b = theirs[slug] || {};
  const item = { ...b, ...a };

  // url は実在する方を優先
  if (!item.url && b.url) item.url = b.url;

  // duplicates 配列は重複なしで和集合
  const dups = new Set([...(a.duplicates || []), ...(b.duplicates || [])]);
  if (dups.size > 0) item.duplicates = Array.from(dups);

  merged[slug] = item;
}

fs.writeFileSync(oursPath, JSON.stringify(merged, null, 2) + "\n", "utf8");
void basePath;
