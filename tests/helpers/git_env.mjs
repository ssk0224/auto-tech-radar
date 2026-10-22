// テストの git を、マシンの global / system の設定（owner PC の core.autocrlf=true など）から切り離す。
// 結果が実行する環境の git 設定で変わると、Linux の CI では緑でも owner PC では赤になる（逆もある）。
// 必要な設定（autocrlf など）は、そのテストの中で明示して固定する。
// 通常は helpers/test_env.mjs（npm test が全プロセスで読み込む）が呼ぶ。直接 `node --test` したときのために、テスト側から呼んでもよい（何度呼んでも 1 回だけ）。
import fs from "fs";
import os from "os";
import path from "path";

// このテストプロセスの間だけ有効（子プロセスの git にも環境変数で引き継がれる）。終了時に一時ファイルを消す
export function isolateGitConfig() {
  if (process.env.ATR_GIT_ISOLATED === "1" && process.env.GIT_CONFIG_GLOBAL && fs.existsSync(process.env.GIT_CONFIG_GLOBAL)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-gitcfg-"));
  const empty = path.join(dir, "gitconfig");
  fs.writeFileSync(empty, "");
  process.env.GIT_CONFIG_GLOBAL = empty;
  process.env.GIT_CONFIG_NOSYSTEM = "1";
  process.env.GIT_CONFIG_SYSTEM = empty; // GIT_CONFIG_NOSYSTEM だけを消されても、system の設定（Git for Windows は core.autocrlf=true）を読まない
  process.env.ATR_GIT_ISOLATED = "1";
  process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
}
