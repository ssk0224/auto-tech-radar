// 掲載中の記事の対象リポジトリから README の事実の集合（data/readme_facts/<slug>.json）を作る（leakhunt C3、2026-10-22）。
// 生成スクリプトは新しい記事を書くときに同じ形のファイルを書く。これは生成スクリプトより前に作った記事のために 1 回取得するもの。
// README の本文は保存しない（取り出した事実と、記事にそのまま転記する導入手順のコードブロックだけを保存する）。
//   node scripts/build_readme_facts.mjs                 掲載中の全記事（src/pages/radar/*.md の repoUrl）
//   node scripts/build_readme_facts.mjs slug=owner/repo 記事ページの無い note 原稿など、指定したものだけ
// GITHUB_TOKEN（または GH_PAT）があればレート制限を避けられる
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { readmeFacts, factsFileFor, FACTS_DIR, renderableDiagrams } from "./utils/readme_facts.mjs";
import { resolveLicense } from "./utils/license_resolver.mjs";
import { repoFullNameFromUrl } from "./utils/ledger.mjs";

const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
const headers = { "User-Agent": "Auto-Tech-Radar/2.0", ...(token ? { Authorization: `Bearer ${token}` } : {}) };

async function getJson(url, fetchImpl) {
  const res = await fetchImpl(url, { headers: { ...headers, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}
async function getReadme(full, fetchImpl) {
  const res = await fetchImpl(`https://api.github.com/repos/${full}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`README HTTP ${res.status}: ${full}`);
  return res.text();
}

export async function buildFacts(slug, full, { fetchImpl = globalThis.fetch } = {}) {
  const [owner, name] = full.split("/");
  const [repo, readme, license] = await Promise.all([getJson(`https://api.github.com/repos/${full}`, fetchImpl), getReadme(full, fetchImpl), resolveLicense(owner, name, { headers, fetchImpl })]);
  // 必須項目が欠けた応答から、リポジトリ名の無い事実の集合を書かない
  if (!repo || typeof repo.full_name !== "string" || !repo.full_name) throw new Error(`リポジトリの情報に full_name がありません: ${full}`);
  const { spdx, name: licenseName, url, status, sourceAvailable, extraNotices } = license;
  const facts = readmeFacts(readme, { repo: repo.full_name, created_at: repo.created_at, language: repo.language, description: repo.description, license: { spdx, name: licenseName, url, status, sourceAvailable, extraNotices } });
  facts.diagrams = await renderableDiagrams(facts.diagrams);
  fs.mkdirSync(FACTS_DIR, { recursive: true });
  fs.writeFileSync(factsFileFor(slug), JSON.stringify(facts, null, 2) + "\n", "utf8");
  return facts;
}

function targets(args) {
  if (args.length) return args.map((a) => a.split("="));
  const dir = "src/pages/radar";
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md")).flatMap((f) => {
    const url = (fs.readFileSync(path.join(dir, f), "utf8").match(/^repoUrl:\s*["']?([^"'\r\n]+)/m) || [])[1];
    const full = repoFullNameFromUrl(url);
    return full ? [[f.replace(/\.md$/, ""), full]] : [];
  });
}

if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let failed = 0;
  for (const [slug, full] of targets(process.argv.slice(2))) {
    try {
      const f = await buildFacts(slug, full);
      console.log(`✓ ${slug}: 文 ${f.sentences.length} / 数値 ${f.quantities.length} / ホスト ${f.hosts.length} / コマンドの語 ${f.commands.length} / 導入手順 ${f.install_blocks.length} / 開発段階 ${f.status_lines.length}`);
    } catch (e) {
      failed++;
      console.error(`✖ ${slug}: ${e.message}`);
    }
  }
  if (failed) process.exitCode = 1;
}
