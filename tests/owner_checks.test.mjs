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
import { paidHeadingsToBold } from "../scripts/utils/headings.mjs";
import { noteTitle } from "../scripts/utils/page_shape.mjs";
import { renderQuotes } from "../scripts/utils/anchored.mjs";

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

// ---- 2026-10-22: 書き方を変えた禁止表現・金額・予告のすり抜け（検証役が見つけたもの）を、読者に見える形で塞ぐ ----

test("有料本文の禁止表現: 改行・Markdown リンク・見えない文字・異体字セレクタ・漢数字・分数表記で書き方を変えても検出する", () => {
  const variants = [
    "この構成は受注に\n直結します。",
    "この構成は受注に[直結](https://example.com)します。",
    "世界‎最速の推論基盤です。",
    "驚️異的な性能です。",
    "お問い合わせには一営業日以内に返信します。",
    "運用コストを5分の1に削減できます。",
    "完全⁣保存版です。",
  ];
  for (const phrase of variants) {
    assert.ok(paidNoteProblems(withPaid(phrase)).some((p) => /禁止表現/.test(p)), JSON.stringify(phrase));
  }
});

test("有料本文の金額: 円の有無・桁区切り・漢数字・括弧書きに関係なく、根拠表が無ければ検出する", () => {
  const noTable = PAID_BODY.split("\n").filter((l) => !l.startsWith("|")).join("\n");
  assert.deepEqual(paidNoteProblems(note(noTable)), [], "金額も根拠表も無い原稿は通る（基準）");
  for (const amount of ["導入費用は80万程度です。", "導入費用は1,200,000円です。", "導入費用は百二十万円です。", "導入費用は120万（税別）です。"]) {
    assert.ok(paidNoteProblems(note(`${noTable}\n${amount}`)).some((p) => /積算根拠/.test(p)), amount);
  }
  assert.ok(!paidNoteProblems(note(`${noTable}\nGitHub のスターは 1.2万 スターを超えています。`)).some((p) => /積算根拠/.test(p)), "件数（スター数）は金額ではない");
});

test("無料部分の予告: どの分類にも当たらない予告・見出しを変えた予告・番号付きの予告も、有料本文に無ければ検出する", () => {
  const teaser = ["- そのまま出せる「提案書 Markdown完全版」", "- 「詳細工数・見積シミュレーション表」", "- 公式READMEに基づく「導入手順」", "- 懸念への「想定問答集」"];
  const cases = [
    ["FAQ を予告したが有料本文に無い", note(PAID_BODY.replace("## ❓ 導入検討で出る懸念への想定問答", "## まとめ"), [...teaser.slice(0, 3), "- 導入時によくある質問（FAQ）集"])],
    ["分類に無い予告", note(PAID_BODY, [...teaser, "- 本番運用前のセキュリティ点検チェックリスト"])],
    ["予告の見出しを変えた", note(PAID_BODY.replace("## ❓ 導入検討で出る懸念への想定問答", "## まとめ"), teaser).replace("### 🔒 有料エリアで完全公開する実践ナレッジ", "### このあと読める内容")],
    ["番号付きの予告", note(PAID_BODY, [...teaser.map((t, i) => t.replace(/^- /, `${i + 1}. `)), "5. 本番運用前のセキュリティ点検チェックリスト"])],
    ["＆ でつないだ予告の片方が無い", note(PAID_BODY, [...teaser, "- 「提案書 ＆ セキュリティ点検チェックリスト」"])],
  ];
  for (const [name, md] of cases) assert.ok(paidNoteProblems(md).some((p) => /予告/.test(p)), name);
});

test("有料本文の禁止表現: 書き方を揃えても、金額の後の「稼働」を収入の表現と取り違えない", () => {
  assert.deepEqual(paidNoteProblems(withPaid("- **エンタープライズ**: 月額298,000円（オンプレミス稼働用の構成）")), []);
});

test("無料部分の予告: 「」でくくった項目を「と」「、」でつないでも、1 つずつ有料本文と照合する", () => {
  const teaser = ["- 公式READMEに基づく「導入手順」", "- 懸念への「想定問答集」"];
  for (const joined of ["- 「提案書」と「障害対応ランブック」", "- 『工数見積表』、『障害対応ランブック』"]) {
    assert.ok(paidNoteProblems(note(PAID_BODY, [...teaser, joined])).some((p) => /照合できない/.test(p)), joined);
  }
});

