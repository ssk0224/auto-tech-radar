// note 有料原稿の暗号化保管庫
// 公開リポジトリには「無料部分 + 有料ライン + 暗号化済みの有料部分」だけを置く。
// 暗号化は公開鍵 (keys/note_vault_public.pem) だけで行えるため、CI に秘密情報は不要。
// 復号できるのは秘密鍵を持つオーナー端末のみ（既定: ~/.auto-tech-radar/note_vault_private.pem）。
import crypto from "crypto";
import fs from "fs";
import { ownerDir } from "./owner_dir.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const rootDir = path.resolve(__dirname, "..", "..");
export const noteDir = path.join(rootDir, "note_drafts");
export const publicKeyFile = path.join(rootDir, "keys", "note_vault_public.pem");
export { ownerDir };
export const privateKeyFile = process.env.NOTE_VAULT_PRIVATE_KEY_FILE || path.join(ownerDir, "note_vault_private.pem");
export const openedDir = path.join(ownerDir, "note_full");

const ALG = "RSA-OAEP-256+A256GCM";
const PAYWALL_MARKERS = ["【有料ライン", "有料会員限定", "ここから先は有料"];
// 有料ライン以降でも、出品時に必要な案内・ハッシュタグは有料コンテンツではないので公開側に残す
const TAIL_RE = /^(### 🎁 【メンバーシップのご案内】|\*\*【note出品時用 推奨ハッシュタグ】\*\*)/;
// 末尾フッター（公開されたまま暗号化されない部分）は、行の種類ではなく形全体で決める（leakhunt #81・C4、2026-10-22）:
// 区切り線・メンバーシップの見出し・標準の案内文（STANDARD_FOOTER と同じ文）・空行・区切り線・ハッシュタグの見出し・タグ 1 行、の並びだけ。
// 行ごとの形（「# で始まる短い語」など）で許すと、その形をした有料本文（#受託単価は人日8万円）が公開側に残る。
// タグの行の中身は生成スクリプトが GitHub の言語・トピックから作り、tests/readme_grounding.test.mjs が記事ごとに作り直して一致を確かめる
const HASHTAG_HEADING_RE = /^\*\*【note出品時用 推奨ハッシュタグ】\*\*(（出品時にタグ欄へ貼り付けてください）)?$/;
const TAG_LINE_RE = /^#[^\s#]+(?: #[^\s#]+)*$/;
export function isFooterOnly(lines) {
  const ls = lines.map((l) => l.replace(/\r$/, ""));
  while (ls.length && !ls.at(-1).trim()) ls.pop();
  while (ls.length && (!ls[0].trim() || /^-{3,}$/.test(ls[0]))) ls.shift();
  const std = STANDARD_FOOTER.trim().split("\n");
  return ls.length === 6 && ls[0] === std[1] && ls[1] === std[2] && !ls[2].trim() && /^-{3,}$/.test(ls[3]) && HASHTAG_HEADING_RE.test(ls[4]) && TAG_LINE_RE.test(ls[5]);
}
export const SEALED_PLACEHOLDER_RE = /^<!-- PAID_SEALED: (\S+) .*-->\r?$/m;
export const MIN_PAID_CHARS = 1500;
const OPENED_TTL_MS = 24 * 60 * 60 * 1000;

// 生成物の末尾が崩れていた場合に補う標準の末尾（有料コンテンツではない）。
// 生成スクリプトはハッシュタグ行を記事ごとのタグ（utils/note_hashtags.mjs）に置き換える
export const STANDARD_FOOTER = `
---
### 🎁 【メンバーシップのご案内】
Auto Tech Radar noteメンバーシップ（月額1,980円）では、メンバーシップ特典に追加した有料記事を読むことができます。日々の技術キャッチアップや新規事業のネタ帳としてぜひご活用ください。

---
**【note出品時用 推奨ハッシュタグ】**（出品時にタグ欄へ貼り付けてください）
#AI #OSS #エンジニア #プログラミング #スタートアップ #最新技術 #GitHub`;

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
  // フッターは原稿の末尾（通常最後の35行以内）に配置されるため末尾領域から探索
  // これにより有料本文内の途中見出しをフッターと誤認せず、かつフッター冒頭（メンバーシップ案内等）を正確に捉える
  // 末尾のフッター: 末尾35行の中で、そこから最後までがフッター行だけになる最初の見出し位置。
  // フッター見出しの後に有料本文が続いている（フッター以外の行がある）ものは公開せず有料側に入れる
  let t = -1;
  const searchStart = Math.max(m + 1, lines.length - 35);
  for (let i = searchStart; i < lines.length; i++) {
    if (TAIL_RE.test(lines[i]) && isFooterOnly(lines.slice(i))) {
      t = i;
      break;
    }
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
// 有料部分の節の題から「有料版に何が入っているか」を判定する。本文は含めない。
// Web 記事の購入案内に、その記事の有料版に実際にある項目だけを表示するために使う
// 有料部分の節の題は見出しを使わず太字の行で書く（note.com の目次に有料部分の見出しが出るため）。古い原稿の見出しも節の題として読む。
// 有料版の売りは README から作り直せないもの（提案書・見積・活用の考え方・想定問答）だけにする。
// 導入手順は無料の Web 記事に README から転記しているので、有料の売りにしない（leakhunt C4、2026-10-22）
export const PAID_FEATURE_RULES = [
  [/提案書/, "導入提案書テンプレート（Markdown）"],
  [/見積/, "工数・見積表"],
  [/マネタイズ|活用|収益化/, "活用・収益化の考え方"],
  [/想定問答|Q&A/, "導入時の想定問答"],
];
export function paidContentSummary(paidText) {
  const labels = paidText.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^#{2,3} /.test(l) || /^\*\*[^*].*\*\*$/.test(l));
  const features = PAID_FEATURE_RULES.filter(([re]) => labels.some((l) => re.test(l))).map(([, label]) => label);
  return { chars: [...paidText.replace(/\s/g, "")].length, features };
}
export const summaryFileFor = (noteFile) => noteFile.replace(/\.md$/, ".paid.json");

// 公開リポジトリに置く note 原稿（無料部分 + 暗号化プレースホルダ + 末尾）の本文。有料ラインが無ければ原稿そのまま
export function publicNoteText(noteFile, fullContent) {
  const parts = splitPaid(fullContent);
  return parts ? [...parts.head, placeholderFor(noteFile), ...parts.tail].join("\n") : fullContent;
}

// 公開側の原稿の最小の長さ（品質ゲート scripts/audit_quality.mjs と生成スクリプトで共通。これより短い原稿は壊れているとみなす）
export const MIN_PUBLIC_NOTE_CHARS = 500;
// 生成スクリプトが保存前に確かめる: 保存される公開側の原稿が品質ゲートの最小の長さを満たすか
export function publicNoteProblems(noteFile, fullContent) {
  const n = publicNoteText(noteFile, fullContent).length;
  return n < MIN_PUBLIC_NOTE_CHARS ? [`公開部分が短すぎます（${n}文字、${MIN_PUBLIC_NOTE_CHARS}文字以上が必要）`] : [];
}

export function writeSealedNote(noteFile, fullContent, publicKeyPem = loadPublicKey()) {
  const parts = splitPaid(fullContent);
  if (!parts) {
    // 有料ラインの無い原稿（無料リードマグネット等）はそのまま公開
    fs.writeFileSync(noteFile, fullContent, "utf8");
    return { sealed: false };
  }
  const publicText = publicNoteText(noteFile, fullContent);
  const aad = path.basename(noteFile);
  // 暗号化は元の原稿をそのまま復元できる形で行う（有料部分の見出しを太字の行にするのは、生成スクリプトと reseal --all の側）
  const paid = parts.paid.join("\n");
  fs.writeFileSync(sealedFileFor(noteFile), encryptText(paid, publicKeyPem, aad), "utf8");
  fs.writeFileSync(summaryFileFor(noteFile), JSON.stringify(paidContentSummary(paid), null, 2) + "\n", "utf8");
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
// 出品用に書き出した完全版（平文の有料本文）のうち古いものを削除する。maxAgeMs=0 なら全部消す
export function purgeOpenedNotes(maxAgeMs = OPENED_TTL_MS) {
  if (!fs.existsSync(openedDir)) return 0;
  const now = Date.now();
  let n = 0;
  for (const f of fs.readdirSync(openedDir)) {
    const p = path.join(openedDir, f);
    try {
      if (now - fs.statSync(p).mtimeMs >= maxAgeMs) {
        fs.unlinkSync(p);
        n++;
      }
    } catch (e) {}
  }
  return n;
}

export function openNoteForPublishing(noteFile) {
  const publicText = fs.readFileSync(noteFile, "utf8");
  if (!isSealed(publicText)) return noteFile;
  fs.mkdirSync(openedDir, { recursive: true, mode: 0o700 });
  purgeOpenedNotes();
  const out = path.join(openedDir, path.basename(noteFile));
  // 本人以外が読めない権限で書く（Windows では無視される）
  fs.writeFileSync(out, assembleNote(noteFile), { encoding: "utf8", mode: 0o600 });
  return out;
}
