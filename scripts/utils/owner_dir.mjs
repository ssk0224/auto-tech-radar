// オーナー端末だけに置くファイル（秘密鍵・復号した原稿・note 用の Chrome プロファイルなど）の置き場所。通常は ~/.auto-tech-radar。
// ATR_OWNER_DIR で差し替えられる（テストが本物の置き場所に触れずに動くため）。
// ホームのパス（HOME / USERPROFILE）を差し替えて代用しない: Windows では USERPROFILE を変えると、起動した Chrome が応答しなくなる
import os from "os";
import path from "path";

export const ownerDir = process.env.ATR_OWNER_DIR || path.join(os.homedir(), ".auto-tech-radar");

// オーナー端末だけに置く状態ファイル（公開リポには置かない。scripts/utils/public_tree.mjs・tests/public_tree.test.mjs）。
// note_status: 公開中の note の検査結果（scripts/sync_note_urls.mjs が書く。CI では ATR_NOTE_STATUS で $RUNNER_TEMP に書き、コミットしない）
// note_updates: [U] で差し替える記事の一覧 / note_browser_log: [E] の実行記録 / watchlist: 選定の 2〜10 位（記事化の候補）
export const noteStatusFile = () => process.env.ATR_NOTE_STATUS || path.join(ownerDir, "note_status.json");
export const noteUpdatesFile = () => path.join(ownerDir, "note_updates.json");
export const noteBrowserLogFile = () => process.env.ATR_NOTE_LOG || path.join(ownerDir, "note_browser_log.json");
export const watchlistFile = () => path.join(ownerDir, "watchlist.json");