test("無料部分の予告: コードブロックの中の「# 〜」（コメント）は有料本文の見出しとして数えない", () => {
  const noQa = PAID_BODY.replace("## ❓ 導入検討で出る懸念への想定問答", "## まとめ");
  assert.ok(paidNoteProblems(note(`${noQa}\n\`\`\`bash\n# 想定問答\necho ok\n\`\`\``)).some((p) => /想定問答/.test(p)));
});

test("無料部分の予告: 見出しは note で読者に見えるもの（コードブロックに飲み込まれていないもの）だけを数える", () => {
  const qa = "## ❓ 導入検討で出る懸念への想定問答";
  const swallowed = PAID_BODY.replace(qa, `\`\`\`\n閉じていないコードブロック\n${qa}`);
  assert.ok(paidNoteProblems(note(swallowed)).some((p) => /想定問答/.test(p)), "閉じ忘れたコードブロックに飲み込まれた見出し");
  const visible = PAID_BODY.replace(qa, `\`\`\`\n例: 中に言語つきの行がある\n\`\`\`yaml\n\`\`\`\n${qa}`);
  assert.ok(!paidNoteProblems(note(visible)).some((p) => /予告/.test(p)), "コードブロックの外にある見出し");
});

test("無料部分の予告: 有料版の内容一覧（PAID_FEATURES）が同じ分類とみなす見出し（カスタマイズ・実装の勘所など）は予告を満たす", () => {
  const custom = PAID_BODY.replace("## 🛠️ 公式READMEに基づく導入手順", "## 商用カスタマイズ・実装の勘所");
  assert.ok(!paidNoteProblems(note(custom)).some((p) => /予告/.test(p)));
});

