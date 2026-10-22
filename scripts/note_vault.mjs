// note 有料原稿の暗号化保管庫 CLI
//   node scripts/note_vault.mjs seal-all        平文の有料部分を含む原稿をすべて暗号化（公開鍵のみで実行可）
//   node scripts/note_vault.mjs open <slug>     出品用の完全版を ~/.auto-tech-radar/note_full/ に復号
//   node scripts/note_vault.mjs open-all        すべて復号
//   node scripts/note_vault.mjs reseal [--all]  古い鍵・旧形式の暗号化ファイル（--all: すべて）を現在の公開鍵で暗号化し直す
//   node scripts/note_vault.mjs keygen          鍵ペアを生成（秘密鍵はオーナー端末、公開鍵は keys/）
//   node scripts/note_vault.mjs rotate          新しい鍵ペアを作り、すべて暗号化し直す
// 鍵の作り直し（rotate）の前に GitHub Actions の Daily Tech Radar Pipeline を一時停止してください。
// 停止しないと、作り直しの最中に CI が古い公開鍵で暗号化した原稿が混ざります（その場合は reseal で直せます）。
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  noteDir, publicKeyFile, privateKeyFile, openedDir,
  isSealed, splitPaid, writeSealedNote, assembleNote, openNoteForPublishing, paidContentSummary, summaryFileFor,
  loadPublicKey, loadPrivateKeys, keyId, sealedFileFor, sealedInfo,
} from "./utils/note_vault.mjs";
import { paidHeadingsToBold } from "./utils/headings.mjs";

const [cmd, arg] = process.argv.slice(2);

function noteFiles() {
  return fs.readdirSync(noteDir).filter((f) => f.endsWith("_note.md")).map((f) => path.join(noteDir, f));
}

function sealAll() {
  const pub = loadPublicKey();
  let sealed = 0;
  for (const f of noteFiles()) {
    const content = fs.readFileSync(f, "utf8");
    if (isSealed(content) || !splitPaid(content)) continue;
    writeSealedNote(f, content, pub);
    sealed++;
  }
  console.log(`✓ 有料部分を暗号化: ${sealed} 本`);
}

function generatePair() {
  return crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function keygen() {
  if (fs.existsSync(privateKeyFile) || fs.existsSync(publicKeyFile)) {
    throw new Error("鍵ペアは既に存在します。作り直す場合は rotate を使ってください。");
  }
  const { publicKey, privateKey } = generatePair();
  fs.mkdirSync(path.dirname(privateKeyFile), { recursive: true });
  fs.writeFileSync(privateKeyFile, privateKey, { encoding: "utf8", mode: 0o600 });
  fs.mkdirSync(path.dirname(publicKeyFile), { recursive: true });
  fs.writeFileSync(publicKeyFile, publicKey, "utf8");
  console.log(`✓ 秘密鍵: ${privateKeyFile}（バックアップ必須・リポジトリに入れない）`);
  console.log(`✓ 公開鍵: ${publicKeyFile}（コミットする）`);
}

// 現在の公開鍵・現行形式でない暗号化ファイルを暗号化し直す。all: すべて暗号化し直す
// （有料部分の見出しを太字の行にする。平文は端末のメモリ上だけで扱う）
function reseal(pub = loadPublicKey(), { all = false } = {}) {
  const keys = loadPrivateKeys();
  const kid = keyId(pub);
  let n = 0;
  for (const f of noteFiles()) {
    if (!isSealed(fs.readFileSync(f, "utf8"))) continue;
    const info = sealedInfo(fs.readFileSync(sealedFileFor(f), "utf8"));
    if (!all && info && info.v === 2 && info.kid === kid) continue;
    const full = assembleNote(f, keys);
    // --all: 有料部分の見出しを太字の行にしてから暗号化し直す（note.com の目次に有料部分の見出しを出さない。leakhunt C4）
    const parts = all ? splitPaid(full) : null;
    writeSealedNote(f, parts ? [...parts.head, paidHeadingsToBold(parts.paid.join("\n")), ...parts.tail].join("\n") : full, pub);
    n++;
  }
  console.log(`✓ 暗号化し直し: ${n} 本`);
}

// 有料版の内容一覧（*_note.paid.json）を作り直す。暗号化ファイルは変更しない（秘密鍵が必要）
function summarize() {
  const keys = loadPrivateKeys();
  let n = 0;
  for (const f of noteFiles()) {
    const text = fs.readFileSync(f, "utf8");
    if (!isSealed(text)) continue;
    const paid = splitPaid(assembleNote(f, keys)).paid.join("\n");
    fs.writeFileSync(summaryFileFor(f), JSON.stringify(paidContentSummary(paid), null, 2) + "\n", "utf8");
    n++;
  }
  console.log(`✓ 有料版の内容一覧: ${n} 本`);
}

// 途中で失敗しても、どの段階でも手元の鍵（現在 / .new / .old-*）で復号できる順序で進める
function rotate() {
  const keys = loadPrivateKeys();
  noteFiles().forEach((f) => assembleNote(f, keys)); // 先に全件復号できることを確認
  const { publicKey, privateKey } = generatePair();
  const newFile = `${privateKeyFile}.new`;
  fs.writeFileSync(newFile, privateKey, { encoding: "utf8", mode: 0o600 });
  const full = noteFiles().map((f) => [f, assembleNote(f, [...keys, privateKey])]);
  full.forEach(([f, content]) => writeSealedNote(f, content, publicKey));
  fs.writeFileSync(publicKeyFile, publicKey, "utf8");
  fs.renameSync(privateKeyFile, `${privateKeyFile}.old-${Date.now()}`);
  fs.renameSync(newFile, privateKeyFile);
  console.log(`✓ ${full.length} 本を新しい鍵で暗号化し直しました。keys/note_vault_public.pem と note_drafts/ をコミットしてください。`);
  console.log(`  古い秘密鍵は ${path.dirname(privateKeyFile)} に .old-* として残しています（CI が古い鍵で暗号化した原稿を reseal で直すために必要）。`);
}

try {
  if (cmd === "seal-all") sealAll();
  else if (cmd === "summarize") summarize();
  else if (cmd === "open" && arg) console.log(`✓ ${openNoteForPublishing(path.join(noteDir, `${arg}_note.md`))}`);
  else if (cmd === "open-all") { noteFiles().forEach((f) => openNoteForPublishing(f)); console.log(`✓ 復号先: ${openedDir}`); }
  else if (cmd === "reseal") reseal(loadPublicKey(), { all: arg === "--all" });
  else if (cmd === "keygen") keygen();
  else if (cmd === "rotate") rotate();
  else {
    console.log("usage: node scripts/note_vault.mjs seal-all | open <slug> | open-all | reseal | summarize | keygen | rotate");
    process.exit(1);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
