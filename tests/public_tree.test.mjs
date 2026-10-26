// 公開リポに置くのは公開する出力だけ。オーナー端末の状態・内部の文書・CI の診断結果は ownerDir / $RUNNER_TEMP に置く。
// 既知の実例を文字列の一覧で探すのでなく、(a) 内容の形、(b) コードから導いた書き出し先、(c) workflow の git add を、
// scripts/utils/public_tree.mjs の台帳と突き合わせる
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import { execFileSync } from "child_process";
import os from "os";
import path from "path";
import zlib from "zlib";
import { PUBLIC_OUTPUTS, RETIRED_OUTPUTS, publicOutputOf, isRetiredOutput, privateShapeHits, privateShapeHitsInFile, outputPathsWrittenBy, ledgerFileProblems, isSiteInput } from "../scripts/utils/public_tree.mjs";
import { trackedFiles, publishableFiles, isGitIgnored } from "./helpers/tracked_files.mjs";
import { codeFiles, writeTargetsOf, allWriteTargets } from "./helpers/write_targets.mjs";
import { workflowStagingProblems } from "./helpers/git_commands.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rel = (f) => path.relative(root, f).split(path.sep).join("/");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8").replace(/\r\n/g, "\n");

// 公開リポに出うるファイル = 追跡中 + gitignore されていない未追跡（CI が生成してこれからコミットする記事を含む）。
// 未追跡を見ないと、生成した記事が生成直後の検査に通ってコミットされ、次の便の最初の npm test で落ちて毎日の更新が止まる
test("(a) 公開リポに出うるファイル（追跡中と、gitignore されていない未追跡）に、オーナー端末・個人・ログイン専用の情報の形が無い", () => {
  const hits = [];
  for (const f of publishableFiles(root)) {
    let b;
    try {
      b = fs.readFileSync(path.join(root, f));
    } catch (e) {
      if (e.code === "ENOENT" || e.code === "EISDIR") continue; // 消したが未コミットのファイル・サブモジュール
      throw e;
    }
    for (const h of privateShapeHitsInFile(b)) hits.push(`${f}:${h.line} ${h.kind}`);
  }
  assert.deepEqual(hits, []);
});

test("(a) 未追跡で gitignore されていないファイルも検査の対象（生成した記事をコミットする前に止める）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-pub-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), "ignored/\n");
    fs.mkdirSync(path.join(dir, "ignored"));
    fs.writeFileSync(path.join(dir, "ignored", "a.txt"), "x");
    fs.writeFileSync(path.join(dir, "new article.md"), "x");
    assert.deepEqual(publishableFiles(dir).sort(), [".gitignore", "new article.md"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("(a) ファイルの読み方: UTF-16 のテキスト・1 行がとても長いファイル・バイナリの中の文字列も検査する", () => {
  const addr = ["owner.private", "gmail.com"].join("@");
  const files = {
    utf16le: Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`log\r\nmail ${addr}\r\n`, "utf16le")]),
    utf16leNoBom: Buffer.from(`out ${addr}\n`, "utf16le"),
    utf16be: Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(`x ${addr}`, "utf16le").swap16()]),
    longLine: Buffer.from(`{"a":"${"x".repeat(25000)}","m":"${addr}"}`),
    binary: Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d]), Buffer.from(`tEXtAuthor ${addr}`), Buffer.from([0, 1, 2, 3])]),
    binaryUtf16: Buffer.concat([Buffer.from([0, 1, 2, 3, 0, 0]), Buffer.from(`path ${addr}`, "utf16le"), Buffer.from([0, 0, 9])]),
  };
  for (const [name, b] of Object.entries(files)) assert.ok(privateShapeHitsInFile(b).some((h) => h.kind === "email"), name);
  // 長い base64 の 1 行（暗号化済みの原稿）でも、線形の時間で終わる
  const t = Date.now();
  privateShapeHitsInFile(Buffer.from(crypto.randomBytes(1_000_000).toString("base64")));
  assert.ok(Date.now() - t < 10000, "長い 1 行の検査が遅すぎる");
});

