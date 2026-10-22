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
import { RULE_READINGS } from "./rule_readings.mjs";
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
// 大字（壱・弐・拾・萬など）。参・拾・陸のように普通の語にも使う字は、数字の並びの中にあるときだけ数字として読む
const DAIJI_ALWAYS = { 壱: "一", 壹: "一", 弌: "一", 弐: "二", 貳: "二", 貮: "二", 弍: "二", 萬: "万", 阡: "千", 仟: "千", 佰: "百", 陌: "百", 廿: "二十", 卅: "三十" };
const DAIJI_IN_RUN = { 参: "三", 參: "三", 肆: "四", 伍: "五", 陸: "六", 漆: "七", 柒: "七", 捌: "八", 玖: "九", 拾: "十", 什: "十" };
const NUMERAL_CHARS = `〇零一二三四五六七八九十百千万億兆${Object.keys(DAIJI_ALWAYS).join("")}${Object.keys(DAIJI_IN_RUN).join("")}`;
const daijiToKanji = (s) =>
  s
    .replace(new RegExp(`[${NUMERAL_CHARS}]{2,}`, "g"), (run) => [...run].map((c) => DAIJI_IN_RUN[c] || c).join(""))
    .replace(new RegExp(`[${Object.keys(DAIJI_ALWAYS).join("")}]`, "g"), (c) => DAIJI_ALWAYS[c]);
