// リポのファイルをテストが読むときの入口。改行を LF にそろえてから返す。
// owner PC（Windows・core.autocrlf=true）の作業ツリーは CRLF のことがあり、エディタで保存した直後のファイルにも CRLF が混じる。
// `\n` や `^...$` の正規表現・split("\n") で照合するテストが、改行の違いだけで落ちないようにする（内容の判定は変えない）
import fs from "fs";
import { normalizeEol } from "../../scripts/utils/eol.mjs";

export { normalizeEol };
export const readText = (file) => normalizeEol(fs.readFileSync(file, "utf8"));
