// ランチャーが起動時・メニュー実行前に確かめる、入っているパッケージの状態。
// 入っているかだけでなく版も package-lock.json と比べる（取り込んだ更新で版だけ上がったパッケージは、
// 入っているかだけを見ると古い版のまま動き続ける。npm ci が一度失敗した後も、版を比べれば次の起動で入れ直せる）
import fs from "fs";
import path from "path";

const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch (e) {
    return null;
  }
};

// 足りない・版が違うパッケージの一覧（例: "playwright-core（1.56.1 → 1.57.0）"）。空なら問題なし
export function dependencyProblems(rootDir) {
  const pkg = readJson(path.join(rootDir, "package.json")) || {};
  const lock = readJson(path.join(rootDir, "package-lock.json"))?.packages || {};
  const problems = [];
  for (const d of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
    const installed = readJson(path.join(rootDir, "node_modules", ...d.split("/"), "package.json"))?.version;
    const want = lock[`node_modules/${d}`]?.version;
    if (!installed) problems.push(`${d}（未導入）`);
    else if (want && installed !== want) problems.push(`${d}（${installed} → ${want}）`);
  }
  // 依存の依存: npm が node_modules/.package-lock.json に残す「入れた版」と比べる（この環境に入らない別 OS 用のパッケージは比べない）
  const hidden = readJson(path.join(rootDir, "node_modules", ".package-lock.json"))?.packages;
  if (hidden) {
    for (const [p, v] of Object.entries(lock)) {
      if (!p.startsWith("node_modules/") || !hidden[p] || !v?.version) continue;
      if (hidden[p].version !== v.version && !problems.some((x) => x.startsWith(`${p.slice(13)}（`))) problems.push(`${p.slice(13)}（${hidden[p].version} → ${v.version}）`);
    }
  }
  return problems;
}
