// note 有料原稿の暗号化保管庫 CLI
//   node scripts/note_vault.mjs seal-all        平文の有料部分を含む原稿をすべて暗号化（公開鍵のみで実行可）
//   node scripts/note_vault.mjs open <slug>     出品用の完全版を ~/.auto-tech-radar/note_full/ に復号
//   node scripts/note_vault.mjs open-all        すべて復号
//   node scripts/note_vault.mjs keygen [--force]  鍵ペアを生成（秘密鍵はオーナー端末、公開鍵は keys/）
//   node scripts/note_vault.mjs rotate          現在の秘密鍵で復号 → 新しい鍵ペアで再暗号化
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  noteDir, publicKeyFile, privateKeyFile, ownerDir, openedDir,
  isSealed, splitPaid, writeSealedNote, assembleNote, openNoteForPublishing, loadPublicKey, loadPrivateKey,
} from "./utils/note_vault.mjs";

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

function keygen(force) {
  if (!force && (fs.existsSync(privateKeyFile) || fs.existsSync(publicKeyFile))) {
    throw new Error("鍵ペアは既に存在します。作り直す場合は rotate を使ってください。");
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.mkdirSync(path.dirname(privateKeyFile), { recursive: true });
  fs.writeFileSync(privateKeyFile, privateKey, { encoding: "utf8", mode: 0o600 });
  fs.mkdirSync(path.dirname(publicKeyFile), { recursive: true });
  fs.writeFileSync(publicKeyFile, publicKey, "utf8");
  console.log(`✓ 秘密鍵: ${privateKeyFile}（バックアップ必須・リポジトリに入れない）`);
  console.log(`✓ 公開鍵: ${publicKeyFile}（コミットする）`);
}

function rotate() {
  const priv = loadPrivateKey();
  const full = noteFiles().map((f) => [f, assembleNote(f, priv)]);
  fs.renameSync(privateKeyFile, `${privateKeyFile}.old-${Date.now()}`);
  keygen(true);
  const pub = loadPublicKey();
  full.forEach(([f, content]) => writeSealedNote(f, content, pub));
  console.log(`✓ ${full.length} 本を新しい鍵で再暗号化しました。古い秘密鍵は ${ownerDir} に .old-* として残しています。`);
}

try {
  if (cmd === "seal-all") sealAll();
  else if (cmd === "open" && arg) console.log(`✓ ${openNoteForPublishing(path.join(noteDir, `${arg}_note.md`))}`);
  else if (cmd === "open-all") { noteFiles().forEach((f) => openNoteForPublishing(f)); console.log(`✓ 復号先: ${openedDir}`); }
  else if (cmd === "keygen") keygen(arg === "--force");
  else if (cmd === "rotate") rotate();
  else {
    console.log("usage: node scripts/note_vault.mjs seal-all | open <slug> | open-all | keygen [--force] | rotate");
    process.exit(1);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
