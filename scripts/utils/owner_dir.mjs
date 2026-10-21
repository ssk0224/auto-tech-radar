// オーナー端末だけに置くファイル（秘密鍵・復号した原稿・note 用の Chrome プロファイルなど）の置き場所。通常は ~/.auto-tech-radar。
// ATR_OWNER_DIR で差し替えられる（テストが本物の置き場所に触れずに動くため）。
// ホームのパス（HOME / USERPROFILE）を差し替えて代用しない: Windows では USERPROFILE を変えると、起動した Chrome が応答しなくなる
import os from "os";
import path from "path";

export const ownerDir = process.env.ATR_OWNER_DIR || path.join(os.homedir(), ".auto-tech-radar");