const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(lt|gt|quot|apos|nbsp|amp);/g, (_, n) => ({ lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", amp: "&" })[n]);

export const normalizeForRules = (text) =>
  daijiToKanji(decodeEntities(normalizeEol(text).replace(/<!--[\s\S]*?-->/g, "")).normalize("NFKC"))
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1") // [文字](URL) → 文字
    .replace(/!?\[([^\]\n]*)\]\[[^\]\n]*\]/g, "$1")
    .replace(/<[^>\n]*>/g, "") // HTML タグ
    .replace(/[*_~`\\]/g, "") // 強調・取り消し線・コード・エスケープ
    .replace(INVISIBLE_OR_SPACE, "") // 改行も消す（行をまたいだ表現も 1 つの並びとして見る）
    .replace(/(?<![\d.])[〇零一二三四五六七八九十百千]+/g, kanjiToArabic) // 算用数字の後の「千・百」（3.5千 など）は桁の単位なので残す
    .replace(/(\d),(?=\d{3})/g, "$1")
    .replace(/(\d+(?:\.\d+)?)分の(\d+(?:\.\d+)?)/g, "$2/$1");
// 飾りの記号（かっこ・引用符・中黒・ダッシュ・絵文字など）を挟んでもすり抜けないよう、それを外した並び。
// 「:」「。」「|」のような区切りは残す（表の「単価: 5万円」を「単価5万円」とつなげて誤検出しないため）
const withoutDecoration = (normalized) => normalized.replace(/[\p{Ps}\p{Pe}\p{Pi}\p{Pf}\p{Pd}\p{So}\p{Sk}・]/gu, "");
// 区切り（読点・句点・表のセル境界など、句読点と記号すべて）も外した並び。「受注に、直結」「| 受注に | 直結します |」を 1 つの並びとして見る
const withoutSeparators = (normalized) => normalized.replace(/[\p{P}\p{S}]/gu, "");
// ルビ（<rt>・<rp>）は本文の並びの外に表示されるので、それを外した並びも見る
const withoutRuby = (s) => s.replace(/<(rt|rp)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
// カタカナをひらがなにそろえる（規則側も同じにそろえ、漢字は読みでも当てる: kanaRule）
const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const MIN_KANA_TOKEN = 4; // 「もうか（儲か）」「かせげ（稼げ）」のような 3 文字以下の読みは普通の文（もうかなり 等）と区別できないので読みでは当てない
const RE_TOKEN = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+/u;
function kanaToken(token) {
  let minLen = 0;
  const pieces = token.match(/\p{Script=Han}+|[^\p{Script=Han}]+/gu).map((part) => {
    if (!/\p{Script=Han}/u.test(part)) {
      minLen += part.length;
      return toHiragana(part);
    }
    const readings = RULE_READINGS[part];
    if (!readings || readings.length !== [...part].length) throw new Error(`RULE_READINGS に「${part}」の 1 文字ずつの読みが無い`);
    return [...part]
      .map((ch, k) => {
        const alts = [].concat(readings[k]);
        minLen += Math.min(...alts.map((a) => a.length));
        return `(?:${ch}|${alts.join("|")})`;
      })
      .join("");
  });
  return minLen >= MIN_KANA_TOKEN ? pieces.join("") : toHiragana(token);
}
// 規則の正規表現を、漢字の並びは「漢字か読み」、カタカナはひらがなで当たる形に書き換える（文字クラス [..] とエスケープはそのまま）
export function kanaRule(re) {
  const src = re.source;
  let out = "";
  for (let i = 0; i < src.length; ) {
    const rest = src.slice(i);
    const piece =
      rest.match(/^\\[pPu]\{[^}]*\}|^\\./)?.[0] || rest.match(/^\[(?:\\.|[^\]\\])*\]/)?.[0];
    if (piece) {
      out += piece;
      i += piece.length;
      continue;
    }
    const token = rest.match(RE_TOKEN)?.[0];
    if (token) {
      out += kanaToken(token);
      i += token.length;
      continue;
    }
    out += src[i++];
  }
  return new RegExp(out, re.flags);
}
// 規則の漢字・カタカナを読み（ひらがな）でも当てる版。下の ruleViews のひらがなにそろえた並びに当てる
export const PAID_KANA_RULES = PAID_RULES.map(([re, why]) => [kanaRule(re), why]);
// note に載せたときに読者が読む有料部分の文字（note 用 HTML の有料部分からタグを外したもの）
const readerText = (payBodyHtml) => payBodyHtml.replace(/<[^>]*>/g, "\n");
// 読者に見出しとして見えるもの（note 用 HTML の h1〜h6）。コードブロックに飲み込まれた「## 〜」は見出しにならない
const readerHeadings = (payBodyHtml) =>
  (payBodyHtml.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/g) || []).map((h) => decodeEntities(h.replace(/<[^>]*>/g, "")));
// 規則を当てる並び: 原稿そのまま（行頭・行末を見る規則のため）と、原稿・読者に見える文字（それぞれルビあり／なし）を揃えたもの。
// 揃えた並びごとに飾りを外した並びを足し、原稿からは区切りも外した並びを足す。
// 区切りを外すのは原稿（Markdown）だけ: note は表を「単価: 5万円」の形の文に直すので、読者向けの文から「:」を外すと積算根拠表の行が「単価5万円」になり誤検出する
export function ruleViews(paidRaw, payBodyHtml) {
  const views = new Set([paidRaw]);
  const sources = [[paidRaw, true], [withoutRuby(paidRaw), true], [readerText(payBodyHtml), false], [readerText(withoutRuby(payBodyHtml)), false]];
  for (const [src, joinSeparators] of sources) {
    const n = normalizeForRules(src);
    views.add(n).add(withoutDecoration(n));
    if (joinSeparators) views.add(withoutSeparators(n));
  }
  return [...views];
}

// 見た目がラテン文字に似た別の文字体系の字（キリル文字の о・ギリシャ文字の ο など）を混ぜた語。
// 規則の綴りを 1 字だけ似た字に替えるとどの規則にも当たらなくなるので、混ざっていること自体を問題にする
const FOREIGN_LETTER = /(?![\p{Script=Latin}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Common}\p{Script=Inherited}])\p{L}/u;
export function mixedScriptWords(text) {
  return (text.normalize("NFKC").match(/[\p{L}\p{M}]+/gu) || []).filter((w) => /\p{Script=Latin}/u.test(w) && FOREIGN_LETTER.test(w)).length;
}

// 金額（揃えた並びで見る: 円の有無・桁区切り・漢数字・大字・括弧書きを問わない）。有料本文で示すときは積算根拠表が必須。
// 「万・億・兆」の後が件数の単位（スター・件・人など）なら金額ではない。それ以外は金額とみなす（知らない書き方は止める側に倒す）
const NON_MONEY_COUNTER = /^(?:行|件|人|回|個|台|社|語|字|文字|ページ|PV|DL|ダウンロード|スター|stars?|★|トークン|tokens?|リクエスト|ユーザー|名|時間|秒|ステップ|パラメータ|ファイル|枚|本|曲|点|部|エキスパート|MAU|DAU)/i;
// 通貨の書き方は手で並べず、実行環境の通貨データ（ICU）から作る: ISO 4217 の通貨コード・記号（ja/en の symbol と narrowSymbol）・
// 日本語の通貨名とその最後の語（「オーストラリア ドル」→ドル）。英字だけの短い記号（R・Fr など）は普通の語と区別できないので除く
const currencyText = (locale, code, display) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: display }).formatToParts(1).find((p) => p.type === "currency").value.normalize("NFKC");
function currencyWords() {
  const words = new Map(); // 書き方 → 通貨コード
  for (const code of Intl.supportedValuesOf("currency")) {
    const forms = [code];
    for (const locale of ["ja", "en"]) for (const display of ["symbol", "narrowSymbol"]) forms.push(currencyText(locale, code, display));
    const jaName = currencyText("ja", code, "name");
    forms.push(jaName.replace(/\s+/g, ""), jaName.split(/\s+/).pop());
    for (const f of forms) if (f && !/^[A-Za-z.\s]{1,2}$/.test(f) && !words.has(f)) words.set(f, code);
  }
  return words;
}
const CURRENCY = currencyWords();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const CURRENCY_RE = [...CURRENCY.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
const MULTIPLIER = { k: 1e3, K: 1e3, 千: 1e3, thousand: 1e3, 万: 1e4, 十万: 1e5, M: 1e6, mn: 1e6, million: 1e6, 百万: 1e6, 千万: 1e7, 億: 1e8, B: 1e9, bn: 1e9, billion: 1e9, 兆: 1e12 };
const MULT_RE = Object.keys(MULTIPLIER).sort((a, b) => b.length - a.length).join("|");
const AMOUNT_BEFORE = new RegExp(`(?<![A-Za-z])(${CURRENCY_RE})(\\d+(?:\\.\\d+)?)(${MULT_RE})?`, "gu");
const AMOUNT_AFTER = new RegExp(`(\\d+(?:\\.\\d+)?)(${MULT_RE})?(${CURRENCY_RE})(?![A-Za-z\\p{Script=Katakana}ー])`, "gu");
// 見積額とみなす下限（以前の規則と同じ: 円は 1 万以上、¥ 記号を前に付けた額はすべて、外貨は 100 以上）
const isEstimateSized = (value, word, symbolFirst) => {
  if (CURRENCY.get(word) !== "JPY") return value >= 100;
  return (symbolFirst && word === "¥") || value >= 1e4;
};
export function hasMoneyAmount(normalized) {
  for (const m of normalized.matchAll(/\d+(?:\.\d+)?[十百千]?[万億兆](.{0,8})/gu)) if (!NON_MONEY_COUNTER.test(m[1])) return true;
  for (const [, word, num, mult] of normalized.matchAll(AMOUNT_BEFORE)) if (isEstimateSized(Number(num) * (MULTIPLIER[mult] || 1), word, true)) return true;
  for (const [, num, mult, word] of normalized.matchAll(AMOUNT_AFTER)) if (isEstimateSized(Number(num) * (MULTIPLIER[mult] || 1), word, false)) return true;
  return false;
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
// 有料エリア・続きに触れる言葉（見出し・前置きの行・表の行・「」の項目を含む行が予告かどうかを決める）
const PROMISE_CONTEXT = /有料|購入|特典|会員限定|メンバー限定|収録|続き|この先|ここから先|本編|お付け|付録|プレゼント/;
// 箇条書きの印: - * + （後ろに空白）・中黒や●などの記号・番号（1. 1) 1、 (1)）。全角の番号は NFKC で、丸数字は「- 」に直してから見る
const LIST_ITEM = /^(\s*)(?:[-*+](?=\s)|[•・●○◎■□◆◇▪▫▶►▸➤✓✔✅☑→⇒☆★]|\d+[.)、]|\(\d+\))\s*(\S.*)$/u;
const TABLE_ROW = /^\s*\|(.*)\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|[\s:|-]+\|\s*$/;
const HEADING = /^#{1,6} /;
const QUOTED = /[「『【〈《“"]([^」』】〉》”"]+)[」』】〉》”"]/g;
// コードブロックの中の行を空にした行の並び（コード中の「# コメント」や「- 」を見出し・箇条書きとして数えない）
function outsideFences(lines) {
  let fence = false;
  return lines.map((l) => {
    const marker = /^\s*(```|~~~)/.test(l);
    if (marker) fence = !fence;
    return fence || marker ? "" : l;
  });
}
// 予告を読む形にそろえた行: コードブロックの外だけ・丸数字は「- 」・全角は半角（NFKC）・引用の「>」は外す（引用の中の箇条書きも予告）
const headForm = (lines) =>
  outsideFences(lines).map((raw) => {
    const l = raw.replace(/^(\s*(?:>\s?)*)\p{No}/u, "$1- ").normalize("NFKC");
    return { text: l.replace(/^(\s*)(?:>\s?)+/, "$1"), quoted: /^\s*>/.test(l) };
  });
