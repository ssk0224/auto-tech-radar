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

// 書き方の違いで規則をすり抜けないよう、規則は「読者に見える文字の並び」に対して当てる。
// 以前は消す文字を 1 つずつ並べていたため、並べていない見えない文字・改行・Markdown リンク・漢数字・分数表記ですり抜けた。
// ここでは Unicode の性質（表示されない文字・制御文字・空白・結合記号）でまとめて消し、Markdown / HTML の記法を外し、
// 数の書き方（漢数字・桁区切り・「N分の1」）を算用数字にそろえる。
const INVISIBLE_OR_SPACE = /[\p{Default_Ignorable_Code_Point}\p{Cf}\p{Cc}\p{Z}\p{Mn}\p{Me}\s]/gu;
const KANJI_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const KANJI_UNIT = { 十: 10, 百: 100, 千: 1000 };
const kanjiToArabic = (run) => {
  if (![...run].some((c) => c in KANJI_UNIT)) return [...run].map((c) => KANJI_DIGIT[c]).join("");
  let total = 0;
  let digit = 0;
  for (const c of run) {
    if (c in KANJI_DIGIT) digit = KANJI_DIGIT[c];
    else {
      total += (digit || 1) * KANJI_UNIT[c];
      digit = 0;
    }
  }
  return String(total + digit);
};
const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(lt|gt|quot|apos|nbsp|amp);/g, (_, n) => ({ lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", amp: "&" })[n]);

export const normalizeForRules = (text) =>
  decodeEntities(normalizeEol(text))
    .normalize("NFKC")
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1") // [文字](URL) → 文字
    .replace(/!?\[([^\]\n]*)\]\[[^\]\n]*\]/g, "$1")
    .replace(/<[^>\n]*>/g, "") // HTML タグ
    .replace(/[*_~`\\]/g, "") // 強調・取り消し線・コード・エスケープ
    .replace(INVISIBLE_OR_SPACE, "") // 改行も消す（行をまたいだ表現も 1 つの並びとして見る）
    .replace(/[〇零一二三四五六七八九十百千]+/g, kanjiToArabic)
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/(\d+(?:\.\d+)?)分の(\d+(?:\.\d+)?)/g, "$2/$1");
// 飾りの記号（かっこ・引用符・中黒・ダッシュ・絵文字など）を挟んでもすり抜けないよう、それを外した並び。
// 「:」「。」「|」のような区切りは残す（表の「単価: 5万円」を「単価5万円」とつなげて誤検出しないため）
const withoutDecoration = (normalized) => normalized.replace(/[\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Pd}\p{So}\p{Sk}・]/gu, "");
// note に載せたときに読者が読む有料部分の文字（note 用 HTML の有料部分からタグを外したもの）
const readerText = (payBodyHtml) => payBodyHtml.replace(/<[^>]*>/g, "\n");
// 読者に見出しとして見えるもの（note 用 HTML の h1〜h6）。コードブロックに飲み込まれた「## 〜」は見出しにならない
const readerHeadings = (payBodyHtml) =>
  (payBodyHtml.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g) || []).map((h) => decodeEntities(h.replace(/<[^>]*>/g, "")));
// 規則を当てる並び: 原稿そのまま（行頭・行末を見る規則のため）と、原稿・読者に見える文字それぞれを揃えたもの
export function ruleViews(paidRaw, payBodyHtml) {
  const views = [paidRaw];
  for (const src of [paidRaw, readerText(payBodyHtml)]) {
    const n = normalizeForRules(src);
    views.push(n, withoutDecoration(n));
  }
  return views;
}

// 金額（揃えた並びで見る: 円の有無・桁区切り・漢数字・括弧書きを問わない）。有料本文で示すときは積算根拠表が必須。
// 「万・億」の後が件数の単位（スター・件・人など）なら金額ではない。それ以外は金額とみなす（知らない書き方は止める側に倒す）
const NON_MONEY_COUNTER = /^(?:行|件|人|回|個|台|社|語|字|文字|ページ|PV|DL|ダウンロード|スター|stars?|★|トークン|tokens?|リクエスト|ユーザー|名|時間|秒|ステップ|パラメータ|ファイル|枚|本|曲|点|部|エキスパート|MAU|DAU)/i;
export function hasMoneyAmount(normalized) {
  for (const m of normalized.matchAll(/\d+(?:\.\d+)?[万億](.{0,8})/gu)) if (!NON_MONEY_COUNTER.test(m[1])) return true;
  return /\d{5,}円|[¥￥]\d|\$\d{3,}|\d{3,}(?:ドル|USD)/i.test(normalized);
}
const isBasisRow = (l) =>
  l.includes("|") &&
  /工程|項目|業務/.test(l) &&
  /工数|人日/.test(l) &&
  l.includes("単価") &&
  l.includes("小計") &&
  /作業|詳細|内訳|成果物/.test(l);

// 無料部分の予告（有料エリアで読めると約束した項目）の分類と、それを満たす有料本文の見出し。
// どの分類にも当たらない予告は「照合できない」として止める（以前は分類に当たらない予告を黙って見逃していた）
// 有料版の内容一覧（PAID_FEATURES・.paid.json）と同じ分類の見出しは、同じ規則で数える（2 つの一覧をずらさない）
function withFeature(extra, featureLabel) {
  const feature = PAID_FEATURES.find(([, label]) => label === featureLabel);
  if (!feature) throw new Error(`PAID_FEATURES に「${featureLabel}」が無い`);
  return new RegExp(`${feature[0].source}|${extra.source}`);
}
export const PROMISE_CATEGORIES = [
  [/提案書/, withFeature(/提案書/, "導入提案書テンプレート（Markdown）"), "提案書"],
  [/見積|工数/, withFeature(/見積|工数/, "工数・見積表"), "工数・見積表"],
  [/導入手順|インストール|セットアップ|環境構築|設定|Docker|コンテナ|サーブ|本番導入|デプロイ|起動|カスタマイズ|実装の勘所/, withFeature(/手順|環境構築|デプロイ|コンテナ/, "導入手順"), "導入手順"],
  [/想定問答|Q&A|FAQ|質問/, withFeature(/FAQ|質問/, "導入時の想定問答"), "想定問答"],
  [/トーク|フレーズ/, /トーク|フレーズ/, "営業トーク"],
  [/SaaS|プロダクト|設計図|仕様書|設計モデル/, /SaaS|プロダクト|設計/, "SaaS 設計"],
  [/受託|シナリオ/, /受託|シナリオ/, "受託開発シナリオ"],
  [/MCP|cursorrules/, /MCP|cursorrules/, "MCP 連携"],
  [/比較|コスト削減/, /比較|コスト|削減/, "比較・コスト削減"],
  [/コード|スクリプト|ラッパー/, /コード|スクリプト|ラッパー|実装/, "コード"],
  [/マネタイズ|活用|収益化/, withFeature(/収益化/, "活用・収益化の考え方"), "活用・収益化"],
];
const PROMISE_CONTEXT = /有料|購入|特典|会員限定|メンバー限定|収録/;
const LIST_ITEM = /^(\s*)(?:[-*+•]|\d+[.)．])\s+(.*)$/;
// コードブロックの中の行を空にした行の並び（コード中の「# コメント」や「- 」を見出し・箇条書きとして数えない）
function outsideFences(lines) {
  let fence = false;
  return lines.map((l) => {
    const marker = /^\s*(```|~~~)/.test(l);
    if (marker) fence = !fence;
    return fence || marker ? "" : l;
  });
}
const isSkippable = (l) => !l.trim() || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(l) || /^\s*>/.test(l);

