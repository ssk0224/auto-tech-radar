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
  // 無料の特典（リードマグネット）の見出し画像は、ランチャーが原稿といっしょに作る（scripts/generate_lead_magnet_note.mjs）
  { path: "public/ogp/LEAD_MAGNET_CHEAT_SHEET.svg", writers: ["owner"] },
  { path: "public/ogp/LEAD_MAGNET_CHEAT_SHEET.png", writers: ["owner"] },
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

// いちばん細かい（長い）一致を返す（public/ の中の、オーナーが書く個別のファイルなど）
export const publicOutputOf = (relPath) =>
  PUBLIC_OUTPUTS.filter((o) => under(norm(relPath), o.path)).sort((a, b) => b.path.length - a.path.length)[0] || null;
export const isRetiredOutput = (relPath) => RETIRED_OUTPUTS.some((r) => under(norm(relPath), r));
// 書く側ごとの明示パス（git add に渡す）
export const outputPathsWrittenBy = (writer) => PUBLIC_OUTPUTS.filter((o) => o.writers.includes(writer)).map((o) => o.path);

// writer（ci / owner）が書いてよい出力か: 台帳のどれかの下にあり、その出力の書く側に writer がいる。
// 「.」「:/」のような全体の指定・ワイルドカード・台帳の外は通さない（scripts/utils/git_sync.mjs の commitAndSync が、ステージの前に確かめる）
export const isWrittenBy = (relPath, writer) => {
  const p = norm(relPath);
  if (!p || p === "." || /^[:/]/.test(p) || /(?:^|\/)\.\.(?:\/|$)/.test(p) || /[*?[\]]/.test(p)) return false;
  const o = publicOutputOf(p);
  return Boolean(o && o.writers.includes(writer));
};
export const pathsOutsideLedger = (paths, writer) => paths.filter((p) => !isWrittenBy(p, writer));

