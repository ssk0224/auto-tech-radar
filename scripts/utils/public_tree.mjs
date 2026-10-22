// 公開リポに置いてよいもの（公開出力の台帳）と、置いてはいけない内容の「形」。
// このリポは公開されている。オーナー端末の状態・内部の文書・CI の診断結果は、ここではなく ownerDir（scripts/utils/owner_dir.mjs）か
// CI の $RUNNER_TEMP に置く。tests/public_tree.test.mjs と tests/state_writers.test.mjs が、追跡ファイル・書き出し先・git add をこの台帳と突き合わせる。
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import zlib from "zlib";

// 公開出力の台帳: スクリプトが書いてよい追跡パス（/ で終わるものはその配下すべて）。
// writers: 書く側（ci = GitHub Actions、owner = オーナー端末のランチャー・ツール）。state: 実行のたびに書き換わる JSON の記録。
// 書く側が 2 つ以上ある記録（state）には、.gitattributes と scripts/utils/git_sync.mjs の MERGE_DRIVERS にマージドライバが要る。
// shape: 書く側が作るファイルの形（SHAPES）。example: 場所（/ で終わるもの）に書く側が置くファイル名の例（許可リストの検査に使う）。場所が台帳の中でも、この形でないファイル（内部の文書・状態の JSON）は公開しない。
// .gitignore の許可リストも、場所ごとにこの形のファイル名だけを許す（tests/public_tree.test.mjs が両方を確かめる）
export const PUBLIC_OUTPUTS = [
  { path: "src/pages/radar/", writers: ["ci"], shape: "radar-article", example: "x.md" },
  { path: "note_drafts/", writers: ["ci", "owner"], shape: "sealed-note", example: "x_note.md" },
  // 無料の特典（リードマグネット）の原稿と見出し画像は、ランチャーが作る（scripts/generate_lead_magnet_note.mjs）
  { path: "note_drafts/LEAD_MAGNET_CHEAT_SHEET.md", writers: ["owner"], shape: "markdown" },
  // public/ の直下の静的ファイル（robots.txt など）は手で書くソースで、スクリプトは書かない（.gitignore で名前ごとに許可）
  { path: "public/ogp/", writers: ["ci"], shape: "image", example: "x.png" },
  { path: "public/ogp/LEAD_MAGNET_CHEAT_SHEET.svg", writers: ["owner"], shape: "image" },
  { path: "public/ogp/LEAD_MAGNET_CHEAT_SHEET.png", writers: ["owner"], shape: "image" },
  { path: "data/run_status/", writers: ["ci"], state: true, shape: "json", example: "2026-01-01.json" },
  { path: "data/ledger/", writers: ["ci"], state: true, shape: "json", example: "2026/01/2026-01-01.jsonl" },
  { path: "data/derived/", writers: ["ci"], state: true, shape: "json", example: "x.json" },
  { path: "scripts/publish_history.json", writers: ["owner"], state: true, merge: "publish-history", shape: "json" },
  { path: "scripts/note_urls.json", writers: ["ci"], state: true, merge: "note-urls", shape: "json" },
  { path: "keys/note_vault_public.pem", writers: ["owner"], shape: "public-key" },
  { path: "src/config/site.js", writers: ["owner"], shape: "code" },
];

// 止めた出力（オーナーの判断: X の投稿文は作らない。Zenn の原稿は置かない）。どのスクリプトもここへ書かず、追跡ファイルも無い
export const RETIRED_OUTPUTS = ["x_posts/", "zenn_drafts/", "articles/"];