// 無料部分から予告を取り出す。見出しの言い回しに頼らないよう、次の 3 つを予告とみなす:
// (1) 見出しか直前の行が有料エリアに触れている箇条書き (2) 有料ラインの直前（区切り線・引用だけを挟む）にある箇条書き
// (3) 有料エリアに触れた行の『』で囲んだ項目
export function teaserPromises(headLines) {
  const lines = outsideFences(headLines);
  const promised = new Set();
  let context = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^#{1,6} /.test(l)) context = l;
    else if (LIST_ITEM.test(l)) {
      if (PROMISE_CONTEXT.test(context)) promised.add(i);
    } else if (l.trim()) context = l;
    if (PROMISE_CONTEXT.test(l)) for (const m of l.matchAll(/『([^』]+)』/g)) promised.add(m[1]);
  }
  let end = lines.length - 2; // head の最後の行は有料ラインそのもの（splitPaid）
  while (end >= 0 && isSkippable(lines[end])) end--;
  const last = end >= 0 ? lines[end].match(LIST_ITEM) : null;
  if (last && last[1].length < 2) {
    for (let i = end; i >= 0 && (LIST_ITEM.test(lines[i]) || !lines[i].trim() || /^\s{2,}\S/.test(lines[i])); i--) {
      if (LIST_ITEM.test(lines[i])) promised.add(i);
    }
  }
  return [...promised].map((x) => (typeof x === "number" ? lines[x].match(LIST_ITEM)[2] : x));
}