// ---- 公開してはいけない内容の形（実例の文字列ではなく形で探す。新しい書き方の実例も同じ形で捕まえる） ----
// 実在の人と結びつかない、説明・既定のアカウント名（ホームのパスの中で使われる）
const PLACEHOLDER_USER = /^(?:you|your[-_.]?(?:name|user(?:name)?)?|user|username|name|me|<[^>]*>|\[[^\]]*\]|%\w+%|\$\{?\w+\}?|\{\{?\s*[\w.]+\s*\}?\}|public|default|shared|guest|runner|runneradmin|ubuntu|ec2-user|vagrant|node|root|admin)$/i;
const EXAMPLE_DOMAIN = /(?:^|\.)(?:example\.(?:com|net|org)|example|test|invalid|localhost)$/i;
// 上流のライセンス表記の行（行頭がコメント記号のあとの SPDX- / Copyright / (c) 年 / © 年）。行のどこかに (c) があるだけでは通さない
const LICENSE_LINE = /^\s*(?:(?:\/\/+|\/?\*+|#+|<!--|;+|--|%+|rem\b)\s*)?(?:SPDX-[\w-]+:|Copyright\b|\(c\)\s*\d{4}|©\s*\d{4})/i;
// ユーザー名の部分（. で始まらない。正規表現の \. のような書き方を名前と取り違えない）
const NAME_SEGMENT = String.raw`([\w$%<{[][^\\/\s"'` + "`" + String.raw`<>|:*?;,)]*)`;
const CLOUD = String.raw`(?:OneDrive(?:\s-\s[^\\/"'` + "`" + String.raw`\n]+)?|Dropbox|iCloud\s?Drive|Google\s?Drive|My\s?Drive|マイドライブ|CloudStorage|com~apple~CloudDocs|pCloud\s?Drive|MEGA\s?sync|Box\s?(?:Sync|Drive))`;
const Q = "\"'`";

const RULES = [
  {
    kind: "email",
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    allow: (m, line) => {
      const [local, domain] = m.split("@");
      if (/no-?reply/i.test(local) || /(?:^|\.)noreply\./i.test(domain) || /(?:^|\.)users\.noreply\.github\.com$/i.test(domain)) return true;
      if (EXAMPLE_DOMAIN.test(domain)) return true;
      if (local === "git" && /^[\w.-]+$/.test(domain)) return true; // git@github.com:owner/repo（SSH の URL）
      return LICENSE_LINE.test(line); // 上流の SPDX / Copyright ヘッダーの転記
    },
  },
  {
    // Windows（大文字小文字・\\ の二重を問わない）・macOS・Linux・Git Bash（/c/Users）・WSL（\\wsl$\ と /mnt/c/Users）・/var/home
    kind: "user-home-path",
    re: new RegExp(
      [
        String.raw`(?<![\w.$%~-])(?:[a-z]:)?[\\/]{1,2}(?:home|users)[\\/]{1,2}${NAME_SEGMENT}`,
        String.raw`\/[a-z]\/users\/${NAME_SEGMENT}`,
        String.raw`\\\\wsl(?:\.localhost|\$)\\[^\\\s]+\\(?:home|users)\\${NAME_SEGMENT}`,
        String.raw`\/var\/home\/${NAME_SEGMENT}`,
      ].join("|"),
      "gi",
    ),
    allow: (m, line, groups) => PLACEHOLDER_USER.test(groups.find(Boolean) || ""),
  },
  // 同期フォルダの名前がパスの一部になっているもの（区切り \ / と隣り合う）。文章の中の「Google Drive に保存」は対象外
  { kind: "cloud-sync-folder", re: new RegExp(String.raw`[\\/]\s?${CLOUD}(?=[\\/${Q}\s-]|$)|(?:^|[\s${Q}(=:])${CLOUD}[\\/]`, "gi") },
  // 鍵・証明書のファイルのパス（.pem .key .p12 .pfx .ppk .jks .kdbx と id_rsa 系）。手前を 200 文字だけ見る（長い base64 の行で後戻りが爆発しないように）
  {
    kind: "key-file-path",
    find: (line) =>
      [...line.matchAll(/\.(?:pem|key|p12|pfx|ppk|jks|keystore|kdbx)\b|(?<![\w.-])id_(?:rsa|dsa|ecdsa|ed25519)(?![\w.])/gi)]
        .map((m) => line.slice(Math.max(0, m.index - 200), m.index + m[0].length).match(/[\w.%~$:\\/-]*$/)[0])
        .filter((p) => /[\\/]/.test(p.replace(/\\[.()[\]{}^$*+?|]/g, ""))), // 正規表現の \. などはパスの区切りではない
    allow: (m) => norm(m).replace(/^\.?\//, "") === "keys/note_vault_public.pem",
  },
  // 秘密鍵の本体（PEM・PGP・PuTTY、base64 にした PEM）
  {
    kind: "private-key-block",
    find: (line) => [
      ...[...line.matchAll(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|PuTTY-User-Key-File-\d/g)].map((m) => m[0]),
      ...[...line.matchAll(/LS0tLS1CRUdJTi[A-Za-z0-9+/]{0,120}/g)].map((m) => m[0]).filter((b) => /PRIVATE KEY/.test(Buffer.from(b, "base64").toString("latin1"))),
    ],
  },
  { kind: "hex40", re: /(?<![0-9A-Fa-f])[0-9a-f]{40}(?![0-9A-Fa-f])/gi },
  // ログインしないと開けない画面・データの実体（個別の下書き・セッションの URL、ホスト付きの統計 API の URL、ログイン後の統計の値）
  {
    kind: "login-only-resource",
    re: new RegExp(
      [
        String.raw`editor\.note\.com\/notes\/n[0-9a-z]{8,}`,
        String.raw`claude\.ai\/code\/session_[A-Za-z0-9]{6,}`,
        String.raw`(?:[\w-]+\.)*note\.com\/api\/v\d+\/stats\b(?![^\s${Q}]*\$\{)`,
        String.raw`"(?:total_?(?:pv|likes?|comments?|views?|reads?|sukis?)|(?:read|like|comment|view|pv|suki)s?_?count)"\s*:\s*\d`,
      ].join("|"),
      "gi",
    ),
  },
];

// 書き方を変えた（符号化した）表記を、検査の前に元の文字へ戻す: 全角（NFKC）・HTML の文字参照・\uXXXX \xXX・URL の %XX・[at] [dot]
const NAMED_ENTITY = { commat: "@", period: ".", sol: "/", bsol: "\\", colon: ":", lowbar: "_", hyphen: "-", num: "#", percnt: "%" };
const fromCode = (n) => (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");
export function decodeLine(line) {
  let s = line.normalize("NFKC");
  s = s
    .replace(/&#(\d{1,7});?/g, (_, d) => fromCode(Number(d)))
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h) => fromCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITY[n.toLowerCase()] ?? m);
  s = s.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, a, b, c) => fromCode(parseInt(a || b || c, 16)));
  s = s.replace(/%([0-9a-f]{2})/gi, (m, h) => (parseInt(h, 16) < 0x80 ? String.fromCharCode(parseInt(h, 16)) : m));
  s = s.replace(/\s*[[({<]\s*(?:at|アット)\s*[\])}>]\s*/gi, "@").replace(/\s*[[({<]\s*(?:dot|ドット)\s*[\])}>]\s*/gi, ".");
  return s;
}

// 1 行を重なりのある区切りに分けて見る（巨大な 1 行でも最後まで、線形の時間で見る。重なりは 1 つの実例の長さより長い）
const CHUNK = 4000;
const OVERLAP = 400;
const chunksOf = (line) => {
  if (line.length <= CHUNK) return [line];
  const out = [];
  for (let i = 0; i < line.length; i += CHUNK - OVERLAP) out.push(line.slice(i, i + CHUNK));
  return out;
};

function hitsOfLine(line) {
  const kinds = new Set();
  for (const piece of chunksOf(line)) {
    const decoded = decodeLine(piece);
    for (const text of decoded === piece ? [piece] : [piece, decoded]) {
      for (const r of RULES) {
        if (kinds.has(r.kind)) continue;
        const found = r.find ? r.find(text).map((p) => [p]) : [...text.matchAll(r.re)];
        if (found.some((m) => !(r.allow && r.allow(m[0].trim(), text, m.slice(1))))) kinds.add(r.kind);
      }
    }
  }
  return [...kinds];
}

// text の中の、公開してはいけない形を返す: [{ kind, line }]（見つけた文字列そのものは出さない。CI のログも公開される）
export function privateShapeHits(text) {
  const hits = [];
  String(text).split(/\r?\n|\r/).forEach((line, i) => {
    for (const kind of hitsOfLine(line)) hits.push({ kind, line: i + 1 });
  });
  return hits;
}

// ファイルの中身を検査する文字列にする: UTF-8 / UTF-16（BOM の有無を問わない）/ バイナリ（中の ASCII・UTF-16 の文字列を 1 行ずつ）
export function textOfFile(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  const even = (b) => b.subarray(0, b.length - (b.length % 2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(even(buf.subarray(2))).swap16().toString("utf16le");
  const head = buf.subarray(0, 8000);
  if (!head.includes(0)) return buf.toString("utf8");
  let zeroHigh = 0;
  let zeroLow = 0;
  const pairs = Math.floor(head.length / 2);
  for (let i = 0; i + 1 < head.length; i += 2) {
    if (head[i + 1] === 0) zeroHigh++;
    if (head[i] === 0) zeroLow++;
  }
  if (zeroHigh > pairs * 0.4 && zeroLow < pairs * 0.05) return buf.toString("utf16le");
  if (zeroLow > pairs * 0.4 && zeroHigh < pairs * 0.05) return Buffer.from(even(buf)).swap16().toString("utf16le");
  // 10 文字以上続く文字列だけ（画像の圧縮データの中の偶然の並びを、メールアドレスなどと取り違えない。メタデータの文字列は長い）
  const runs = (s) => s.match(/[\x20-\x7e]{10,}/g) || [];
  return [...runs(buf.toString("latin1")), ...runs(buf.toString("utf16le")), ...runs(buf.subarray(1).toString("utf16le"))].join("\n");
}

export const privateShapeHitsInFile = (buf) => privateShapeHits(textOfFile(buf));
