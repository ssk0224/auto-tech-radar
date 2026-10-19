// note 有料原稿の暗号化保管庫
// 公開リポジトリには「無料部分 + 有料ライン + 暗号化済みの有料部分」だけを置く。
// 暗号化は公開鍵 (keys/note_vault_public.pem) だけで行えるため、CI に秘密情報は不要。
// 復号できるのは秘密鍵を持つオーナー端末のみ（既定: ~/.auto-tech-radar/note_vault_private.pem）。
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, "..", "..");
export const noteDir = path.join(rootDir, "note_drafts");
export const publicKeyFile = path.join(rootDir, "keys", "note_vault_public.pem");
export const ownerDir = path.join(os.homedir(), ".auto-tech-radar");
export const privateKeyFile = process.env.NOTE_VAULT_PRIVATE_KEY_FILE || path.join(ownerDir, "note_vault_private.pem");
export const openedDir = path.join(ownerDir, "note_full");

const PAYWALL_MARKERS = ["【有料ライン", "有料会員限定", "ここから先は有料"];
// 有料ライン以降でも、出品時に必要な案内・ハッシュタグは有料コンテンツではないので公開側に残す
const TAIL_RE = /^(### 🎁 【メンバーシップのご案内】|\*\*【note出品時用 推奨ハッシュタグ】\*\*)/;
export const SEALED_PLACEHOLDER_RE = /^<!-- PAID_SEALED: (\S+) .*-->$/m;

export function sealedFileFor(noteFile) {
  return noteFile.replace(/\.md$/, ".paid.enc");
}

function placeholderFor(noteFile) {
  return `<!-- PAID_SEALED: ${path.basename(sealedFileFor(noteFile))} 有料エリアは暗号化保存されています（復号はオーナー端末のみ: npm run vault:open） -->`;
}

export function isSealed(content) {
  return SEALED_PLACEHOLDER_RE.test(content);
}

// 原稿を「公開してよい部分」と「有料部分」に分ける。有料ラインが無ければ null。
export function splitPaid(content) {
  const lines = content.split("\n");
  const m = lines.findIndex((l) => PAYWALL_MARKERS.some((mk) => l.includes(mk)));
  if (m === -1) return null;
  let t = lines.findIndex((l, i) => i > m && TAIL_RE.test(l));
  if (t === -1) t = lines.length;
  else if (t - 1 > m && lines[t - 1].trim() === "---") t -= 1;
  return { head: lines.slice(0, m + 1), paid: lines.slice(m + 1, t), tail: lines.slice(t) };
}

function keyId(publicKeyPem) {
  return crypto.createHash("sha256").update(publicKeyPem.trim()).digest("hex").slice(0, 16);
}

export function encryptText(plaintext, publicKeyPem) {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const ek = crypto.publicEncrypt({ key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey);
  return JSON.stringify({
    v: 1,
    alg: "RSA-OAEP-256+A256GCM",
    kid: keyId(publicKeyPem),
    ek: ek.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  }, null, 2) + "\n";
}

export function decryptText(sealedJson, privateKeyPem) {
  const s = JSON.parse(sealedJson);
  if (s.v !== 1 || s.alg !== "RSA-OAEP-256+A256GCM") throw new Error(`未対応の暗号化形式です: ${s.alg}`);
  const dataKey = crypto.privateDecrypt({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(s.ek, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, Buffer.from(s.iv, "base64"));
  decipher.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(s.ct, "base64")), decipher.final()]).toString("utf8");
}

// 暗号化ファイルとして形式が正しいか（復号はしない）
export function isWellFormedSealed(sealedJson) {
  try {
    const s = JSON.parse(sealedJson);
    return s.v === 1 && s.alg === "RSA-OAEP-256+A256GCM" && ["kid", "ek", "iv", "tag", "ct"].every((k) => typeof s[k] === "string" && s[k].length > 0);
  } catch (e) {
    return false;
  }
}

export function loadPublicKey() {
  if (!fs.existsSync(publicKeyFile)) throw new Error(`公開鍵がありません: ${publicKeyFile}`);
  return fs.readFileSync(publicKeyFile, "utf8");
}

export function loadPrivateKey() {
  if (!fs.existsSync(privateKeyFile)) {
    throw new Error(`有料原稿の復号鍵が見つかりません: ${privateKeyFile}\n  オーナー端末にのみ置く秘密鍵です（リポジトリには入れないでください）。`);
  }
  return fs.readFileSync(privateKeyFile, "utf8");
}

// 有料原稿テキストを公開用 .md と暗号化 .paid.enc に分けて書き出す。平文の有料部分はディスクに書かない。
export function writeSealedNote(noteFile, fullContent, publicKeyPem = loadPublicKey()) {
  const parts = splitPaid(fullContent);
  if (!parts) {
    // 有料ラインの無い原稿（無料リードマグネット等）はそのまま公開
    fs.writeFileSync(noteFile, fullContent, "utf8");
    return { sealed: false };
  }
  const publicText = [...parts.head, placeholderFor(noteFile), ...parts.tail].join("\n");
  fs.writeFileSync(sealedFileFor(noteFile), encryptText(parts.paid.join("\n"), publicKeyPem), "utf8");
  fs.writeFileSync(noteFile, publicText, "utf8");
  return { sealed: true };
}

// 公開用 .md と .paid.enc から出品用の完全な原稿を組み立てる
export function assembleNote(noteFile, privateKeyPem = loadPrivateKey()) {
  const publicText = fs.readFileSync(noteFile, "utf8");
  if (!isSealed(publicText)) return publicText;
  const paid = decryptText(fs.readFileSync(sealedFileFor(noteFile), "utf8"), privateKeyPem);
  return publicText.split("\n").map((l) => (SEALED_PLACEHOLDER_RE.test(l) ? paid : l)).join("\n");
}

// 出品用の完全版をリポジトリ外 (~/.auto-tech-radar/note_full/) に書き出し、そのパスを返す
export function openNoteForPublishing(noteFile) {
  const publicText = fs.readFileSync(noteFile, "utf8");
  if (!isSealed(publicText)) return noteFile;
  fs.mkdirSync(openedDir, { recursive: true });
  const out = path.join(openedDir, path.basename(noteFile));
  fs.writeFileSync(out, assembleNote(noteFile), "utf8");
  return out;
}
