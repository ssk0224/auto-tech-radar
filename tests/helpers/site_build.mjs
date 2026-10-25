// サイト（astro build）を、テスト専用のコピーの中でビルドする。リポ本体の中でビルドしない。
// astro build はビルドの作業ファイル（.astro/・.prerender）をプロジェクトの直下に書く。`node --test` はテストファイルを並列に走らせるので、
// 複数のテストがリポ本体を同時にビルドすると、互いの作業ファイルを壊し合って落ちる（実際に site_offer が 8 件落ちた）。ビルドごとに別のコピーを使う。
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { linkDir } from "./links.mjs";

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");

// 重い・変わらないものはリンク、サイトの入力（src）と設定はコピー。extra(buildRoot) でビルド前に足せる（記事の追加など）
// コピーは実パス（長い名前）に作る。Windows の runner の TEMP は 8.3 形式の短い名前（C:\Users\RUNNER~1\…）で、短い名前のパスでビルドすると
// Layout の CSS の <link> が HTML から抜け、全ページが CSS なしで描画される
export function prepareBuildRoot(prefix, extra, base = os.tmpdir()) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(base, prefix)));
  for (const d of ["public", "scripts", "data", "note_drafts"]) linkDir(path.join(repoRoot, d), path.join(dir, d));
  // node_modules は丸ごとリンクしない。ビルドは node_modules の直下にキャッシュ（.vite・.astro）を書くので、丸ごとリンクすると
  // 並列のビルド（とリポ本体）が同じキャッシュを作り直し合い、Windows では rename が EPERM で落ちる。パッケージだけをリンクし、
  // 点で始まる項目（ツールのキャッシュ・.package-lock.json）は、コマンドの .bin を除いて持ち込まない
  const modules = path.join(dir, "node_modules");
  fs.mkdirSync(modules);
  for (const e of fs.readdirSync(path.join(repoRoot, "node_modules"))) {
    if (!e.startsWith(".") || e === ".bin") linkDir(path.join(repoRoot, "node_modules", e), path.join(modules, e));
  }
  for (const f of ["astro.config.mjs", "package.json"]) fs.copyFileSync(path.join(repoRoot, f), path.join(dir, f));
  fs.cpSync(path.join(repoRoot, "src"), path.join(dir, "src"), { recursive: true });
  if (extra) extra(dir);
  return dir;
}

const astroBin = () => path.join(repoRoot, "node_modules", "astro", JSON.parse(fs.readFileSync(path.join(repoRoot, "node_modules/astro/package.json"), "utf8")).bin.astro);

export function astroBuild(cwd, outDir) {
  return spawnSync(process.execPath, [astroBin(), "build", "--outDir", outDir], { cwd, encoding: "utf8", timeout: 240000 });
}

// 一時ディレクトリを消す（Windows では直前まで使っていたファイルが少しの間つかまれていることがあるので、繰り返す）
export const removeDir = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
