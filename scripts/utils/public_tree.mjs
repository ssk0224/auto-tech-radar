// 公開リポに置いてよいもの（公開出力の台帳）と、置いてはいけない内容の「形」。
// このリポは公開されている。オーナー端末の状態・内部の文書・CI の診断結果は、ここではなく ownerDir（scripts/utils/owner_dir.mjs）か
// CI の $RUNNER_TEMP に置く。tests/public_tree.test.mjs と tests/state_writers.test.mjs が、追跡ファイル・書き出し先・git add をこの台帳と突き合わせる。

// 公開出力の台帳: スクリプトが書いてよい追跡パス（/ で終わるものはその配下すべて）。
// writers: 書く側（ci = GitHub Actions、owner = オーナー端末のランチャー・ツール）。state: 実行のたびに書き換わる JSON の記録。
// 書く側が 2 つ以上ある記録（state）には、.gitattributes と scripts/utils/git_sync.mjs の MERGE_DRIVERS にマージドライバが要る。
export const PUBLIC_OUTPUTS = [
  { path: "src/pages/radar/", writers: ["ci"] },
  { path: "note_drafts/", writers: ["ci", "owner"] },
  { path: "public/", writers: ["ci"] },
  { path: "data/run_status/", writers: ["ci"], state: true },
  { path: "data/ledger/", writers: ["ci"], state: true },
  { path: "data/derived/", writers: ["ci"], state: true },
  { path: "scripts/publish_history.json", writers: ["owner"], state: true, merge: "publish-history" },
  { path: "scripts/note_urls.json", writers: ["ci"], state: true, merge: "note-urls" },
  { path: "keys/note_vault_public.pem", writers: ["owner"] },
  { path: "src/config/site.js", writers: ["owner"] },
];

// 止めた出力（オーナーの判断: X の投稿文は作らない。Zenn の原稿は置かない）。どのスクリプトもここへ書かず、追跡ファイルも無い
export const RETIRED_OUTPUTS = ["x_posts/", "zenn_drafts/", "articles/"];

const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "");
const under = (p, root) => (root.endsWith("/") ? p === root.slice(0, -1) || p.startsWith(root) : p === root);

export const publicOutputOf = (relPath) => PUBLIC_OUTPUTS.find((o) => under(norm(relPath), o.path)) || null;
export const isRetiredOutput = (relPath) => RETIRED_OUTPUTS.some((r) => under(norm(relPath), r));
// 書く側ごとの明示パス（git add に渡す）
export const outputPathsWrittenBy = (writer) => PUBLIC_OUTPUTS.filter((o) => o.writers.includes(writer)).map((o) => o.path);

// ---- 公開してはいけない内容の形（実例の文字列ではなく形で探す。新しい書き方の実例も同じ形で捕まえる） ----
const PLACEHOLDER_USER = /^(?:you|user|username|<[^>]*>|%\w+%|\$\{?\w+\}?|\{\w+\}|public|default|runner|runneradmin)$/i;
const EXAMPLE_DOMAIN = /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;
const LICENSE_HEADER = /SPDX-|Copyright|\(c\)|©/i;

const RULES = [
  {
    kind: "email",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    allow: (m, line) => {
      const [local, domain] = m.split("@");
      if (/no-?reply/i.test(local) || /(?:^|\.)noreply\./i.test(domain) || /users\.noreply\.github\.com$/i.test(domain)) return true;
      if (EXAMPLE_DOMAIN.test(domain)) return true;
      if (local === "git" && /^[\w.-]+$/.test(domain)) return true; // git@github.com:owner/repo（SSH の URL）
      return LICENSE_HEADER.test(line); // 上流の SPDX / Copyright ヘッダーの転記
    },
  },
  {
    kind: "user-home-path",
    re: /\b[A-Za-z]:(?:\\{1,2}|\/)Users(?:\\{1,2}|\/)([^\\/\s"'`<>|:*?]+)|(?:^|[^\w.$%~])\/(?:home|Users)\/([A-Za-z_][\w.-]*)|\/[a-z]\/Users\/([\w.-]+)/g,
    allow: (m, line, groups) => PLACEHOLDER_USER.test(groups.find(Boolean) || ""),
  },
  { kind: "cloud-sync-folder", re: /(?:^|[\\/"'`\s])(?:OneDrive|Dropbox|iCloud ?Drive|Google ?Drive|マイドライブ)(?=[\\/"'`\s-]|$)/gi },
  // .pem の手前を 200 文字だけ見る（長い base64 の行で正規表現の後戻りが爆発しないように）。区切り（/ か \）を含むものがパス
  {
    kind: "pem-path",
    find: (line) =>
      [...line.matchAll(/[.]pem\b/g)]
        .map((m) => line.slice(Math.max(0, m.index - 200), m.index + 4).match(/[\w.%~$:\\/-]*$/)[0])
        .filter((p) => /[\\/]/.test(p)),
    allow: (m) => norm(m).replace(/^\.?\//, "") === "keys/note_vault_public.pem",
  },
  { kind: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "hex40", re: /(?<![0-9A-Fa-f])[0-9a-f]{40}(?![0-9A-Fa-f])/gi },
  // ログインしないと開けない画面・データの実体（個別の下書き・セッションの URL、ログイン後の統計の値）
  { kind: "login-only-resource", re: /editor\.note\.com\/notes\/n[0-9a-z]{8,}|claude\.ai\/code\/session_[A-Za-z0-9]{6,}|"(?:totalPv|totalLike|totalComment|read_count|like_count)"\s*:\s*\d/g },
];

// text の中の、公開してはいけない形を返す: [{ kind, line }]
export function privateShapeHits(text) {
  const hits = [];
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (line.length > 20000) line = line.slice(0, 20000); // 暗号化済みの 1 行の巨大な base64 でも線形に終わらせる
    for (const r of RULES) {
      const found = r.find ? r.find(line).map((p) => [p]) : [...line.matchAll(r.re)];
      for (const m of found) {
        if (r.allow && r.allow(m[0].trim(), line, m.slice(1))) continue;
        hits.push({ kind: r.kind, line: i + 1 }); // 見つけた文字列そのものは出さない（CI のログも公開される）
      }
    }
  });
  return hits;
}
