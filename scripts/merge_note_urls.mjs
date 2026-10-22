// git のマージドライバ: scripts/note_urls.json を記事（slug）単位で三方向マージする
// 使い方: git config merge.note-urls.driver "node scripts/merge_note_urls.mjs %O %A %B"
// - 片側だけが変えた記事は、変えた側を採る（rebase では %A が取り込み先、%B が載せ直すコミット）
// - 片側が消し、もう片側が変えていない記事は消す（note で非公開にした記事のリンクを復活させない）
// - 両側が別々に変えた記事は、より新しい取得結果である %B（載せ直す側＝今回の同期結果）を採る
import fs from "fs";

const [, , basePath, oursPath, theirsPath] = process.argv;
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
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

export function mergeNoteUrls(base, ours, theirs) {
  const merged = {};
  for (const slug of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
    const o = base[slug];
    const a = ours[slug];
    const b = theirs[slug];
    let v;
    if (same(a, o)) v = b;
    else if (same(b, o)) v = a;
    else v = b !== undefined ? b : a;
    if (v !== undefined) merged[slug] = v;
  }
  return Object.fromEntries(Object.entries(merged).sort(([x], [y]) => x.localeCompare(y)));
}

if (process.argv[1] && process.argv[1].endsWith("merge_note_urls.mjs")) {
  fs.writeFileSync(oursPath, JSON.stringify(mergeNoteUrls(read(basePath, { emptyOk: true }), read(oursPath), read(theirsPath)), null, 2) + "\n", "utf8");
}
