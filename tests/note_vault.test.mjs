// 有料原稿の暗号化保管庫: 公開側に有料本文が残らないこと・正しく復元できること・すり替えや鍵違いを検出できること
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
  splitPaid, writeSealedNote, assembleNote, noteDraftProblems, withStandardFooter, isSealed,
  sealedFileFor, decryptText, encryptText, keyId,
} from "../scripts/utils/note_vault.mjs";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const PAID = "## 有料の中身\n" + "SECRET_PAID_BODY ".repeat(120);
const draft = (eol = "\n") => [
  "# タイトル", "無料の導入。経費精算にも使えます。", "---",
  "【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】", "---", PAID,
  "---", "### 🎁 【メンバーシップのご案内】", "案内", "---", "**【note出品時用 推奨ハッシュタグ】**", "#AI #OSS",
].join(eol);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));

test("公開側の .md に有料本文が残らず、秘密鍵で完全に復元できる", () => {
  for (const eol of ["\n", "\r\n"]) {
    const dir = tmp();
    const f = path.join(dir, "demo_note.md");
    const full = draft(eol);
    writeSealedNote(f, full, publicKey);
    const pub = fs.readFileSync(f, "utf8");
    assert.ok(isSealed(pub));
    assert.ok(!pub.includes("SECRET_PAID_BODY"), "公開側に有料本文が残っている");
    assert.ok(!fs.readFileSync(sealedFileFor(f), "utf8").includes("SECRET_PAID_BODY"), "暗号化ファイルが平文");
    assert.match(pub, /#AI #OSS/, "出品用ハッシュタグは公開側に残す");
    assert.equal(assembleNote(f, [privateKey]), full, `復元結果が元と一致しない (eol=${JSON.stringify(eol)})`);
  }
});

test("別記事の暗号化ファイルとのすり替えを検出する", () => {
  const sealed = encryptText("x", publicKey, "a_note.md");
  assert.throws(() => decryptText(sealed, [privateKey], "b_note.md"), /対象が一致しません/);
});

test("鍵が違う場合は分かるメッセージで失敗する", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
  const sealed = encryptText("x", publicKey, "a_note.md");
  assert.throws(() => decryptText(sealed, [other.privateKey], "a_note.md"), /復号できる秘密鍵がありません/);
});

test("生成物の末尾が崩れていたら検出し、標準の末尾で補える", () => {
  const broken = draft().split("\n---\n### 🎁")[0];
  assert.ok(noteDraftProblems(broken).some((p) => /末尾|ハッシュタグ/.test(p)));
  assert.deepEqual(noteDraftProblems(withStandardFooter(broken)), []);
  assert.ok(noteDraftProblems(draft().replace(PAID, "短い")).some((p) => /短すぎ/.test(p)));
  assert.equal(splitPaid("有料ラインの無い原稿"), null);
});

test("公開鍵が CRLF 改行（Windows git checkout）でも同じ keyId になり復号できる", () => {
  const crlfPub = publicKey.replace(/\r?\n/g, "\r\n");
  assert.equal(keyId(crlfPub), keyId(publicKey));
  const sealed = encryptText("secret", crlfPub, "a_note.md");
  assert.equal(decryptText(sealed, [privateKey], "a_note.md"), "secret");
});

