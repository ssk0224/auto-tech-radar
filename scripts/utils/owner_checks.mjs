// 有料本文（暗号化部分）の検査。中身を見られるのは秘密鍵のある owner PC だけなので、ここで定義した検査を
// テスト（boundaries / note_html）・出品（openNoteForPublishing）・API 同期・生成（暗号化の前）が同じ関数で使う。
// 以前は禁止表現の一覧がテストの中と claims_check に別々にあり、有料本文の検査は誰からも呼ばれない owner PC のテストだけだった。
// その結果、有料本文の禁止表現が赤のまま出品候補に出ていた。
// 結果には記事名・規則名・件数だけを入れ、有料本文の文字列は入れない（ログ・CI の出力に有料本文を出さない）。
// 既存ファイルとの関係: owner_dir.mjs は owner 端末の置き場所（パス）を決めるだけで検査を持たない。
// note_vault.mjs は暗号化・復号の低レベル処理で、ここから使う（検査を note_vault に入れると claims_check・note_html への依存が暗号化処理に入る）。
import fs from "fs";
import path from "path";
import { FORBIDDEN as CLAIMS_FORBIDDEN } from "./claims_check.mjs";
import { HYPE_RULES } from "./hype_check.mjs";
import { normalizeEol } from "./eol.mjs";
import { isNoise } from "./noise_filter.mjs";
import { parseDraftToNotePayload } from "./note_html.mjs";
import {
  noteDir, privateKeyFile, openedDir, splitPaid, assembleNote, isSealed, paidContentSummary, summaryFileFor,
  loadPrivateKeys, openNoteForEditing, PAID_FEATURES,
} from "./note_vault.mjs";

// サイト・note の公開文面と有料本文に共通で使う禁止表現（以前は tests/boundaries.test.mjs の中にだけあった）
export const COPY_FORBIDDEN = [
  [/アンロック/, "サイトに有料本文は無いのに「アンロック」をうたっている"],
  [/即受注|受注に直結|に直結します/, "受注・成果を保証する表現"],
  [/(分前|時間前).{0,40}(アンロック|購読|購入|参加)しました|(アンロック|購読|購入|参加)しました.{0,40}(分前|時間前)/, "架空の購入通知"],
  [/Math\.random\(\)[^\n]{0,40}名/, "乱数で作った閲覧者数"],
  [/全編読み放題|全記事読み放題|全レポート読み放題/, "メンバーシップで全記事が読めるかのような表現（特典に追加した記事のみ）"],
  [/完全公開(され|して)います|全編公開されています|PRO限定(実務キット)?エリア/, "サイトで有料キットを公開しているかのような表現"],
  [/ThoughtWorks/, "第三者（ThoughtWorks）の評価であるかのような表示（実際はスター数や AI の見立て）"],
  [/毎朝\s*6[:：]00/, "定時配信の約束（GitHub の定期実行は数時間遅れることがある）"],
  [/世界最速|世界最先端/, "根拠のない最上級表現"],
  [/1営業日以内/, "個人運営で保証できない返信期限"],
  [/社内稟議・提案書ドラフト|社内稟議テンプレ付|見積内訳付き/, "誇張表現（導入企画・提案書テンプレートを使用する）"],
  [/^===\s*(SECTION|WEB ARTICLE|NOTE ARTICLE|X THREAD)\s*===$/m, "AIプロンプトのセクション区切り文字が漏洩"],
];

// 有料本文に使う規則: 上の一覧・生成時の一覧（claims_check）・誇張表現（hype_check）をすべて合わせる（一覧を別々に持たない）
export const PAID_RULES = [...COPY_FORBIDDEN, ...CLAIMS_FORBIDDEN, ...HYPE_RULES.map(([re, , why]) => [re, why])];

// 書き方の違い（全角英数・全角空白・空白・ゼロ幅文字・強調記法）で規則をすり抜けないよう、比べる前に揃える
export const normalizeForRules = (text) =>
  normalizeEol(text)
    .normalize("NFKC")
    .replace(/[\t  ­​-‍⁠﻿]/g, "")
    .replace(/\*\*|__|`/g, "");

// 万円単位の金額（数字の書き方を問わない）。有料本文で示すときは積算根拠表が必須
const AMOUNT_RE = /\d[\d,.]*万(?:円|[〜~～-])/;
const isBasisRow = (l) =>
  l.includes("|") &&
  /工程|項目|業務/.test(l) &&
  /工数|人日/.test(l) &&
  l.includes("単価") &&
  l.includes("小計") &&
  /作業|詳細|内訳|成果物/.test(l);

// 無料部分の「有料エリアで公開する」予告の箇条書きが約束した項目（有料版の内容一覧と同じ分類）
function promisedFeatures(headLines) {
  const i = headLines.findIndex((l) => /^#{2,4} .*有料エリア/.test(l));
  if (i === -1) return [];
  const promised = new Set();
  for (let j = i + 1; j < headLines.length && !/^#{1,4} /.test(headLines[j]); j++) {
    if (!/^\s*[-*] /.test(headLines[j])) continue;
    for (const [re, label] of PAID_FEATURES) if (re.test(headLines[j])) promised.add(label);
  }
  return [...promised];
}

// note 用 HTML へ変換した結果の検査（以前は tests/note_html.test.mjs の中にだけあった）
export function notePayloadProblems(fullMd) {
  const res = parseDraftToNotePayload(fullMd, true);
  const nonPre = res.fullBody.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, "");
  const checks = [
    [res.title.length > 10 && !res.title.startsWith("#"), "タイトル形式が正しくない"],
    [res.freeBody.length > 200, "freeBody が無い"],
    [res.payBody.length > 500, "payBody が無い"],
    [res.separator && res.freeBody.includes(`id="${res.separator}"`), "separator が freeBody 末尾要素を指していない"],
    [!/\|---|\|:---/.test(nonPre), "Markdown表の区切り線 (|---|) が残っている"],
    [!/`/.test(nonPre), "未変換のバッククォートが残っている"],
    [!/!\[/.test(nonPre), "未変換の画像記法 ![](...) が残っている"],
    [!/(flowchart|graph)\s+TD/.test(res.fullBody), "生のMermaid構文が残っている"],
    [!/推奨ハッシュタグ/.test(res.fullBody), "末尾の出品用ハッシュタグ注記が本文に残っている"],
  ];
  return checks.filter(([ok]) => !ok).map(([, why]) => `note用HTML: ${why}`);
}

