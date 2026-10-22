// 有料本文の検査（秘密鍵のある owner PC でしか中身を見られない部分）を、合成した原稿で CI でも検査する。
// 検査の定義は scripts/utils/owner_checks.mjs の 1 か所だけにあり、テスト・出品（openNoteForPublishing）・API 同期・生成が同じ関数を使う
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { writeSealedNote, paidContentSummary, splitPaid, summaryFileFor } from "../scripts/utils/note_vault.mjs";
import { paidNoteProblems, ownerCheckReport, openNoteForPublishing, privateKeysIfPresent } from "../scripts/utils/owner_checks.mjs";

const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "owner-checks-"));

const FILLER = "このリポジトリの構成と使いどころを、公式 README の記載に沿って説明します。".repeat(8);
const PAID_BODY = [
  "## 📋 社内DX・AI導入提案書 Markdown完全版",
  FILLER,
  "## 💰 詳細工数・見積シミュレーション表",
  "| 工程 | 作業内容 | 工数（人日） | 単価 | 小計 |",
  "|---|---|---|---|---|",
  "| 要件定義 | 現状業務の整理 | 5 | 5万円 | 25万円 |",
  "| 合計 | | | | 120万円 |",
  FILLER,
  "## 🛠️ 公式READMEに基づく導入手順",
  FILLER,
  "## ❓ 導入検討で出る懸念への想定問答",
  FILLER,
].join("\n");
const note = (paid = PAID_BODY, teaser = ["- そのまま出せる「提案書 Markdown完全版」", "- 「詳細工数・見積シミュレーション表」", "- 公式READMEに基づく「導入手順」", "- 懸念への「想定問答集」"]) =>
  [
    "# 【最新OSS解体新書】合成テスト用の記事タイトル",
    "",
    "## はじめに",
    FILLER,
    "",
    "### 🔒 有料エリアで完全公開する実践ナレッジ",
    ...teaser,
    "",
    "> noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。",
    "",
    "---",
    "【有料ライン（推奨販売価格: 980円 / 月額1,980円メンバーシップ特典）ここから先は有料会員限定】",
    "---",
    paid,
    "",
    "---",
    "### 🎁 【メンバーシップのご案内】",
    "Auto Tech Radar noteメンバーシップでは、メンバーシップ特典に追加した有料記事を読むことができます。",
    "",
    "---",
    "**【note出品時用 推奨ハッシュタグ】**",
    "#AI #OSS",
  ].join("\n");
const withPaid = (extra) => note(`${PAID_BODY}\n${extra}`);

test("合成した正常な有料原稿は検査を通る（基準）", () => {
  assert.deepEqual(paidNoteProblems(note()), []);
});

test("有料本文の禁止表現: テスト専用だった一覧・生成時の一覧・誇張表現のどれに当たっても検出する", () => {
  for (const phrase of ["これは顧客満足度に直結します。", "想定案件単価は応相談です。", "その驚異的な速度を体感してください。", "クライアントを即決させる一言。"]) {
    assert.ok(paidNoteProblems(withPaid(phrase)).length > 0, phrase);
  }
});

test("有料本文の禁止表現: 全角・空白・ゼロ幅文字・強調記法で書き方を変えても検出する", () => {
  for (const phrase of ["即　受注", "**即**受注", "受注に​直結", "１００％ 経費精算可能", "完全　保存版"]) {
    assert.ok(paidNoteProblems(withPaid(phrase)).length > 0, JSON.stringify(phrase));
  }
});

test("有料本文の検査結果に本文の文字列を含めない（ログ・CI の出力に有料本文を出さない）", () => {
  const secret = "顧客満足度に直結します";
  const problems = paidNoteProblems(withPaid(`ひみつの文 ${secret}`));
  assert.ok(problems.length > 0);
  for (const p of problems) assert.ok(!p.includes("直結") && !p.includes("ひみつ"), p);
});

test("有料本文の金額: 積算根拠表（工程・工数・単価・小計）が無ければ、どの金額でも検出する", () => {
  const noTable = PAID_BODY.split("\n").filter((l) => !l.startsWith("|")).join("\n");
  for (const amount of ["概算 120万円", "95万〜140万円", "２００万円"]) {
    assert.ok(paidNoteProblems(note(`${noTable}\n${amount}`)).some((p) => /積算根拠/.test(p)), amount);
  }
  assert.ok(!paidNoteProblems(note(`${PAID_BODY}\n概算 120万円`)).some((p) => /積算根拠/.test(p)), "根拠表があれば通す");
});

test("無料部分の予告: 有料エリアにあると予告した項目が有料本文に無ければ検出する", () => {
  const noQa = PAID_BODY.replace("## ❓ 導入検討で出る懸念への想定問答", "## まとめ");
  assert.ok(paidNoteProblems(note(noQa)).some((p) => /予告/.test(p)));
});