test("無料部分の予告: 有料部分の節の題を太字の行で書いても（paidHeadingsToBold）予告を満たし、文中の太字は節の題として数えない", () => {
  const bold = paidHeadingsToBold(PAID_BODY);
  assert.notEqual(bold, PAID_BODY, "前提: 見出しが太字の行に変わる");
  assert.deepEqual(paidNoteProblems(note(bold)).filter((p) => /予告/.test(p)), []);
  const inline = PAID_BODY.split("\n").map((l) => (/^#{2,3} .*想定問答/.test(l) ? "本文中の **想定問答** という語" : l)).join("\n");
  assert.ok(paidNoteProblems(note(paidHeadingsToBold(inline))).some((p) => /想定問答/.test(p)), "文中の太字では予告を満たさない");
});

test("無料部分の予告: 記事の題（noteTitle の「記事名」｜有料版の一覧）は予告として読まない（一覧は .paid.json と同じ関数で作る）", () => {
  const titled = note().replace(/^# .*$/m, noteTitle("AIHOT", ["工数・見積表"]));
  assert.ok(titled.startsWith("# 「AIHOT」"), "前提: 題を差し替えた");
  assert.deepEqual(paidNoteProblems(titled).filter((p) => /予告/.test(p)), []);
});

test("無料部分の予告: 有料ラインの直前にある README の原文の箇条書き（renderQuotes）は予告として読まない（原文は README との照合で見る）", () => {
  const quotes = ["", "## 主な機能（README の原文）", "", renderQuotes(["It runs on Linux, macOS and Windows.", "testtool reads a YAML file."])];
  assert.deepEqual(paidNoteProblems(note(PAID_BODY, quotes)).filter((p) => /予告/.test(p)), []);
  const plain = ["", "## 主な機能", "", "- It runs on Linux, macOS and Windows."];
  assert.ok(paidNoteProblems(note(PAID_BODY, plain)).some((p) => /照合できない/.test(p)), "原文の印の無い箇条書きは今まで通り予告として照合する");
});

test("入れ子のつもりのコードブロック（外側と同じ長さの ``` の中に ```yaml などがある）は、note で以降が崩れるので検出する", () => {
  const broken = "```markdown\n# 提案書の雛形\n図の説明\n```\n## 4. 効果\n```\n\n## 追加の見出し\n```yaml\nkey: v\n```";
  assert.ok(paidNoteProblems(withPaid(broken)).some((p) => /入れ子/.test(p)), "閉じ方がずれて見出しがコードになる");
  const ok = "````markdown\n# 提案書の雛形\n```yaml\nkey: v\n```\n````";
  assert.ok(!paidNoteProblems(withPaid(ok)).some((p) => /入れ子/.test(p)), "外側を長くした正しい入れ子");
});

// ---- 2026-10-22 第 3 回: 検証役が示した残りのすり抜け（通貨・大字・同形異字・ルビ・ひらがな・表・予告の形） ----

test("有料本文の金額: 通貨記号・通貨コード・外貨名・大字・k/M 表記でも、根拠表が無ければ検出する", () => {
  const noTable = PAID_BODY.split("\n").filter((l) => !l.startsWith("|")).join("\n");
  const amounts = [
    "導入費用は USD 12,000 程度です。", "導入費用は 50,000 JPY です。", "導入費用は八拾万円です。", "導入費用は80萬円です。",
    "導入費用は0.8M円です。", "導入費用は €9,500 です。", "導入費用は9,500ユーロです。", "導入費用は 12k USD です。",
    "導入費用は £7,800 です。", "導入費用は 3.5千ドル です。", "導入費用は弐百萬円です。", "初期費用 EUR 4,200。",
  ];
  for (const amount of amounts) {
    assert.ok(paidNoteProblems(note(`${noTable}\n${amount}`)).some((p) => /積算根拠/.test(p)), amount);
  }
  assert.ok(!paidNoteProblems(note(`${noTable}\nAPI 利用料は 1 リクエスト $0.002 です。`)).some((p) => /積算根拠/.test(p)), "少額の従量課金は見積額ではない");
});

test("有料本文の禁止表現: 大字・同形異字（キリル文字など）・ルビ・ひらがな書き・表のセル分割・読点で書き方を変えても検出する", () => {
  const variants = [
    "お問い合わせには壱営業日以内に回答します。",
    "評価は ThоughtWorks の基準に沿っています。", // о はキリル文字
    "評価は Thοughtworks 流です。", // ο はギリシャ文字
    "世界<ruby>最<rt>さい</rt></ruby>速の推論基盤です。",
    "メンバーなら全編読みほうだいです。",
    "せかいさいそくの推論基盤です。",
    "| 効果 | 受注に | 直結します |",
    "この構成は受注に、直結します。",
    "世界<!--\n注記\n-->最速の推論基盤です。",
  ];
  for (const phrase of variants) {
    assert.ok(paidNoteProblems(withPaid(phrase)).some((p) => /禁止表現|文字体系/.test(p)), JSON.stringify(phrase));
  }
});

test("有料本文の禁止表現: ひらがな書きの照合は、短い読みで普通の文を取り違えない", () => {
  for (const ok of ["もうかなり前から使われています。", "おかげで設定が楽になります。", "β版の機能も試せます。"]) {
    assert.deepEqual(paidNoteProblems(withPaid(ok)), [], ok);
  }
});

test("無料部分の予告: 表の行・全角番号・丸数字・引用の中の箇条書き・「」の項目・続きを示す見出しの予告も照合する", () => {
  const teaser = ["- そのまま出せる「提案書 Markdown完全版」", "- 「詳細工数・見積シミュレーション表」", "- 公式READMEに基づく「導入手順」", "- 懸念への「想定問答集」"];
  const base = note(PAID_BODY, teaser);
  const insertHead = (anchor, lines) => base.replace(anchor, `${anchor}\n${lines.join("\n")}`);
  const cases = [
    ["「」の項目（購入に触れた行）", insertHead("### 🔒 有料エリアで完全公開する実践ナレッジ", ["購入された方には「障害対応ランブック」もお付けします。", ""])],
    ["表の行", base.replace("## はじめに", "## はじめに\n| 項目 | 内容 |\n|---|---|\n| **有料版の特典** | 障害対応ランブック |\n")],
    ["続きを示す見出しの下の・箇条書き", insertHead(teaser[3], ["", "### 続きで読めるもの", "・障害対応ランブック", "・監視ダッシュボード雛形"])],
    ["全角の番号", insertHead(teaser[3], ["１）障害対応ランブック"])],
    ["丸数字", insertHead(teaser[3], ["②障害対応ランブック"])],
    ["有料ライン直前の引用の中の箇条書き", base.replace("> noteは購入後", "> * 障害対応ランブック\n> noteは購入後")],
  ];
  for (const [name, md] of cases) assert.ok(paidNoteProblems(md).some((p) => /予告/.test(p)), name);
});
