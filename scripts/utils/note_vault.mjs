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

const ALG = "RSA-OAEP-256+A256GCM";
const PAYWALL_MARKERS = ["【有料ライン", "有料会員限定", "ここから先は有料"];
// 有料ライン以降でも、出品時に必要な案内・ハッシュタグは有料コンテンツではないので公開側に残す
const TAIL_RE = /^(### 🎁 【メンバーシップのご案内】|\*\*【note出品時用 推奨ハッシュタグ】\*\*)/;
export const SEALED_PLACEHOLDER_RE = /^<!-- PAID_SEALED: (\S+) .*-->\r?$/m;
export const MIN_PAID_CHARS = 1500;
const OPENED_TTL_MS = 24 * 60 * 60 * 1000;

// 生成物の末尾が崩れていた場合に補う標準の末尾（有料コンテンツではない）
export const STANDARD_FOOTER = `
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #副業 #受託開発 #スタートアップ #最新技術 #GitHub`;

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
  // フッターは原稿の末尾（通常は最後の30行以内）に配置されるため末尾優先で探索
  let t = -1;
  const searchStart = Math.max(m + 1, lines.length - 30);
  for (let i = searchStart; i < lines.length; i++) {
    if (TAIL_RE.test(lines[i])) {
      t = i;
      break;
    }
  }
  if (t === -1) {
    t = lines.findIndex((l, i) => i > m && TAIL_RE.test(l));
  }
  const hasTail = t !== -1;
  if (!hasTail) t = lines.length;
  else if (t - 1 > m && lines[t - 1].trim() === "---") t -= 1;
  return { head: lines.slice(0, m + 1), paid: lines.slice(m + 1, t), tail: lines.slice(t), hasTail };
}

// 公開側（無料部分 + 末尾）が出品・監査の要件を満たすか。満たさない理由の配列を返す
export function noteDraftProblems(fullContent) {
  const parts = splitPaid(fullContent);
  if (!parts) return ["有料ラインがありません"];
  const problems = [];
  const head = parts.head.join("\n");
  const publicText = [...parts.head, ...parts.tail].join("\n");
  if (!parts.hasTail) problems.push("末尾の案内・ハッシュタグがありません");
  if (!/#AI|#OSS/.test(publicText)) problems.push("推奨ハッシュタグが公開側にありません");
  if (!/経費|領収書/.test(publicText)) problems.push("経費精算の案内が公開側にありません");
  if (/mcpServers|docker-compose|■ 案件名:/.test(head)) problems.push("有料ラインより前に有料キットが含まれています");
  const tail = parts.tail.join("\n");
  if (/mcpServers|docker-compose|■ 案件名:|【SaaS構成手順|自社SaaS構築手順/.test(tail)) problems.push("末尾フッターに有料本文が混入しています");
  if (parts.paid.join("\n").trim().length < MIN_PAID_CHARS) problems.push(`有料部分が短すぎます（${MIN_PAID_CHARS}文字未満）`);
  return problems;
}

// 末尾が崩れている生成物に標準の末尾を補う
export function withStandardFooter(fullContent) {
  const parts = splitPaid(fullContent);
  if (!parts || parts.hasTail) return fullContent;
  return fullContent.trimEnd() + "\n" + STANDARD_FOOTER + "\n";
}

export function keyId(publicKeyPem) {
  return crypto.createHash("sha256").update(publicKeyPem.replace(/\r\n/g, "\n").trim()).digest("hex").slice(0, 16);
}

function keyIdOfPrivate(privateKeyPem) {
  return keyId(crypto.createPublicKey(privateKeyPem).export({ type: "spki", format: "pem" }));
}

// aad: 暗号文を原稿ファイル名に結び付け、別記事の .paid.enc とのすり替えを検出する
export function encryptText(plaintext, publicKeyPem, aad) {
  const dataKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const ek = crypto.publicEncrypt({ key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, dataKey);
  return JSON.stringify({
    v: 2,
    alg: ALG,
    kid: keyId(publicKeyPem),
    aad,
    ek: ek.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  }, null, 2) + "\n";
}

export function decryptText(sealedJson, privateKeyPems, expectedAad) {
  const s = JSON.parse(sealedJson);
  if (![1, 2].includes(s.v) || s.alg !== ALG) throw new Error(`未対応の暗号化形式です: ${s.alg}`);
  if (s.v === 2 && s.aad !== expectedAad) throw new Error(`暗号化ファイルの対象が一致しません（${s.aad} ≠ ${expectedAad}）`);
  const keys = Array.isArray(privateKeyPems) ? privateKeyPems : [privateKeyPems];
  const key = keys.find((k) => keyIdOfPrivate(k) === s.kid);
  if (!key) throw new Error(`この暗号化ファイル（鍵ID ${s.kid}）を復号できる秘密鍵がありません。鍵を作り直した場合は古い秘密鍵を ${ownerDir} に残してください。`);
  const dataKey = crypto.privateDecrypt({ key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(s.ek, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey, Buffer.from(s.iv, "base64"));
  if (s.v === 2) decipher.setAAD(Buffer.from(s.aad, "utf8"));
  decipher.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(s.ct, "base64")), decipher.final()]).toString("utf8");
}

// 暗号化ファイルとして形式が正しいか（復号はしない）
export function sealedInfo(sealedJson) {
  try {
    const s = JSON.parse(sealedJson);
    const ok = [1, 2].includes(s.v) && s.alg === ALG && ["kid", "ek", "iv", "tag", "ct"].every((k) => typeof s[k] === "string" && s[k].length > 0);
    return ok ? s : null;
  } catch (e) {
    return null;
  }
}

export function loadPublicKey() {
  if (!fs.existsSync(publicKeyFile)) throw new Error(`公開鍵がありません: ${publicKeyFile}`);
  return fs.readFileSync(publicKeyFile, "utf8");
}

// 現在の秘密鍵に加え、作り直し前後の鍵（.old-* / .new）も復号候補にする
export function loadPrivateKeys() {
  const dir = path.dirname(privateKeyFile);
  const base = path.basename(privateKeyFile);
  const files = [privateKeyFile];
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).filter((f) => f.startsWith(`${base}.old-`) || f === `${base}.new`).forEach((f) => files.push(path.join(dir, f)));
  }
  const keys = files.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8"));
  if (keys.length === 0) {
    throw new Error(`有料原稿の復号鍵が見つかりません: ${privateKeyFile}\n  オーナー端末にのみ置く秘密鍵です（リポジトリには入れないでください）。`);
  }
  return keys;
}