const cellsOf = (row) => row.match(TABLE_ROW)[1].split("|").map((c) => c.replace(/[*_`]/g, "").trim()).filter(Boolean);
const isRow = (l) => TABLE_ROW.test(l) && !TABLE_SEPARATOR.test(l);
// 有料ラインの直前で読み飛ばす行: 空行・区切り線・引用の地の文（引用の中の箇条書きは読み飛ばさない）
const isSkippable = ({ text, quoted }) => !text.trim() || /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(text) || (quoted && !LIST_ITEM.test(text));

// 無料部分から予告を取り出す。見出しの言い回しや書式に頼らないよう、次を予告とみなす:
// (1) 見出しか前置きの行が有料エリア・続きに触れている箇条書き・表の行 (2) 有料エリアに触れた表の行の、ほかのセル
// (3) 有料ラインの直前（空行・区切り線・引用の地の文だけを挟む）にある、字下げしていない箇条書きのまとまり
//     （比較表のような表は有料ラインの直前にあっても予告とは限らないので、表は (1)(2) だけで読む）
// (4) 有料エリアに触れた文の「」『』【】などで囲んだ項目（囲んだ中身が購入の手続きそのもの＝「購入・チップ履歴」などは除く）
//     （同じ行でも別の文の引用は予告ではない）
export function teaserPromises(headLines) {
  const rows = headForm(headLines).slice(0, -1); // head の最後の行は有料ラインそのもの（splitPaid）
  const lines = rows.map((r) => r.text);
  const promised = new Set();
  const addRow = (l, all) => {
    for (const c of cellsOf(l)) if (all || !PROMISE_CONTEXT.test(c)) promised.add(c);
  };
  let context = "";
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const item = l.match(LIST_ITEM);
    if (HEADING.test(l)) context = l;
    else if (item) {
      if (PROMISE_CONTEXT.test(context)) promised.add(item[2]);
    } else if (isRow(l)) {
      const isHeaderRow = TABLE_SEPARATOR.test(lines[i + 1] || "");
      if (PROMISE_CONTEXT.test(l)) addRow(l, false);
      else if (!isHeaderRow && PROMISE_CONTEXT.test(context)) addRow(l, true);
    } else if (l.trim() && !TABLE_SEPARATOR.test(l)) context = l;
    for (const sentence of l.split(/(?<=[。！？!?])/)) {
      if (PROMISE_CONTEXT.test(sentence)) for (const m of sentence.matchAll(QUOTED)) if (!PROMISE_CONTEXT.test(m[1])) promised.add(m[1]);
    }
  }
  let end = rows.length - 1;
  while (end >= 0 && isSkippable(rows[end])) end--;
  const last = end >= 0 ? lines[end].match(LIST_ITEM) : null;
  if (last && last[1].length < 2) {
    for (let i = end; i >= 0 && (LIST_ITEM.test(lines[i]) || isSkippable(rows[i]) || /^\s{2,}\S/.test(lines[i])); i--) {
      const item = lines[i].match(LIST_ITEM);
      if (item && item[1].length < 2) promised.add(item[2]);
    }
  }
  return [...promised];
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
  const kanaViews = views.map(toHiragana);
  const problems = [];
  for (const [i, [re, why]] of PAID_RULES.entries()) {
    if (views.some((v) => re.test(v)) || kanaViews.some((v) => PAID_KANA_RULES[i][0].test(v))) problems.push(`有料本文の禁止表現: ${why}`);
  }
  if (mixedScriptWords(paid) || mixedScriptWords(readerText(payBody))) {
    problems.push("有料本文の禁止表現: ラテン文字の語に、見た目の似た別の文字体系の字（キリル文字など）が混ざっている");
  }
  // 金額は区切り（小数点・通貨記号）を残した並びで見る
  const amountViews = [paid, readerText(payBody)].map(normalizeForRules).flatMap((n) => [n, withoutDecoration(n)]);
  if (amountViews.some(hasMoneyAmount) && !parts.paid.some(isBasisRow)) {
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
