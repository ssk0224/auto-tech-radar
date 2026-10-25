// ディレクトリへのリンクを作る。Windows の symlink（type "dir"）は管理者権限か開発者モードが無いと EPERM になるので、権限のいらない junction を使う
// （Linux・macOS では普通の symlink）。テストが特別な権限を前提にしないための唯一の入口
import fs from "fs";
import path from "path";

// 比べるための正規形（親ディレクトリだけ実体に解決する。8.3 の短い名前・大文字小文字の違いをそろえる。リンク自身は解決しない）
const key = (p) => {
  const abs = path.resolve(p);
  const s = path.join(fs.realpathSync.native(path.dirname(abs)), path.basename(abs));
  return process.platform === "win32" ? s.toLowerCase() : s;
};

export function linkDir(target, linkPath) {
  // 型は全 OS で "junction"（Linux・macOS では型が無視されて普通の symlink になる）。helpers/test_env.mjs は junction 以外の symlink を拒否する
  fs.symlinkSync(target, linkPath, "junction");
}

// fs で作った junction を登録簿に書く（helpers/test_env.mjs の fs.symlink* が呼ぶ）。終了時に「fs を通さずに作ったリンク」を探すため
export function registerLink(linkPath) {
  if (process.env.ATR_LINK_REGISTRY) fs.appendFileSync(process.env.ATR_LINK_REGISTRY, key(linkPath) + "\n");
}

// dir の下にあるリンクのうち、linkDir の登録簿に無いもの（リンクの先はたどらない）
export function unregisteredLinks(dir, registry) {
  const known = new Set(registry && fs.existsSync(registry) ? fs.readFileSync(registry, "utf8").split("\n").filter(Boolean) : []);
  const found = [];
  const walk = (d) => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      if (e.code === "ENOENT") return; // 調べている間に消えた
      throw e;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) {
        if (!known.has(key(p))) found.push(p);
      } else if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return found;
}