// 有料原稿テキストを公開用 .md と暗号化 .paid.enc に分けて書き出す。平文の有料部分はディスクに書かない。
// 有料部分の見出し（##）から「有料版に何が入っているか」を判定する。本文は含めない。
// Web 記事の購入案内に、その記事の有料版に実際にある項目だけを表示するために使う
const PAID_FEATURES = [
  [/提案書/, "導入提案書テンプレート（Markdown）"],
  [/見積/, "工数・見積表"],
  [/Docker|導入手順|インストール|セットアップ|起動|カスタマイズ|実装の勘所|設定/, "導入手順"],
  [/マネタイズ|活用/, "活用・収益化の考え方"],
  [/想定問答|Q&A/, "導入時の想定問答"],
];
export function paidContentSummary(paidText) {
  const h2 = paidText.split(/\r?\n/).filter((l) => /^#{2,3} /.test(l));
  const features = [];
  for (const [re, label] of PAID_FEATURES) {
    const hit = h2.filter((l) => re.test(l));
    if (hit.length === 0) continue;
    features.push(label === "導入手順" && hit.some((l) => /未検証|公式未提供/.test(l)) ? "導入手順（公式未提供・動作未検証の例を含む）" : label);
  }
  return { chars: [...paidText.replace(/\s/g, "")].length, features };
}
export const summaryFileFor = (noteFile) => noteFile.replace(/\.md$/, ".paid.json");

export function writeSealedNote(noteFile, fullContent, publicKeyPem = loadPublicKey()) {
  const parts = splitPaid(fullContent);
  if (!parts) {
    // 有料ラインの無い原稿（無料リードマグネット等）はそのまま公開
    fs.writeFileSync(noteFile, fullContent, "utf8");
    return { sealed: false };
  }
  const publicText = [...parts.head, placeholderFor(noteFile), ...parts.tail].join("\n");
  const aad = path.basename(noteFile);
  fs.writeFileSync(sealedFileFor(noteFile), encryptText(parts.paid.join("\n"), publicKeyPem, aad), "utf8");
  fs.writeFileSync(summaryFileFor(noteFile), JSON.stringify(paidContentSummary(parts.paid.join("\n")), null, 2) + "\n", "utf8");
  fs.writeFileSync(noteFile, publicText, "utf8");
  return { sealed: true };
}

// 公開用 .md と .paid.enc から出品用の完全な原稿を組み立てる
export function assembleNote(noteFile, privateKeyPems = loadPrivateKeys()) {
  const publicText = fs.readFileSync(noteFile, "utf8");
  if (!isSealed(publicText)) return publicText;
  const paid = decryptText(fs.readFileSync(sealedFileFor(noteFile), "utf8"), privateKeyPems, path.basename(noteFile));
  return publicText.split("\n").map((l) => (SEALED_PLACEHOLDER_RE.test(l) ? paid : l)).join("\n");
}

// 出品用の完全版をリポジトリ外 (~/.auto-tech-radar/note_full/) に書き出し、そのパスを返す。
// 平文を端末に残し続けないよう、24時間より古い完全版はここで削除する。
export function openNoteForPublishing(noteFile) {
  const publicText = fs.readFileSync(noteFile, "utf8");
  if (!isSealed(publicText)) return noteFile;
  fs.mkdirSync(openedDir, { recursive: true });
  const now = Date.now();
  for (const f of fs.readdirSync(openedDir)) {
    const p = path.join(openedDir, f);
    try {
      if (now - fs.statSync(p).mtimeMs > OPENED_TTL_MS) fs.unlinkSync(p);
    } catch (e) {}
  }
  const out = path.join(openedDir, path.basename(noteFile));
  fs.writeFileSync(out, assembleNote(noteFile), "utf8");
  return out;
}