test("(a) 形の検査は、書き方を変えた実例を捕まえ、許可した形（noreply・例示用ドメイン・上流のライセンス表記・公開鍵）は通す", () => {
  const at = "@";
  const bs = "\\";
  const j = (...parts) => parts.join("");
  const pem = j(".", "pem");
  const bad = {
    email: [
      `連絡先 taro.yamada${at}gmail.com まで`, `<a href="mailto:x_y${at}corp.co.jp">`, `"contact": "ops+form${at}mail.example-shop.jp"`,
      // 符号化・全角・括弧書きで書いたもの（URL の %40、HTML の文字参照、全角の＠、[at] [dot]）
      j("https://formsubmit.co/owner.private", "%40", "gmail.com"), j("hanako", "&#64;", "corp.co.jp"), j("ken", "&#x40;", "mail.co.jp"),
      j("jiro", "\uFF20", "yahoo.co.jp"), j("saburo [at] ", "outlook [dot] jp"), j("sakura", "\\u0040", "ocn.ne.jp"), j("goro", "&commat;", "nifty.com"),
      // 行のどこかに (c) がある程度では、上流のライセンス表記として通さない
      j("const send = (c) => c.mail(\"shiro", at, "gmail.com\")"), j("SHIRO.GORO", at, "GMAIL.COM"),
    ],
    // 実例はこのファイル自体が検査に引っかからないよう、つなぎ合わせて作る
    "user-home-path": [
      `C:${bs}Users${bs}alice${bs}repo`, `"C:${bs}${bs}Users${bs}${bs}bob${bs}${bs}x"`, j("D:/", "Users/carol/a"), j("cd /ho", "me/dave/repo"), j("open /Us", "ers/erin/Library"), j("/c/Us", "ers/frank/x"),
      j("c:", bs, "users", bs, "gina", bs, "Documents"), j(bs, bs, "wsl.localhost", bs, "Ubuntu", bs, "home", bs, "hiro"), j(bs, bs, "wsl$", bs, "Debian", bs, "home", bs, "ivy"),
      j("/mnt/c/Us", "ers/jun/x"), j("/var/ho", "me/kai/x"), j("C:", bs, "USERS", bs, "LEO", bs, "x"),
    ],
    "cloud-sync-folder": [
      `backup: ${bs}${"One" + "Drive"}${bs}keys`, j("~/Drop", "box/notes"), j('"Goo', 'gle Drive/vault"'), `G:${bs}${j("マイ", "ドライブ")}${bs}x`,
      j("H:", bs, "My ", "Drive", bs, "keys"), j("~/Library/Cloud", "Storage/Goo", "gleDrive-x/a"), j("~/Library/Mobile Documents/com~apple~Cloud", "Docs/a"), j("D:", bs, "one", "drive", bs, "x"),
    ],
    "key-file-path": [
      `%USERPROFILE%${bs}.atr${bs}secret${pem}`, j("~/.ssh/deploy", pem), j("./keys/other", pem), `D:${bs}backup${bs}vault_20261019${pem}`,
      j("D:", bs, "backup", bs, "keys", bs, "vault_private.P", "EM"), j("~/.ssh/id_", "ed25519"), j("C:", bs, "certs", bs, "site.p", "fx"), j("./secrets/deploy.k", "ey"), j("/etc/ssl/private/site.p", "12"),
    ],
    "private-key-block": [
      j("-----BEGIN RSA ", "PRIVATE KEY-----"), j("-----BEGIN ", "PRIVATE KEY-----"), j("-----BEGIN PGP ", "PRIVATE KEY BLOCK-----"), j("-----BEGIN ENCRYPTED ", "PRIVATE KEY-----"),
      j("PuTTY-User-", "Key-File-3: ssh-ed25519"), j("key: LS0tLS1CRUdJTi", "BPUEVOU1NIIFBSSVZBVEUgS0VZLS0tLS0K"),
    ],
    hex40: [`old main ${crypto.randomBytes(20).toString("hex")}`, `sha=${crypto.randomBytes(20).toString("hex").toUpperCase()}`],
    "login-only-resource": [
      j("https://editor.note.com/notes/", "n0123456789ab/edit/"), j("see https://claude.ai/code/", "session_01AbCdEf9"), j('{ "tot', 'alPv": 237 }'),
      j('{"total', '_pv": 812, "comment', '_count": 3}'), j('"likeCo', 'unt":5'), j("https://note.com/api/v1/st", "ats/pv?filter=all&page=1"), j("GET note.com/api/v2/st", "ats/pv"),
    ],
  };
  for (const [kind, samples] of Object.entries(bad)) {
    for (const s of samples) assert.ok(privateShapeHits(s).some((h) => h.kind === kind), `${kind} を見逃した: ${s}`);
  }
  const ok = [
    `ssk0224${at}users.noreply.github.com`,
    `Co-Authored-By: Claude <noreply${at}anthropic.com>`,
    `placeholder="name${at}example.com"`,
    `git${at}github.com:owner/repo.git`,
    `<!-- SPDX-FileCopyrightText: 2024-2026 dev${at}upstream.ai -->`,
    // 描画した HTML では、ライセンス表記のコメントが行の途中に来る
    `<li>x</li></ul> <!-- SPDX-FileCopyrightText: 2024-2026 dev${at}upstream.ai --> <p>`,
    `<span class="line"><span>&lt;!-- SPDX-FileCopyrightText: 2024-2026 dev${at}upstream.ai --&gt;</span></span>`,
    String.raw`Sync configs under C:\Users\you`,
    "keys/note_vault_public.pem",
    "!keys/note_vault_public.pem",
    "*.pem",
    "%USERPROFILE%\\.auto-tech-radar\\",
    `https://editor.note.com/notes/n1/edit/`,
    `public/${crypto.randomBytes(16).toString("hex")}.txt`,
  ];
  for (const s of ok) assert.deepEqual(privateShapeHits(s), [], s);
  // 見つけた文字列そのものは返さない（CI のログも公開される）
  assert.ok(!JSON.stringify(privateShapeHits(`x taro${at}gmail.com`)).includes("taro"));
});