const norm = (p) => String(p).replace(/\\/g, "/").replace(/^\.\//, "");
const under = (p, root) => (root.endsWith("/") ? p === root.slice(0, -1) || p.startsWith(root) : p === root);

// いちばん細かい（長い）一致を返す（public/ の中の、オーナーが書く個別のファイルなど）
export const publicOutputOf = (relPath) =>
  PUBLIC_OUTPUTS.filter((o) => under(norm(relPath), o.path)).sort((a, b) => b.path.length - a.path.length)[0] || null;
// サイトのビルドの入力（public/ はそのまま、src/ はページとして載る）。gitignore してもサイトに載るので、ここへの書き出しは台帳の出力だけ
export const SITE_INPUTS = ["public/", "src/"];
export const isSiteInput = (relPath) => SITE_INPUTS.some((r) => under(norm(relPath), r));
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
// 行の途中のコメント（HTML のコメント・コードブロックの中で &lt;!-- と逃がしたもの・/* */）の中で、アドレスの直前にあるライセンス表記
const LICENSE_COMMENT_BEFORE = /(?:<!--|&lt;!--|\/\*)\s*(?:SPDX-[\w-]+:|Copyright\b|\(c\)\s*\d{4}|©\s*\d{4})(?:(?!-->|--&gt;|\*\/)[^\n<>])*$/i;
// ユーザー名の部分（. で始まらない。正規表現の \. のような書き方を名前と取り違えない）
const NAME_SEGMENT = String.raw`([\p{L}\p{N}_$%<{[][^\\/\s"'` + "`" + String.raw`<>|:*?;,)]*)`;
const CLOUD = String.raw`(?:OneDrive(?:\s-\s[^\\/"'` + "`" + String.raw`\n]+)?|Dropbox|iCloud\s?Drive|Google\s?Drive|My\s?Drive|マイドライブ|CloudStorage|com~apple~CloudDocs|pCloud\s?Drive|MEGA\s?sync|Box\s?(?:Sync|Drive))`;
const Q = "\"'`";

const RULES = [
  {
    kind: "email",
    // 名前とドメインは ASCII 以外の文字（ō・漢字・全角を NFKC で直したもの）も含む
    re: /[\p{L}\p{M}\p{N}._%+-]+@[\p{L}\p{M}\p{N}-]+(?:\.[\p{L}\p{M}\p{N}-]+)*\.\p{L}{2,}/gu,
    allow: (m, line, groups, index) => {
      const [local, domain] = m.split("@");
      if (/no-?reply/i.test(local) || /(?:^|\.)noreply\./i.test(domain) || /(?:^|\.)users\.noreply\.github\.com$/i.test(domain)) return true;
      if (EXAMPLE_DOMAIN.test(domain)) return true;
      if (local === "git" && /^[\w.-]+$/.test(domain)) return true; // git@github.com:owner/repo（SSH の URL）
      // 上流の SPDX / Copyright ヘッダーの転記。描画した HTML では、コメントが行の途中に来る（同じコメントの中で、アドレスの直前にあるもの）
      return LICENSE_LINE.test(line) || LICENSE_COMMENT_BEFORE.test(line.slice(Math.max(0, index - 200), index));
    },
  },
  {
    // Windows（大文字小文字・\\ の二重を問わない）・macOS・Linux・Git Bash（/c/Users）・WSL（\\wsl$\ と /mnt/c/Users）・/var/home
    kind: "user-home-path",
    re: new RegExp(
      [
        String.raw`(?<![\w.$%~-])(?:[a-z]:)?[\\/]{1,2}(?:home|users|documents and settings)[\\/]{1,2}${NAME_SEGMENT}`,
        String.raw`\/[a-z]\/users\/${NAME_SEGMENT}`,
        String.raw`\\\\wsl(?:\.localhost|\$)\\[^\\\s]+\\(?:home|users)\\${NAME_SEGMENT}`,
        String.raw`\/var\/home\/${NAME_SEGMENT}`,
      ].join("|"),
      "giu",
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
        // note の統計の項目名そのもの（pv・スキ・ページビュー）に数が付いたもの。JSON のキーでも JS のプロパティでも
        String.raw`(?<![\w$-])["']?(?:pv|pvs|sukis?|page_?views?)["']?\s*[:=]\s*\d`,
      ].join("|"),
      "gi",
    ),
  },
];

