// リポジトリの外にある公開文面（data/profile_copy.json の文）に使ってよい語と、その裏付け。
//
// 以前は「書いてはいけない語」（毎朝・読み放題・最速 など）を並べて止めていたため、言い換えた主張
// （「これまでの有料記事をまるごと」「平日は朝7時に配信」「業界トップクラスの速さ」）がすべて通った（2026-10-22 の検証）。
// ここでは逆に、使ってよい語を決める（既定は不可）:
//   - 内容を表す語（名詞・動詞の語幹・カタカナ語・英字）は、TERMS に登録した語だけ。登録には根拠が要る:
//     その語が述べている事実を実装しているコード・設定のファイルと、そこに実在する記述（evidence）。根拠が消えれば赤になる
//   - それ以外は、文法の語（助詞・助動詞・活用語尾。FUNCTION_WORDS）と句読点・空白だけ
//   - 数字・URL・名前は文に書かず、差し込み（{site} など。src/config/site.js と正本の names から作る）で入れる
// 新しい主張を足すには、TERMS に語と根拠を足す（コードの変更として見直される）。正本の JSON を書き換えるだけでは足せない
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { siteConfig } from "../../src/config/site.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readRepo = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// forms: 文に現れる形。file: 根拠のファイル。evidence: そのファイルに実在すべき記述（省略時は forms の各語がそのファイルに現れること）
export const TERMS = [
  { forms: ["GitHub"], file: "scripts/utils/github_queries.mjs", evidence: /api\.github\.com\/search\/repositories/ },
  { forms: ["注目", "集め"], file: "scripts/utils/github_queries.mjs", evidence: /sort=stars/ },
  { forms: ["オープンソース"], file: "scripts/utils/license_resolver.mjs", evidence: /spdx/ },
  { forms: ["README", "公開情報"], file: "scripts/crawl_and_generate.mjs", evidence: /\/readme`/ },
  { forms: ["日本語"], file: "src/layouts/Layout.astro", evidence: /<html lang="ja">/ },
  { forms: ["解説"], file: "src/config/site.js", evidence: /tagline: ".*解説/ },
  { forms: ["記事"], file: "scripts/crawl_and_generate.mjs", evidence: /=== NOTE ARTICLE ===/ },
  { forms: ["AI", "生成"], file: "scripts/crawl_and_generate.mjs", evidence: /GEMINI_API_KEY/ },
  { forms: ["動作", "検証"], file: "scripts/crawl_and_generate.mjs", evidence: /動作未検証/ },
  { forms: ["有料"], file: "src/config/site.js", evidence: /singleArticlePrice/ },
  { forms: ["提案書テンプレート", "工数見積表", "導入手順", "まとめ"], file: "scripts/crawl_and_generate.mjs" },
  { forms: ["メンバーシップ", "特典", "入っ"], file: "scripts/sync_note_urls.mjs", evidence: /isMembershipConnected/ },
  { forms: ["購入", "読め"], file: "src/config/site.js", evidence: /購入者だけが読める/ },
  { forms: ["公式", "サイト"], file: "src/config/site.js", evidence: /url: "https:/ },
  { forms: ["X"], file: "src/config/site.js", evidence: /xHandle:/ },
  { forms: ["note"], file: "src/config/site.js", evidence: /noteProfileUrl:/ },
];

// 文法の語（助詞・助動詞・活用語尾など、事実を述べない閉じた語の類）。Intl.Segmenter（ja）が切り出す単位で持つ
export const FUNCTION_WORDS = new Set(["は", "が", "を", "に", "で", "と", "の", "も", "へ", "や", "など", "では", "て", "た", "いる", "てい", "し", "した", "ます", "ま", "せん", "ない", "もの", "ごと", "です"]);

// 差し込み。値は設定（src/config/site.js）と正本の names から作り、文の語の検査には含めない
export function placeholders(names = {}) {
  return {
    site: `${siteConfig.url}/`,
    x: siteConfig.xHandle,
    note: siteConfig.noteProfileUrl,
    name: siteConfig.name,
    ...Object.fromEntries(Object.entries(names).map(([k, v]) => [`names.${k}`, v])),
  };
}

// 根拠が実在しない語（read: 相対パス → 中身。テストで差し替える）
export function termEvidenceProblems(read = readRepo) {
  const out = [];
  for (const t of TERMS) {
    let src;
    try {
      src = read(t.file);
    } catch (e) {
      out.push(`${t.forms.join("・")}: 根拠のファイル ${t.file} を読めない（${e.code || e.message}）`);
      continue;
    }
    const missing = t.evidence ? (t.evidence.test(src) ? [] : [String(t.evidence)]) : t.forms.filter((f) => !src.includes(f));
    if (missing.length) out.push(`${t.forms.join("・")}: 根拠 ${missing.join(", ")} が ${t.file} に無い`);
  }
  return out;
}

const FORMS = TERMS.flatMap((t) => t.forms).sort((a, b) => b.length - a.length);
const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const FORMS_RE = new RegExp(FORMS.map(escapeRe).join("|"), "g");

// 文 text のうち、使ってよくない部分（未登録の語・数字・記号・知らない差し込み）。空なら問題なし
export function vocabularyProblems(text, known = placeholders()) {
  const out = [];
  const rest = String(text ?? "")
    .normalize("NFKC")
    .replace(/\{([\w.]+)\}/g, (m, k) => {
      if (!(k in known)) out.push(`知らない差し込み ${m}`);
      return " ";
    })
    .replace(FORMS_RE, " ");
  for (const s of segmenter.segment(rest)) {
    if (s.isWordLike) {
      if (!FUNCTION_WORDS.has(s.segment)) out.push(/\p{N}/u.test(s.segment) ? `数字「${s.segment}」（数は差し込みで入れる）` : `裏付けの無い語「${s.segment}」`);
    } else if (!/^[\s\p{P}]*$/u.test(s.segment)) {
      out.push(`記号「${s.segment.trim()}」`);
    }
  }
  return [...new Set(out)];
}

// 名前（プラン名など）: カタカナ・ラテン文字・空白・中点だけの短い名前（文・数字・漢字の宣伝を名前に入れない）
export const NAME_RE = /^[\p{Script=Katakana}ー・\p{Script=Latin} ]{1,16}$/u;