// 部品に分けた・隠した書き方: マークアップやコードの文字列連結で分けたもの、見えない文字、ASCII 以外の名前、二重に逃がした \、
// base64・圧縮の中身、古い Windows のホーム、ログイン後の統計の値。実例はこのファイル自体が引っかからないよう、実行時に組み立てる
test("(a) 形の検査は、部品に分けた・隠した書き方（タグや連結で分けた・見えない文字・ASCII 以外・二重の逃がし・base64・圧縮）も捕まえる", () => {
  const at = "@";
  const bs = "\\";
  const j = (...parts) => parts.join("");
  const addr = j("taro.yamada", at, "gmail.com");
  const q = '"';
  const bad = {
    email: [
      j("<span>taro.yamada</span>", at, "<span>gmail.com</span>"),
      j(q, "taro.yamada", q, " + ", q, at, q, " + ", q, "gmail.com", q),
      j("'taro' + '.yamada", at, "' + 'gmail.com'"),
      j("<b>ken</b><!-- x -->", at, "<i>mail.co.jp</i>"),
      j("{", q, "jiro.suzuki", q, "}", at, "yahoo.co.jp"),
      j("taro.yamada\u200B", at, "gmail.com"),
      j("taro\u2060.yamada", at, "\uFEFFgmail.com"),
      j("yamada.tar\u014D", at, "gmail.com"),
      j("\u5c71\u7530", at, "gmail.com"),
      j("atob(", q, Buffer.from(addr).toString("base64"), q, ")"),
      j("String.fromCharCode(", [...addr].map((c) => c.charCodeAt(0)).join(","), ")"),
    ],
    "user-home-path": [
      j("C:", bs.repeat(4), "Users", bs.repeat(4), "taro", bs.repeat(4), "x"),
      j("C:", bs.repeat(8), "Users", bs.repeat(8), "taro"),
      j("C:", bs, "Documents and Settings", bs, "taro", bs, "x"),
      j("c:/documents and ", "settings/hanako/"),
    ],
    "login-only-resource": [j('{"stats":{"p', 'v":1234,"su', 'ki":56}}'), j("{ s", "uki: 56, p", "v: 1234 }"), j('"page', 'Views": 99')],
  };
  for (const [kind, samples] of Object.entries(bad)) {
    for (const s of samples) assert.ok(privateShapeHits(s).some((h) => h.kind === kind), `${kind} を見逃した: ${JSON.stringify(s)}`);
  }
  // 圧縮したファイル（gzip・zlib）の中身も見る。中身を確かめられない圧縮・アーカイブの形式は止める
  const body = Buffer.from(`{"m":"${addr}","p":"${j("C:", bs, bs, "Users", bs, bs, "taro")}"}`);
  for (const [name, b] of Object.entries({ gzip: zlib.gzipSync(body), deflate: zlib.deflateSync(body), gzipInBase64: Buffer.from(`x=${zlib.gzipSync(body).toString("base64")}`) })) {
    assert.ok(privateShapeHitsInFile(b).some((h) => h.kind === "email"), name);
  }
  for (const [name, b] of Object.entries({ bzip2: Buffer.concat([Buffer.from("BZh91AY&SY"), crypto.randomBytes(64)]), xz: Buffer.concat([Buffer.from([0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]), crypto.randomBytes(64)]), sevenZip: Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), crypto.randomBytes(64)]) })) {
    assert.ok(privateShapeHitsInFile(b).some((h) => h.kind === "undecodable-archive"), name);
  }
  // 許可した形・ふつうのコードは通す
  for (const s of [
    j("import mdx from ", q, at, "astrojs/mdx", q, ";"),
    j("const handle = ", q, at, q, " + user.name;"),
    j("<span>", at, "</span><span>ssk0224</span>"),
    j(q, "name", q, " + ", q, at, q, " + ", q, "example.com", q),
    j('{"pv_sample": "x", "stars": 7887, "views_url": "/a"}'),
    j("atob(", q, Buffer.from("hello world, plain text here").toString("base64"), q, ")"),
  ]) assert.deepEqual(privateShapeHits(s), [], s);
});