// 出品する完全な原稿（無料部分 + 有料本文 + 末尾）の問題を返す。summary を渡すと公開中の内容一覧（.paid.json）との一致も見る
export function paidNoteProblems(fullMd, { summary } = {}) {
  const text = normalizeEol(fullMd);
  const parts = splitPaid(text);
  if (!parts) return ["有料ラインが分割できない"];
  const paid = parts.paid.join("\n");
  const normalized = normalizeForRules(paid);
  const problems = [];
  for (const [re, why] of PAID_RULES) {
    if (re.test(paid) || re.test(normalized)) problems.push(`有料本文の禁止表現: ${why}`);
  }
  if (AMOUNT_RE.test(normalized) && !parts.paid.some(isBasisRow)) {
    problems.push("有料本文の金額に積算根拠表（工程・工数・単価・小計）が無い");
  }
  const have = paidContentSummary(paid);
  for (const label of promisedFeatures(parts.head)) {
    if (!have.features.some((f) => f.startsWith(label))) problems.push(`無料部分の予告にある「${label}」が有料本文に無い`);
  }
  if (summary && JSON.stringify(summary) !== JSON.stringify(have)) {
    problems.push("公開中の有料版の内容一覧（.paid.json）と有料本文が一致しない");
  }
  problems.push(...notePayloadProblems(text));
  return [...new Set(problems)];
}

// 秘密鍵が「無い」ときだけ空配列。鍵はあるのに読めないときは失敗させる（握りつぶして「未実施」にしない）
export function privateKeysIfPresent(file = privateKeyFile) {
  if (!fs.existsSync(file)) return [];
  if (file !== privateKeyFile) return [fs.readFileSync(file, "utf8")];
  return loadPrivateKeys();
}

const readSummary = (noteFile) => {
  try {
    return JSON.parse(fs.readFileSync(summaryFileFor(noteFile), "utf8"));
  } catch (e) {
    return { unreadable: true }; // 無い・壊れている内容一覧は、有料本文と一致しない扱いにする
  }
};

// dir の全非ノイズ原稿（有料部分が暗号化されたもの）を復号して検査する。
// status: green（全部通った）/ red（1 本でも違反）/ skipped（秘密鍵が無く検査できない。出品側は red と同じに扱う）
export function ownerCheckReport({ dir = noteDir, keys = privateKeysIfPresent() } = {}) {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith("_note.md") && !isNoise(f.replace("_note.md", "")))
    .filter((f) => isSealed(fs.readFileSync(path.join(dir, f), "utf8")))
    .sort();
  if (keys.length === 0) return { status: "skipped", checked: 0, total: files.length, failed: [], reason: "秘密鍵が無いため有料本文を検査できない" };
  const failed = [];
  for (const f of files) {
    const noteFile = path.join(dir, f);
    let problems;
    try {
      problems = paidNoteProblems(assembleNote(noteFile, keys), { summary: readSummary(noteFile) });
    } catch (e) {
      problems = [`復号・検査に失敗: ${e.message.split("\n")[0]}`];
    }
    if (problems.length) failed.push({ file: f, problems });
  }
  return { status: failed.length ? "red" : "green", checked: files.length, total: files.length, failed };
}

export function describeReport(r) {
  if (r.status === "skipped") return `有料本文の検査を実施できません（${r.reason}）。`;
  const lines = [`有料本文の検査: ${r.checked} 本中 ${r.failed.length} 本が不合格。`];
  for (const x of r.failed) lines.push(`  - ${x.file}: ${x.problems.join(" / ")}`);
  return lines.join("\n");
}

// 検査が green でなければ（red・skipped）例外を投げる。出品・note の更新の前に必ず通す
export function assertOwnerChecksGreen(opts = {}) {
  const r = ownerCheckReport(opts);
  if (r.status !== "green") {
    throw new Error(
      `${describeReport(r)}\n  出品を止めました。npm run vault:open で原稿を開いて直し、npm run vault:seal-from -- <slug> で暗号化し直してください。`
    );
  }
  return r;
}

// 出品・差し替え用に完全版を開く。開く前に同じフォルダの全原稿を検査し、green でなければ平文を書き出さずに止める
export function openNoteForPublishing(noteFile, { keys = privateKeysIfPresent(), outDir = openedDir } = {}) {
  if (!isSealed(fs.readFileSync(noteFile, "utf8"))) return noteFile;
  assertOwnerChecksGreen({ dir: path.dirname(noteFile), keys });
  return openNoteForEditing(noteFile, { keys, outDir });
}
