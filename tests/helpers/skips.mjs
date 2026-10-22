// 環境に本当に無いものを理由にした skip の理由を返す。Windows の CI（ATR_FORBID_SKIP=1）が通す skip は、ここが出した理由だけ。
// 理由の文言で許可すると、別の理由（Chrome が見つからない等）の skip に許可した文言を書き足すだけで通ってしまう。
// ここは「無い」ことを自分で確かめ、あるのに呼ばれたら失敗にする。理由には、この実行だけの印（skip_gate_reporter.mjs が作り、test_env.mjs が受け取る）を付ける。
import fs from "fs";
import path from "path";
import { loadPrivateKeys } from "../../scripts/utils/note_vault.mjs";

const stamp = globalThis[Symbol.for("auto-tech-radar.test_env")]?.skipStamp;
const reason = (text) => (stamp ? `${text} [atr-skip:${stamp}]` : text);
const mislabeled = (what) => new Error(`${what}があるのに「${what}が無い」として skip しようとした（skip の理由は、実際に無いときだけ使う。tests/helpers/skips.mjs）`);

// 有料本文の復号は秘密鍵のある owner PC だけ（CI は秘密情報を使わない）
export function noPrivateKey() {
  try {
    loadPrivateKeys();
  } catch {
    return reason("秘密鍵が無いため未実施（オーナー端末で npm test すると実行される）");
  }
  throw mislabeled("秘密鍵");
}

// xvfb-run（仮想ディスプレイ）は Linux 専用
export function noXvfb() {
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), "/usr/bin"];
  if (dirs.some((d) => d && fs.existsSync(path.join(d, "xvfb-run")))) throw mislabeled("xvfb-run");
  return reason("xvfb-run が無い環境では未実施");
}
