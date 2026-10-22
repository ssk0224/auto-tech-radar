// 履歴の書き換えで消した commit（有料本文を含んでいた旧履歴）が、GitHub でまだ SHA 指定で読めるかを匿名で確かめる。
// git 側で filter-repo と force push をしても、GitHub は消した commit を SHA で配り続ける（GitHub Support に cached view の削除を
// 依頼するまで）。その依頼が済んだかを、文書の TODO ではなく HTTP の結果（404 / 422）で判定する。
// - 調べる SHA は Secret PURGED_SHAS（空白・カンマ区切り）からだけ読む。SHA そのものはどこにも出さない（公開ログ・Issue に書かない）
// - 1 件でも読める（200）か、確かめられない（通信失敗・PURGED_SHAS が空）なら失敗にする（.github/workflows/purge-probe.yml が週次で実行）
import { pathToFileURL } from "url";
import path from "path";

const SHA = /^[0-9a-f]{7,40}$/i;

export function parseShas(raw) {
  return String(raw || "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

// 戻り値: { ok, results: [{ index, state: "purged" | "readable" | "unknown", status }] }。SHA は返さない
export async function probePurged({ shas, repo, fetchImpl = globalThis.fetch, token = "" }) {
  if (!repo) throw new Error("GITHUB_REPOSITORY がありません");
  if (shas.length === 0) return { ok: false, reason: "PURGED_SHAS が空です（調べる SHA を Secret に登録してください）", results: [] };
  const results = [];
  for (const [index, sha] of shas.entries()) {
    if (!SHA.test(sha)) {
      results.push({ index, state: "unknown", status: "invalid" });
      continue;
    }
    try {
      // 認証なし（匿名で読めるかを見る）。token は API のレート制限を避けるためだけに使う
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/commits/${sha}`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "auto-tech-radar-purge-probe", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const state = res.status === 404 || res.status === 422 ? "purged" : res.status === 200 ? "readable" : "unknown";
      results.push({ index, state, status: res.status });
    } catch (e) {
      results.push({ index, state: "unknown", status: "fetch-failed" });
    }
  }
  return { ok: results.every((r) => r.state === "purged"), results };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const r = await probePurged({ shas: parseShas(process.env.PURGED_SHAS), repo: process.env.GITHUB_REPOSITORY, token: process.env.PROBE_TOKEN || "" });
  if (r.reason) console.log(`::error title=Purge probe::${r.reason}`);
  for (const x of r.results) {
    const label = `PURGED_SHAS の ${x.index + 1} 件目`;
    if (x.state === "readable") console.log(`::error title=Purge probe::${label} が GitHub でまだ読めます（HTTP 200）。GitHub Support に cached view の削除を依頼してください`);
    else if (x.state === "unknown") console.log(`::error title=Purge probe::${label} を確かめられませんでした（${x.status}）`);
    else console.log(`✓ ${label}: 読めません（HTTP ${x.status}）`);
  }
  process.exit(r.ok ? 0 : 1);
}
