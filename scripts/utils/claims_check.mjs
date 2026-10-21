// 禁止表現・誇張表現の統一バリデーター（クローラー生成時とテスト・監査で同一定義を共用）
import { normalizeEol } from "./eol.mjs";

export const FORBIDDEN = [
  [/想定受託単価|推奨受託単価/, "スター数・カテゴリから機械的に決めた受託単価"],
  [/完全保存版|ドル箱|完全無人化|完全網羅/, "根拠のない誇張"],
  [/Trending直結/, "GitHub Trending ではなく検索 API で収集している"],
  [/社内稟議テンプレ付|社内稟議・提案書ドラフト|見積内訳付き/, "無料部分・画像に含まれない有料特典の表示"],
  [/累計[\d,]+\+? ?Stars/, "集計していないスター数の合計"],
  [/即受注|受注に直結/, "成果や受注を保証する表現"],
  [/100%経費精算可能/, "所属先規定に依存する断定"],
  [/専任エンジニアチーム/, "運営実態と異なる表現"],
  [/月収[\d,]+万|月[\d,]+万円(?:以上)?(?:を)?(?:稼|の収入|の利益|の売上|達成)|誰でも稼げる|確実に稼げる|確実に儲かる/, "根拠のない収益保証・誇張"],
  [/案件単価|単価[\d,]+万/, "根拠のない案件単価の表示"],
  [/★\s?[\d,]+\+?(超え)?急増/, "累計スター数を「急増」と表示（増加数ではない）"],
  [/(コスト|費用|料金)[^\n。]{0,8}1\/\d+/, "根拠のないコスト比較"],
  [/全編読み放題|全記事読み放題|全レポート読み放題/, "メンバーシップで全記事が読めるかのような表現（特典に追加した記事のみ）"]
];

export function findForbiddenClaims(rawText) {
  if (!rawText) return [];
  const text = normalizeEol(rawText);
  const hits = [];
  for (const [re, why] of FORBIDDEN) {
    const m = text.match(re);
    if (m) {
      hits.push(`${why} ("${m[0]}")`);
    }
  }
  return hits;
}

// ---- Web 記事（src/pages/radar/*.md）だけに使う検査（2026-10-21） ----
// FORBIDDEN とは別にしている: こちらは note の無料部分（公開中の note と同じ文面を保つ必要がある）には使わない。
// 生成スクリプトは新しい Web 記事をこの検査で不採用にし、テストは既存の全 Web 記事に同じ検査をかける

// 導入・採用を勧める表現（記事は README などの公開情報から AI が書いたもので、実際に検証して勧めているわけではない）
export const WEB_ADOPTION_RULES = [
  [/推奨(?:します|いたします)/, "導入・採用を勧める表現"],
  [/(?:導入|採用|活用|利用|投入)を(?:強く|積極的に)?推奨/, "導入・採用を勧める表現"],
  [/即座に(?:導入|採用|TRIAL)|今すぐ(?:導入|採用)/, "即時の導入を勧める表現"],
  [/(?:導入|採用)(?:を検討)?すべき/, "導入・採用を勧める表現"],
  [/本番環境への導入(?!には|に(?:は|あたって|際して|向けて)|前|の前|の際)/, "本番環境への導入を勧める表現"],
  [/(?:導入|採用|活用|移行|検討)(?:は|が|こそ)?(?:もはや)?必須(?:です|と言え|でしょう)/, "導入を必須とする助言"],
  [/判定[^\n]{0,8}?(?:ADOPT|TRIAL|ASSESS|HOLD)|推奨(?:活用)?フェーズ/, "採用判定（ADOPT/TRIAL 等）・推奨フェーズの表示"],
];

// 比較・最上級の表現。同じ段落に README 等をリンク付きで引用（> の行）している場合だけ認める
export const WEB_SUPERLATIVE_RE = /優位|最速|上回る|上回り|上回っ|圧倒的|凌駕/;

// ライセンスの推測（禁止の記載が無いことを利用できる根拠にする）
export const WEB_LICENSE_REASONING_RE =
  /明示的(?:に|な)?(?:禁止|制限)[^\n。]{0,12}?(?:されていない|されておらず|がない|が無い|は見当たら)|許容されることが多い|慣例として|(?:禁止|制限)(?:する)?(?:記述|記載|条項)(?:は|が)?(?:見当たらない|見当たりません|ない|無い|ありません)/g;

// 生成プロンプトに入れる指示（検査と同じ語を使う）
export const WEB_CLAIMS_PROMPT_RULE = `- Web記事では「推奨します」「即座に導入」「本番環境への導入」「導入すべき」「今すぐ導入」のように導入・採用を勧める書き方や、ADOPT / TRIAL などの採用判定・「推奨フェーズ」を書かないこと。実際に動かして検証したわけではないため、「〜の用途で検証候補になります」のように書くこと。
- Web記事では「優位」「最速」「上回る」「圧倒的」などの比較・最上級の表現を使わないこと。使う場合は、同じ段落に README の該当箇所を > で始まる引用として、リンク付きで示すこと。`;

const stripCode = (s) => String(s || "").replace(/```[\s\S]*?```/g, "");

export function findWebArticleClaims(text) {
  if (!text) return [];
  // CRLF のままだと段落の区切り（空行）が見つからず、別の段落の引用付きリンクで比較の表現を見逃す
  const body = stripCode(normalizeEol(text));
  const hits = [];
  for (const [re, why] of WEB_ADOPTION_RULES) {
    const m = body.match(re);
    if (m) hits.push(`${why} ("${m[0]}")`);
  }
  for (const para of body.split(/\n[ \t]*\n/)) {
    const m = para.match(WEB_SUPERLATIVE_RE);
    if (!m) continue;
    const quotedWithLink = para.split("\n").some((l) => /^\s*>/.test(l) && /\]\(https?:\/\/|https?:\/\//.test(l));
    if (!quotedWithLink) hits.push(`引用の無い比較・最上級の表現 ("${m[0]}")`);
  }
  for (const m of body.matchAll(WEB_LICENSE_REASONING_RE)) {
    const near = body.slice(Math.max(0, m.index - 300), m.index + m[0].length + 300);
    if (/ライセンス|商用利用/.test(near)) hits.push(`禁止の記載が無いことを根拠にしたライセンスの推測 ("${m[0]}")`);
  }
  return hits;
}