// 台帳の場所（記事・原稿・OGP 画像）には、書く側が作る形のファイルだけを置く。場所が台帳の中でも、内部の文書・状態の JSON は入れない
test("台帳の場所に出うるファイル（追跡中と、gitignore されていない未追跡）は、その場所の書く側が作る形をしている", () => {
  const bad = [];
  for (const f of publishableFiles(root)) {
    if (!publicOutputOf(f)) continue;
    let b;
    try {
      b = fs.readFileSync(path.join(root, f));
    } catch (e) {
      if (e.code === "ENOENT" || e.code === "EISDIR") continue;
      throw e;
    }
    for (const p of ledgerFileProblems(f, b)) bad.push(`${f}: ${p}`);
  }
  assert.deepEqual(bad, []);
});

test("台帳の場所の形の検査は、場所に置いた内部の文書・状態の JSON・形の違う記事や原稿を捕まえ、.gitignore でも入らない", () => {
  const b = (s) => Buffer.from(s);
  const sealedNote = (name) => b(`# t\n\n本文\n<!-- PAID_SEALED: ${name.replace(/\.md$/, ".paid.enc")} 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->\n`);
  const bad = {
    "note_drafts/HANDOFF.md": b("# 引き継ぎ\n\n内部のメモ\n"),
    "note_drafts/handoff_note.md": b("# 引き継ぎ\n\n内部のメモ\n"),
    "note_drafts/x_note.md": sealedNote("y_note.md"),
    "note_drafts/x_note.paid.json": b('{"chars": 10, "features": [], "issues": ["a"]}'),
    "note_drafts/x_note.paid.enc": b('{"v":2,"alg":"x","aad":"other_note.md"}'),
    "note_drafts/note_status.json": b("{}"),
    "public/ogp/x.png": b("not a png"),
    "public/ogp/x.svg": b("# not svg"),
    "public/ogp/x.json": b("{}"),
    "src/pages/radar/watchlist.json": b("[]"),
    "src/pages/radar/HANDOFF.md": b("# 引き継ぎ\n\n内部のメモ\n"),
    "src/pages/radar/x.md": b('---\ntitle: "x"\n---\n本文\n'),
  };
  for (const [f, buf] of Object.entries(bad)) assert.ok(ledgerFileProblems(f, buf).length > 0, `形の違うファイルを通した: ${f}`);
  const good = {
    "note_drafts/x_note.md": sealedNote("x_note.md"),
    "note_drafts/x_note.paid.json": b('{"chars": 10, "features": ["導入提案書テンプレート（Markdown）"]}'),
    "src/pages/radar/x.md": b('---\nlayout: "../../layouts/Layout.astro"\ntitle: "x"\npubDate: "2026-10-22"\nrepoUrl: "https://github.com/o/r"\n---\n本文\n'),
    "public/ogp/x.svg": b('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  };
  for (const [f, buf] of Object.entries(good)) assert.deepEqual(ledgerFileProblems(f, buf), [], f);
  for (const f of ["note_drafts/HANDOFF.md", "note_drafts/note_status.json", "public/note_status.json", "public/ogp/x.json", "src/pages/radar/watchlist.json", "public/docs/HANDOFF.md"]) {
    assert.ok(isGitIgnored(root, f), `台帳の場所の中の、形の違うファイルが .gitignore で無視されていない: ${f}`);
  }
});

test("台帳の場所の形（封印した原稿の目印・要約の項目・暗号文の形）は、原稿を封印するコード（scripts/utils/note_vault.mjs）が書く形と一致する", async () => {
  const vault = await import("../scripts/utils/note_vault.mjs");
  const paid = "## 導入手順\n手順\n## 想定問答\nQ";
  const full = `# t\n\n${"本文。".repeat(10)}\n【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】\n${paid}\n`;
  const pub = vault.publicNoteText("note_drafts/x_note.md", full);
  assert.notEqual(pub, full, "有料ラインの書き方が変わり、封印されなかった");
  assert.deepEqual(ledgerFileProblems("note_drafts/x_note.md", Buffer.from(pub)), []);
  const summary = JSON.stringify(vault.paidContentSummary(paid), null, 2);
  assert.deepEqual(ledgerFileProblems("note_drafts/x_note.paid.json", Buffer.from(summary)), []);
  const { publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, publicKeyEncoding: { type: "spki", format: "pem" }, privateKeyEncoding: { type: "pkcs8", format: "pem" } });
  const enc = vault.encryptText(paid, publicKey, "x_note.md");
  assert.deepEqual(ledgerFileProblems("note_drafts/x_note.paid.enc", Buffer.from(enc)), []);
});

test("(b) リポのコード（scripts・src・ルートの設定。tests は除く）の書き出し先は、公開出力の台帳にあるか gitignore 済み（止めた出力 x_posts・zenn_drafts・articles には書かない）", () => {
  const bad = [];
  for (const w of allWriteTargets(root, codeFiles(root))) {
    const at = `${rel(w.file)}:${w.line} ${w.call}`;
    for (const u of w.unresolved) bad.push(`${at}: 書き先をたどれない (${u})`);
    for (const p of w.repoPaths) {
      if (isRetiredOutput(p)) bad.push(`${at}: 止めた出力に書く ${p}`);
      else if (!publicOutputOf(p) && isSiteInput(p)) bad.push(`${at}: サイトのビルドの入力（gitignore してもサイトに載る）に、台帳に無い出力を書く ${p}`);
      else if (!publicOutputOf(p) && !isGitIgnored(root, p.replace(/\*/g, "x"))) bad.push(`${at}: 公開出力の台帳に無く gitignore もされていない ${p}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("(b) 書き方を変えた書き出しもたどる: 別名の import・分割代入・代入した関数・openSync・promises・シェルのリダイレクトと出力先の引数・ヘルパー関数の呼び出し元・.mjs 以外のスクリプト", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wt2-"));
  try {
    const put = (p, text) => {
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), text);
    };
    put("scripts/utils/json_io.mjs", [
      'import fs from "fs";',
      "export function saveJson(file, obj) {",
      "  fs.writeFileSync(file, JSON.stringify(obj));",
      "}",
      "export const saveText = (target, text) => fs.writeFileSync(target, text);",
    ].join("\n"));
    put("scripts/a.mjs", [
      'import { writeFileSync as put } from "node:fs";',
      'import * as fsp from "fs/promises";',
      'import fs from "fs";',
      'import path from "path";',
      'import { execSync, execFileSync } from "child_process";',
      'import { fileURLToPath } from "url";',
      'import { saveJson, saveText as keep } from "./utils/json_io.mjs";',
      "const here = path.dirname(fileURLToPath(import.meta.url));",
      "const { appendFileSync: add } = fs;",
      "const w = fs.writeFileSync;",
      "saveJson(path.join(here, 'issue_list.json'), {});",
      "keep(path.join(process.cwd(), 'notes', 'kept.txt'), '');",
      "put(path.join(process.cwd(), 'data', 'full.json'), '');",
      "add('logs/add.txt', '');",
      "w('w/x.txt', '');",
      "const fd = fs.openSync(path.join(here, 'dump.json'), 'w');",
      "fs.writeSync(fd, 'x');",
      "fs.openSync(path.join(here, 'read.json'), 'r');",
      "execSync('node scripts/x.mjs > scripts/run_dump.json 2>&1');",
      "execSync(`node x.mjs | tee -a logs/tee.log`);",
      "const png = path.join(here, 'shot.png');",
      'execSync(`chrome --headless --screenshot="${png}" page.html`);',
      "execFileSync('powershell', ['-Command', 'Get-Date | Out-File -FilePath ps_out/date.txt']);",
      "await fsp.writeFile('p/q.txt', '');",
      "await fs.promises.appendFile('p/r.txt', '');",
      "[1].forEach(fs.writeFileSync);",
      // 名前で選んだ fs の関数・別のプログラムでのコピーと移動（最後の引数が書き先）
      "const how = 'writeFileSync';",
      "fs[how]('q/computed.txt', '');",
      "execFileSync('cp', [path.join(here, 'a.json'), 'src/owner_state4.css']);",
      "execSync('mv -f scripts/a.json docs/moved.json && echo ok');",
      "execFileSync('pwsh', ['-Command', 'Copy-Item -Path a.json -Destination ps_copy/b.json']);",
    ].join("\n"));
    put("scripts/tools/dump.cjs", 'const fs = require("fs");\nfs.writeFileSync("docs/private_state.json", "");\n');
    put("scripts/run.sh", "#!/bin/sh\necho x > sh_out/a.txt\n");
    put("scripts/run.py", "open('py_out.txt', 'w').write('x')\n");
    const got = allWriteTargets(dir, codeFiles(dir, { all: true }));
    const paths = new Set(got.flatMap((w) => w.repoPaths));
    for (const p of ["scripts/issue_list.json", "notes/kept.txt", "data/full.json", "logs/add.txt", "w/x.txt", "scripts/dump.json", "scripts/run_dump.json", "logs/tee.log", "scripts/shot.png", "ps_out/date.txt", "p/q.txt", "p/r.txt", "docs/private_state.json", "sh_out/a.txt", "src/owner_state4.css", "docs/moved.json", "ps_copy/b.json"]) {
      assert.ok(paths.has(p), `たどれなかった: ${p}（得た書き先: ${[...paths].join(", ")}）`);
    }
    assert.ok(!paths.has("scripts/read.json"), "読むだけの openSync を書き出しにした");
    const unresolved = got.filter((w) => w.unresolved.length).map((w) => `${rel2(dir, w.file)}:${w.line}`);
    assert.ok(unresolved.includes("scripts/a.mjs:26"), `関数として渡した書き出しを見逃した: ${unresolved}`);
    assert.ok(unresolved.includes("scripts/a.mjs:28"), `名前で選んだ fs の関数を見逃した: ${unresolved}`);
    assert.ok(unresolved.some((u) => u.startsWith("scripts/run.py")), "検査できない種類のスクリプトを見逃した");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
const rel2 = (base, f) => path.relative(base, f).split(path.sep).join("/");

test("(b) 書き出し先のたどり方: 基点（__dirname・cwd・ownerDir・一時フォルダ）・定数・既定値・for-of・分割代入・import した関数をたどる", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-wt-"));
  try {
    fs.mkdirSync(path.join(dir, "scripts", "utils"), { recursive: true });
    fs.writeFileSync(path.join(dir, "scripts", "utils", "where.mjs"), 'import path from "path";\nexport function stateFile(rootDir, name) {\n  return path.join(rootDir, "state", `${name}.json`);\n}\n');
    const src = [
      'import fs from "fs";',
      'import os from "os";',
      'import path from "path";',
      'import { fileURLToPath } from "url";',
      'import { ownerDir } from "./utils/owner_dir.mjs";',
      'import { stateFile } from "./utils/where.mjs";',
      "const here = path.dirname(fileURLToPath(import.meta.url));",
      "const ROOT = path.resolve(here, '..');",
      "const LOG = process.env.X_LOG || path.join(here, 'run_log.json');",
      "const [, , outArg] = process.argv;",
      "export function save({ rootDir = process.cwd() } = {}) {",
      "  fs.writeFileSync(stateFile(rootDir, 'today'), '{}');",
      "}",
      "fs.writeFileSync(LOG, '{}');",
      "fs.writeFileSync(path.join(ownerDir, 'private.json'), '{}');",
      "fs.writeFileSync(path.join(os.tmpdir(), 'x.txt'), '');",
      "fs.writeFileSync(outArg, '');",
      "for (const d of ['outbox', 'drafts']) {",
      "  fs.writeFileSync(path.join(ROOT, d, 'a.md'), '');",
      "}",
      "fs.copyFileSync(LOG, path.resolve('mirror/copy.json'));",
    ].join("\n");
    const file = path.join(dir, "scripts", "sample.mjs");
    fs.writeFileSync(file, src);
    const got = writeTargetsOf(dir, file).map((w) => [w.call, w.targets]);
    assert.deepEqual(got, [
      ["writeFileSync", ["<repo>/state/today.json"]],
      ["writeFileSync", ["<arg>", "<repo>/scripts/run_log.json"]],
      ["writeFileSync", ["<outside>"]],
      ["writeFileSync", ["<outside>"]],
      ["writeFileSync", ["<arg>"]],
      ["writeFileSync", ["<repo>/outbox/a.md", "<repo>/drafts/a.md"]],
      ["copyFileSync", ["<repo>/mirror/copy.json"]],
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("(c) workflow がコミットに足すのは、CI が書く公開出力の明示パスだけ（git の書き方・別の action・API で全部入りのコミットをしない）", () => {
  const ciPaths = outputPathsWrittenBy("ci");
  const bad = [];
  const dir = path.join(root, ".github/workflows");
  let adds = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const r = workflowStagingProblems(read(`.github/workflows/${f}`), ciPaths);
    adds += r.adds;
    for (const p of r.problems) bad.push(`${f}: ${p}`);
  }
  assert.deepEqual(bad, []);
  // 検査そのものが動いている（daily-crawl.yml に git add がある）
  assert.ok(adds > 0);
});

// 台帳で CI が書くと宣言した出力が、毎日の更新のコミットに入っていないと、生成した記事の根拠（README の事実の集合など）が公開リポに残らず、
// 次の便の最初の npm test が「根拠が無い記事」で落ちて毎日の更新が止まる（data/readme_facts/ の抜けで実際に起きた）
test("(c) 台帳で CI が書く出力は、毎日の更新（daily-crawl.yml）のコミットにすべて足されている", () => {
  const staged = read(".github/workflows/daily-crawl.yml")
    .split("\n")
    .flatMap((l) => (/^\s*git add\s+(.+)$/.exec(l)?.[1] ?? "").split(/\s+/))
    .filter(Boolean);
  assert.ok(staged.length > 0, "daily-crawl.yml に git add が無い");
  const missing = outputPathsWrittenBy("ci").filter((p) => !staged.some((s) => s === p || s === `${p}/` || `${s}/` === p));
  assert.deepEqual(missing, []);
});

test("(c) コミットの検査は、書き方を変えた全部入りのコミットを捕まえる", () => {
  const ciPaths = outputPathsWrittenBy("ci");
  const problems = (yml) => workflowStagingProblems(yml, ciPaths).problems;
  for (const y of [
    'run: |\n  git add src/pages/radar/ public/ogp/\n  git commit -m "chore: x [skip ci]"\n  git pull --rebase origin main\n  git push origin main\n',
    "run: git checkout -- scripts/note_urls.json && git clean -fdq -- src/pages/radar public",
    'run: |\n  git config --global user.name "a"\n  git fetch origin main\n  git merge --ff-only origin/main\n  git diff --staged --quiet || git rebase --abort || true\n',
    "- uses: actions/checkout@v7\n- uses: actions/deploy-pages@v5\n",
  ]) assert.deepEqual(problems(y), [], y);
  for (const y of [
    "run: git add .",
    "run: |\n  git   add -A\n",
    "run: git add --all -- .",
    "run: |\n  git add src/pages/radar/ \\\n    data/\n",
    "run: git add scripts/note_status.json && git commit -m x",
    'run: git -C "$GITHUB_WORKSPACE" add .',
    "run: git commit -a -m x",
    'run: git commit -am "x"',
    "run: git stage -A",
    "run: git add -f public/x.json",
    'run: sh -c "git add ."',
    "run: git -c alias.save=add save .",
    "run: /usr/bin/git add data/",
    "run: git commit -m x -- data/",
    "run: git update-index --add scripts/x.json",
    "run: git apply --index fix.patch",
    "run: git commit --include -m x scripts/x.json",
    "- uses: stefanzweifel/git-auto-commit-action@v5",
    "- uses: EndBug/add-and-commit@v9",
    "run: gh api -X PUT repos/o/r/contents/scripts/x.json -f content=eA==",
    // GitHub の API（REST の式つきの URL・GraphQL）・CLI でリポに書く。workflow から GitHub の API は使わない
    'run: gh api --method PUT "repos/${{ github.repository }}/contents/scripts/note_status.json" -f content=eA==',
    "run: gh api graphql -f query='mutation { createCommitOnBranch(input: {}) { commit { url } } }'",
    'run: curl -sS -X PUT -H "Authorization: Bearer $T" "$GITHUB_API_URL/repos/$GITHUB_REPOSITORY/contents/a.json" -d @body.json',
    "run: gh release upload v1 note_status.json",
    // CI の診断を、だれでも取り出せる成果物（artifact）にしない。Pages に上げるのはサイトのビルドの出力だけ
    "- uses: actions/upload-artifact@v4\n  with:\n    path: ~/.auto-tech-radar/note_status.json\n",
    "- uses: actions/upload-pages-artifact@v5\n  with:\n    path: ./data\n",
    "- uses: actions/upload-pages-artifact@v5\n",
  ]) assert.ok(problems(y).length > 0, y);
  assert.deepEqual(problems('- uses: actions/upload-pages-artifact@v5\n  with:\n    path: "./dist"\n'), []);
});

test("台帳: 追跡している状態ファイル（data/・scripts/*.json）はすべて台帳にあり、書く側が 2 つ以上の記録にはマージドライバがある", async () => {
  const { MERGE_DRIVERS } = await import("../scripts/utils/git_sync.mjs");
  const tracked = trackedFiles(root).filter((f) => f.startsWith("data/") || /^scripts\/[^/]+\.json$/.test(f));
  assert.ok(tracked.length > 0);
  for (const f of tracked) assert.ok(publicOutputOf(f)?.state, `${f} は公開出力の台帳に無い状態ファイル（オーナー端末か $RUNNER_TEMP に置く）`);
  const attrs = read(".gitattributes");
  for (const o of PUBLIC_OUTPUTS.filter((x) => x.state && x.writers.length > 1)) assert.ok(o.merge, `${o.path} は書く側が複数なのにマージドライバが無い`);
  for (const o of PUBLIC_OUTPUTS.filter((x) => x.merge)) {
    assert.ok(attrs.split("\n").includes(`${o.path} merge=${o.merge}`), `.gitattributes に ${o.path} merge=${o.merge} が無い`);
    assert.ok(MERGE_DRIVERS[`merge.${o.merge}.driver`], `MERGE_DRIVERS に ${o.merge} が無い`);
  }
  // .gitattributes のマージドライバは、台帳にある追跡ファイルにだけ付ける（消したファイルのドライバを残さない）
  for (const m of attrs.matchAll(/^(\S+)\s+merge=([\w-]+)/gm)) assert.ok(publicOutputOf(m[1])?.merge === m[2], `${m[1]} merge=${m[2]} は台帳に無い`);
});

test("止めた出力（x_posts・zenn_drafts・articles）に追跡ファイルが無い", () => {
  const left = trackedFiles(root).filter((f) => isRetiredOutput(f));
  assert.deepEqual(left, []);
  for (const r of RETIRED_OUTPUTS) assert.ok(isGitIgnored(root, `${r}x.txt`), `${r} を .gitignore に入れる（手元に残ったファイルを誤ってコミットしない）`);
});

// 公開リポに入るファイルは .gitignore の許可リストで決める（既定はすべて無視）。台帳に無い新しい書き出し先・状態ファイル・内部の文書は、
// 名前や場所を変えても既定で無視され、git add（-f を除く）でも入らない。-f で足したもの・許可リストの外に残ったものは追跡中でも見つける
test("許可リスト: 追跡中のファイルはどれも無視の対象でなく、台帳の公開出力は入れられ、台帳に無い新しい置き場所・状態ファイルは既定で無視される", () => {
  const ignoredButTracked = execFileSync("git", ["ls-files", "-z", "--cached", "--ignored", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
  assert.deepEqual(ignoredButTracked, [], "許可リストの外にある追跡ファイル（-f で足した・許可リストに無い置き場所）");
  const r = crypto.randomBytes(4).toString("hex");
  for (const o of PUBLIC_OUTPUTS) {
    const p = o.path.endsWith("/") ? `${o.path}${o.example}` : o.path;
    assert.ok(!isGitIgnored(root, p), `台帳の公開出力が無視されている: ${p}`);
  }
  for (const p of [`docs/${r}.md`, `${r}.json`, `${r}.md`, `scripts/${r}.json`, `scripts/utils/${r}.log`, `scripts/${r}/state.txt`, `data/${r}.json`, `data/${r}/a.jsonl`, `src/${r}.json`, `src/data/${r}.txt`, `tests/${r}.txt`, `keys/${r}.txt`, `.${r}/x`, `books/${r}.md`, `.github/${r}.json`]) {
    assert.ok(isGitIgnored(root, p), `台帳に無い書き出し先が無視されていない: ${p}`);
  }
});

test("公開ページが「リポジトリにある」と示すファイルは、実際に追跡されている（内部へ移したファイルを示し続けない）", () => {
  const tracked = new Set(trackedFiles(root));
  const roots = [...new Set(PUBLIC_OUTPUTS.map((o) => o.path.split("/")[0]))];
  const re = new RegExp(`\\b(?:${roots.join("|")})/[\\w./-]*\\.[a-z]{2,5}\\b`, "g");
  const bad = [];
  const walk = (d) => fs.readdirSync(path.join(root, d), { withFileTypes: true }).forEach((e) => {
    const p = `${d}/${e.name}`;
    if (e.isDirectory()) walk(p);
    else if (/\.(astro|md|js)$/.test(e.name) && !p.startsWith("src/pages/radar/")) {
      for (const m of read(p).matchAll(re)) if (!tracked.has(m[0])) bad.push(`${p}: ${m[0]}`);
    }
  });
  walk("src/pages");
  assert.deepEqual(bad, []);
});