test("公開中の有料版の内容一覧（.paid.json）が有料本文と食い違えば検出する", () => {
  const full = note();
  const summary = paidContentSummary(splitPaid(full).paid.join("\n"));
  assert.deepEqual(paidNoteProblems(full, { summary }), []);
  assert.ok(paidNoteProblems(full, { summary: { ...summary, features: [...summary.features, "架空の特典"] } }).some((p) => /paid\.json/.test(p)));
});

test("note 用 HTML に変換できない原稿（有料境界・表・バッククォート）を検出する", () => {
  assert.ok(paidNoteProblems(withPaid("閉じていない ` が残る原稿")).some((p) => /バッククォート/.test(p)));
  assert.ok(paidNoteProblems(note().replace(/^【有料ライン.*$/m, "")).length > 0, "有料ラインが無い");
});

const sealedDir = (paidExtra = "") => {
  const dir = tmp();
  const f = path.join(dir, "demo_note.md");
  writeSealedNote(f, withPaid(paidExtra), publicKey);
  return { dir, f };
};

test("owner 検査: 全原稿が通れば green、1 本でも違反があれば red（件数と記事名・規則名だけを返す）", () => {
  const ok = sealedDir();
  const green = ownerCheckReport({ dir: ok.dir, keys: [privateKey] });
  assert.equal(green.status, "green");
  assert.equal(green.checked, 1);
  const bad = sealedDir("顧客満足度に直結します");
  const red = ownerCheckReport({ dir: bad.dir, keys: [privateKey] });
  assert.equal(red.status, "red");
  assert.deepEqual(red.failed.map((x) => x.file), ["demo_note.md"]);
  assert.ok(!JSON.stringify(red).includes("直結"), "報告に有料本文を含めない");
});

test("owner 検査: 公開中の内容一覧（.paid.json）が書き換えられていれば red", () => {
  const { dir, f } = sealedDir();
  fs.writeFileSync(summaryFileFor(f), JSON.stringify({ chars: 1, features: [] }));
  assert.equal(ownerCheckReport({ dir, keys: [privateKey] }).status, "red");
});

test("owner 検査: 秘密鍵が無ければ green ではなく skipped（出品側はこれも拒否する）", () => {
  const { dir } = sealedDir();
  const r = ownerCheckReport({ dir, keys: [] });
  assert.equal(r.status, "skipped");
});

test("秘密鍵の読み込み: 鍵ファイルが無いときだけ空、ある鍵が読めないときは握りつぶさず失敗する", () => {
  const dir = tmp();
  assert.deepEqual(privateKeysIfPresent(path.join(dir, "none.pem")), []);
  fs.mkdirSync(path.join(dir, "dir.pem"));
  assert.throws(() => privateKeysIfPresent(path.join(dir, "dir.pem")));
});

test("出品用に開く: 検査が red / skipped なら完全版を書き出さずに拒否し、green なら書き出す", () => {
  const out = tmp();
  const bad = sealedDir("**即**　受注");
  assert.throws(() => openNoteForPublishing(bad.f, { keys: [privateKey], outDir: out }), /出品を止めました/);
  assert.throws(() => openNoteForPublishing(bad.f, { keys: [], outDir: out }), /出品を止めました/);
  assert.deepEqual(fs.readdirSync(out), [], "拒否したときは平文を書き出さない");
  const ok = sealedDir();
  const p = openNoteForPublishing(ok.f, { keys: [privateKey], outDir: out });
  assert.equal(fs.readFileSync(p, "utf8"), withPaid(""));
});

test("note API 同期（公開中の記事の更新・新規作成）も、検査が green でなければ本文を作らずに止める", async () => {
  const { buildFullSyncTasks } = await import("../scripts/note_api_server.mjs");
  const bad = sealedDir("その驚異的な速度");
  assert.throws(() => buildFullSyncTasks({ dir: bad.dir, keys: [privateKey] }), /出品を止めました/);
  assert.throws(() => buildFullSyncTasks({ dir: bad.dir, keys: [] }), /出品を止めました/);
  const ok = sealedDir();
  const tasks = buildFullSyncTasks({ dir: ok.dir, keys: [privateKey] });
  assert.deepEqual(tasks.creates.map((c) => c.slug), ["demo"]);
});

test("note 用 HTML の検査（tests/note_html から移した 9 項目）は、それぞれの崩れを検出する", () => {
  const cases = [
    [note().replace(/^# .*$/m, "# 短い題"), /タイトル形式/],
    [withPaid("説明の途中に |---| が残る行"), /区切り線/],
    [withPaid("閉じていない ![図](壊れたリンク の行"), /画像記法/],
    [withPaid("graph TD の生の構文が段落に残る"), /Mermaid/],
    [withPaid("推奨ハッシュタグの注記が本文に残る"), /ハッシュタグ注記/],
  ];
  for (const [md, re] of cases) assert.ok(paidNoteProblems(md).some((p) => re.test(p)), String(re));
});