// 1 つの予告に複数の項目をつないだ書き方（＆・＋、かっこでくくった項目どうしの「と」「、」「や」など）は分けて照合する
const PROMISE_JOINER = /\s*[＆＋]\s*|\s+[&+]\s+|(?<=[」』）)])\s*(?:と|や|および|及び|、|,|／|\/)\s*(?=[「『（(])/;
// 予告の各項目が、有料本文の見出しのどれかで満たされているか
function promiseProblems(headLines, payBodyHtml) {
  const headings = readerHeadings(payBodyHtml);
  const missing = new Set();
  let unmapped = 0;
  for (const item of teaserPromises(headLines)) {
    for (const part of item.split(PROMISE_JOINER).filter((x) => x && x.trim())) {
      const cats = PROMISE_CATEGORIES.filter(([re]) => re.test(part));
      if (cats.length === 0) unmapped++;
      for (const [, paidRe, label] of cats) if (!headings.some((h) => paidRe.test(h))) missing.add(label);
    }
  }
  const problems = [...missing].map((label) => `無料部分の予告にある「${label}」が有料本文の見出しに無い`);
  if (unmapped) problems.push(`無料部分の予告に、有料本文と照合できない項目が ${unmapped} 件ある（予告を有料本文の見出しに合わせる）`);
  return problems;
}

// コードブロックを note_html と同じ規則（同じ記号で同じ長さ以上の、言語名の無い行で閉じる）で読み、
// 中に「```yaml」のような開き行があれば、入れ子のつもりで書いて閉じ方がずれている（以降の見出しや表がコードとして表示される）
export function nestedFenceProblems(lines) {
  let broken = 0;
  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].trim().match(/^(`{3,}|~{3,})(.*)$/);
    if (!open) continue;
    const fence = open[1];
    const close = new RegExp(`^${fence[0]}{${fence.length},}\\s*$`);
    let j = i + 1;
    let innerOpen = false;
    for (; j < lines.length && !close.test(lines[j].trim()); j++) {
      const inner = lines[j].trim().match(/^(`{3,}|~{3,})\S/);
      if (inner && inner[1][0] === fence[0] && inner[1].length >= fence.length) innerOpen = true;
    }
    if (innerOpen) broken++;
    i = j;
  }
  return broken ? [`コードブロックの入れ子が崩れている箇所が ${broken} か所ある（外側を \`\`\`\` のように長くする）`] : [];
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
  const payBody = parseDraftToNotePayload(text, true).payBody;
  const views = ruleViews(paid, payBody);
  const problems = [];
  for (const [re, why] of PAID_RULES) {
    if (views.some((v) => re.test(v))) problems.push(`有料本文の禁止表現: ${why}`);
  }
  if (views.slice(1).some(hasMoneyAmount) && !parts.paid.some(isBasisRow)) {
    problems.push("有料本文の金額に積算根拠表（工程・工数・単価・小計）が無い");
  }
  problems.push(...promiseProblems(parts.head, payBody));
  problems.push(...nestedFenceProblems(text.split("\n")));
  const have = paidContentSummary(paid);
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