// 書き方を変えた（符号化した）表記を、検査の前に元の文字へ戻す: 全角（NFKC）・見えない文字・HTML の文字参照・\uXXXX \xXX・URL の %XX・[at] [dot]
const NAMED_ENTITY = { commat: "@", period: ".", sol: "/", bsol: "\\", colon: ":", lowbar: "_", hyphen: "-", num: "#", percnt: "%" };
const fromCode = (n) => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "");
// 見えない文字（ゼロ幅の空白・結合子、方向の制御、BOM、ソフトハイフンなど Unicode の書式文字）。表示では消えるので、検査の前に取り除く
const INVISIBLE = /\p{Cf}/gu;
export function decodeLine(line) {
  let s = line.normalize("NFKC").replace(INVISIBLE, "");
  s = s
    .replace(/&#(\d{1,7});?/g, (_, d) => fromCode(Number(d)))
    .replace(/&#x([0-9a-f]{1,6});?/gi, (_, h) => fromCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED_ENTITY[n.toLowerCase()] ?? m);
  s = s.replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi, (_, a, b, c) => fromCode(parseInt(a || b || c, 16)));
  s = s.replace(/%([0-9a-f]{2})/gi, (m, h) => (parseInt(h, 16) < 0x80 ? String.fromCharCode(parseInt(h, 16)) : m));
  s = s.replace(/\s*[[({<]\s*(?:at|アット)\s*[\])}>]\s*/gi, "@").replace(/\s*[[({<]\s*(?:dot|ドット)\s*[\])}>]\s*/gi, ".");
  return s.normalize("NFKC").replace(INVISIBLE, "");
}

// 部品に分けた書き方をつなぐ: String.fromCharCode(…)、マークアップのタグ・コメント、文字列の連結（"a" + "b"）、
// テンプレート・Astro の式の中の文字列（{"a"}・${"a"}）、二重以上に逃がした \（JSON の中の JSON）。
// タグを消すと属性の中の値も消えるので、元の行・戻した行といっしょに見る（どれか 1 つで見つかれば止める）
export function joinParts(s) {
  return s
    .replace(/String\.fromCharCode\(\s*((?:0x[0-9a-f]+|\d+)(?:\s*,\s*(?:0x[0-9a-f]+|\d+))*)\s*\)/gi, (_, list) => list.split(",").map((n) => fromCode(Number(n.trim()))).join(""))
    .replace(/<!--.*?-->/g, "")
    .replace(/<\/?[A-Za-z][^<>]{0,500}>/g, "")
    .replace(/["'`]\s*\+\s*["'`]/g, "")
    .replace(/\$?\{\s*["'`]|["'`]\s*\}/g, "")
    .replace(/\\{2,}/g, "\\");
}

// 行の中に埋め込んだ base64（URL 用の - _ も）・16 進の文字列の中身。文字として読める（UTF-8 として正しく、制御文字が無い）か、
// 圧縮されていて展開できるものだけを返す（画像・暗号文などの、文字でない中身は見ない）
const B64_RUN = /[A-Za-z0-9+/_-]{16,}={0,2}/g;
const HEX_RUN = /(?<![0-9a-f])(?:[0-9a-f]{2}){12,}(?![0-9a-f])/gi;
const utf8 = new TextDecoder("utf-8", { fatal: true });
const PRINTABLE = /^[^\x00-\x08\x0b\x0c\x0e-\x1f\x7f]*$/;
function readableOf(buf, depth) {
  const inflated = decompressed(buf);
  if (inflated) return textOfFile(inflated, depth + 1);
  let t;
  try {
    t = utf8.decode(buf);
  } catch {
    return null; // UTF-8 として読めない＝文字ではない中身（画像・暗号文）
  }
  return PRINTABLE.test(t) ? t : null;
}
function embeddedTexts(line, depth) {
  const out = [];
  for (const m of line.matchAll(B64_RUN)) {
    const run = m[0].replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
    // 前に別の文字がつながっていても読めるように、4 通りの区切りで試す（長い暗号文は先頭からだけ）
    for (let k = 0; k < (run.length <= 8192 ? 4 : 1); k++) {
      const t = readableOf(Buffer.from(run.slice(k), "base64"), depth);
      if (t) out.push(t);
    }
  }
  for (const m of line.matchAll(HEX_RUN)) {
    const t = readableOf(Buffer.from(m[0], "hex"), depth);
    if (t) out.push(t);
  }
  return out;
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

// 中身の中の中身（base64 の中の gzip など）をたどる深さ
const MAX_DEPTH = 3;
function hitsOfLine(line, depth) {
  const kinds = new Set();
  for (const piece of chunksOf(line)) {
    const decoded = decodeLine(piece);
    const views = new Set([piece, decoded, joinParts(decoded), joinParts(piece)]);
    for (const text of views) {
      for (const r of RULES) {
        if (kinds.has(r.kind)) continue;
        const found = r.find ? r.find(text).map((p) => [p]) : [...text.matchAll(r.re)];
        if (found.some((m) => !(r.allow && r.allow(m[0].trim(), text, m.slice(1), m.index ?? 0)))) kinds.add(r.kind);
      }
    }
  }
  if (depth < MAX_DEPTH) {
    for (const t of embeddedTexts(line, depth)) for (const h of privateShapeHits(t, depth + 1)) kinds.add(h.kind);
  }
  return [...kinds];
}

// text の中の、公開してはいけない形を返す: [{ kind, line }]（見つけた文字列そのものは出さない。CI のログも公開される）
export function privateShapeHits(text, depth = 0) {
  const hits = [];
  String(text).split(/\r?\n|\r/).forEach((line, i) => {
    for (const kind of hitsOfLine(line, depth)) hits.push({ kind, line: i + 1 });
  });
  return hits;
}

// 圧縮（gzip・zlib）は展開して中を見る。展開して中を確かめられない圧縮・アーカイブ（bzip2・xz・7z・rar・zip・zstd・lz4）は、
// 中身を検査できないので公開しない（必要になったら、展開できる形で置くか、展開のしかたをここに足す）
const UNDECODABLE = [[0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00], [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], [0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x28, 0xb5, 0x2f, 0xfd], [0x04, 0x22, 0x4d, 0x18]];
const startsWith = (buf, sig) => sig.every((b, i) => buf[i] === b);
const isGzip = (buf) => buf[0] === 0x1f && buf[1] === 0x8b;
const isZlib = (buf) => buf[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(buf[1]) && ((buf[0] << 8) | buf[1]) % 31 === 0;
function decompressed(buf) {
  if (!isGzip(buf) && !isZlib(buf)) return null;
  try {
    return isGzip(buf) ? zlib.gunzipSync(buf) : zlib.inflateSync(buf);
  } catch {
    return null; // 偶然 zlib の頭に見えただけのデータ（ファイルの先頭なら archiveHits が止める）
  }
}
function archiveHits(buf) {
  const bzip2 = startsWith(buf, [0x42, 0x5a, 0x68]) && buf[3] >= 0x31 && buf[3] <= 0x39;
  if (bzip2 || UNDECODABLE.some((sig) => startsWith(buf, sig))) return [{ kind: "undecodable-archive", line: 1 }];
  if ((isGzip(buf) || isZlib(buf)) && !decompressed(buf)) return [{ kind: "undecodable-archive", line: 1 }];
  return [];
}

// PNG の文字のチャンク（tEXt・圧縮した zTXt・iTXt）の中身
function pngTexts(buf) {
  const out = [];
  if (!startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return out;
  for (let i = 8; i + 12 <= buf.length; ) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === "zTXt" || type === "iTXt") {
      const z = data.indexOf(0);
      const rest = data.subarray(z + 1);
      let t = type === "zTXt" ? zlib.inflateSync(rest.subarray(1)) : null;
      if (type === "iTXt") {
        const body = rest.subarray(2);
        const a = body.indexOf(0);
        const b = body.indexOf(0, a + 1);
        t = rest[0] === 1 ? zlib.inflateSync(body.subarray(b + 1)) : body.subarray(b + 1);
      }
      out.push(t.toString("utf8"));
    }
    i += 12 + len;
  }
  return out;
}

// ファイルの中身を検査する文字列にする: UTF-8 / UTF-16（BOM の有無を問わない）/ 圧縮（展開して）/ バイナリ（中の ASCII・UTF-16 の文字列を 1 行ずつ）
export function textOfFile(buf, depth = 0) {
  const inner = depth < MAX_DEPTH ? decompressed(buf) : null;
  if (inner) return textOfFile(inner, depth + 1);
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
  return [...pngTexts(buf), ...runs(buf.toString("latin1")), ...runs(buf.toString("utf16le")), ...runs(buf.subarray(1).toString("utf16le"))].join("\n");
}

export const privateShapeHitsInFile = (buf) => [...archiveHits(buf), ...privateShapeHits(textOfFile(buf))];

// ---- 台帳の場所ごとの、書く側が作るファイルの形 ----
// note の原稿を封印したときに公開側に残す目印（scripts/utils/note_vault.mjs の placeholderFor。tests/public_tree.test.mjs が一致を確かめる）
const sealedMarkOf = (base) => `<!-- PAID_SEALED: ${base.replace(/\.md$/, ".paid.enc")} `;
const frontmatterKeys = (text) => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return m ? new Set([...m[1].matchAll(/^([A-Za-z_][\w-]*):/gm)].map((x) => x[1])) : null;
};
const parsesAsJson = (text, jsonl) => {
  try {
    if (jsonl) text.split(/\r?\n/).filter((l) => l.trim()).forEach((l) => JSON.parse(l));
    else JSON.parse(text);
    return true;
  } catch {
    return false; // JSON として読めない＝形の違うファイル（呼び出し側が問題として返す）
  }
};
const SLUG = String.raw`[a-z0-9][a-z0-9._-]*`;
export const SHAPES = {
  // 記事: src/pages/radar/<slug>.md、サイトの記事の frontmatter（scripts/crawl_and_generate.mjs が書く項目）
  "radar-article": (base, buf) => {
    if (!new RegExp(`^${SLUG}\\.md$`, "i").test(base)) return ["記事は <slug>.md だけ"];
    const keys = frontmatterKeys(buf.toString("utf8"));
    const missing = ["layout", "title", "pubDate", "repoUrl"].filter((k) => !keys?.has(k));
    return missing.length ? [`記事の frontmatter に ${missing.join(", ")} が無い`] : [];
  },
  // note の原稿: <slug>_note.md（有料部分を封印した公開側。自分の .paid.enc を指す目印がある）・.paid.enc（暗号文）・.paid.json（有料部分の要約）
  "sealed-note": (base, buf) => {
    const text = buf.toString("utf8");
    if (new RegExp(`^${SLUG}_note\\.md$`, "i").test(base)) return text.includes(sealedMarkOf(base)) ? [] : ["封印した原稿の目印（自分の .paid.enc）が無い"];
    if (new RegExp(`^${SLUG}_note\\.paid\\.enc$`, "i").test(base)) {
      let s = null;
      if (parsesAsJson(text)) s = JSON.parse(text);
      const ok = s && [1, 2].includes(s.v) && typeof s.alg === "string" && ["ek", "iv", "tag", "ct"].every((k) => typeof s[k] === "string") && (s.v === 1 || s.aad === base.replace(/\.paid\.enc$/, ".md"));
      return ok ? [] : ["暗号文の形（v・alg・ek・iv・tag・ct、自分の原稿を指す aad）でない"];
    }
    if (new RegExp(`^${SLUG}_note\\.paid\\.json$`, "i").test(base)) {
      const s = parsesAsJson(text) ? JSON.parse(text) : null;
      const ok = s && Object.keys(s).sort().join(",") === "chars,features" && Number.isInteger(s.chars) && Array.isArray(s.features) && s.features.every((f) => typeof f === "string");
      return ok ? [] : ["有料部分の要約の形（chars・features だけ）でない"];
    }
    return ["原稿の場所に置けるのは <slug>_note.md / .paid.enc / .paid.json だけ"];
  },
  markdown: (base, buf) => (/\.md$/.test(base) && /^# \S/.test(buf.toString("utf8")) ? [] : ["見出しで始まる Markdown でない"]),
  image: (base, buf) => {
    if (/\.png$/i.test(base)) return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]) ? [] : ["PNG でない"];
    if (/\.svg$/i.test(base)) return /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/.test(buf.toString("utf8")) ? [] : ["SVG でない"];
    return ["画像の場所に置けるのは .png / .svg だけ"];
  },
  json: (base, buf) => (/\.jsonl?$/.test(base) && parsesAsJson(buf.toString("utf8"), base.endsWith(".jsonl")) ? [] : ["JSON / JSONL でない"]),
  "public-key": (base, buf) => (/^-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/.test(buf.toString("utf8")) ? [] : ["公開鍵の PEM でない"]),
  code: () => [],
};

// 台帳の場所にあるファイルが、その場所の書く側が作る形か（台帳の外のファイルは対象外で、ここでは [] を返す）
export function ledgerFileProblems(relPath, buf) {
  const o = publicOutputOf(relPath);
  if (!o) return [];
  return SHAPES[o.shape](norm(relPath).split("/").pop(), buf);
}

// ディレクトリの中のすべてのファイルの、公開してはいけない内容の形: ["<相対パス>:<行> <種類>"]（見つけた文字列そのものは返さない）
export function privateShapeHitsInDir(dir) {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) for (const h of privateShapeHitsInFile(fs.readFileSync(p))) hits.push(`${path.relative(dir, p).split(path.sep).join("/")}:${h.line} ${h.kind}`);
    }
  };
  walk(dir);
  return hits;
}

// サイトの入力（SITE_INPUTS）にある、.gitignore の許可リストの外のファイル。public/ はそのままサイトに載り、src/ はページに取り込まれるので、
// 無視していても公開される（内容の形によらず止める）。git が使えないときは、確かめられないので止める（見逃すより止める）
export function ignoredSiteInputs(repoRoot) {
  const r = spawnSync("git", ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--", ...SITE_INPUTS], { cwd: repoRoot, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`サイトの入力の許可リストを確かめられません（git ls-files: ${(r.stderr || r.error?.message || "").trim()}）`);
  return r.stdout.split("\0").filter(Boolean);
}

// CLI: node scripts/utils/public_tree.mjs scan <dir>（npm run build が astro build のあとに dist を見る）。
// ソースでは読めない、ビルドの時に組み立てた値（{user}@{domain}・[a, b].join("@")・テンプレート）も、描画した結果なら見える。
// 見つけたら終了コード 1（ビルドが失敗し、配信しない）。CI のログも公開されるので、出すのはファイル・行・種類だけ
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href && process.argv[2] === "scan") {
  const dir = path.resolve(process.argv[3] || "dist");
  if (!fs.existsSync(dir)) {
    console.error(`検査するディレクトリがありません: ${path.basename(dir)}`);
    process.exit(1);
  }
  const hits = privateShapeHitsInDir(dir);
  if (hits.length) {
    console.error(`配信物に、公開してはいけない内容の形があります（${hits.length} 件）:\n${hits.join("\n")}`);
    process.exit(1);
  }
  const ignored = ignoredSiteInputs(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
  if (ignored.length) {
    console.error(`サイトの入力（public/・src/）に、許可リストの外のファイルがあります（gitignore してもサイトに載る。ownerDir か $RUNNER_TEMP に置く）:\n${ignored.join("\n")}`);
    process.exit(1);
  }
  console.log(`配信物（${path.basename(dir)}）に、公開してはいけない内容の形はありません`);
}
