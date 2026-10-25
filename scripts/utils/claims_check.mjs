// 禁止表現・誇張表現の統一バリデーター（クローラー生成時とテスト・監査で同一定義を共用）
import { normalizeEol } from "./eol.mjs";
import { HYPE_RULES } from "./hype_check.mjs";

export const FORBIDDEN = [
  [/想定受託単価|推奨受託単価/, "スター数・カテゴリから機械的に決めた受託単価"],
  [/完全保存版|ドル箱|完全無人化|完全網羅/, "根拠のない誇張"],
  [/Trending直結/, "GitHub Trending ではなく検索 API で収集している"],
  [/社内稟議テンプレ付|社内稟議・提案書ドラフト|見積内訳付き/, "無料部分・画像に含まれない有料特典の表示"],
  [/累計[\d,]+\+? ?Stars/, "集計していないスター数の合計"],
  [/即受注|受注に直結|に直結します/, "成果や受注を保証する表現"], // tests/boundaries.test.mjs の有料本文の検査と同じ範囲
  [/100%経費精算可能/, "所属先規定に依存する断定"],
  [/専任エンジニアチーム/, "運営実態と異なる表現"],
  [/月収[\d,]+万|月[\d,]+万円(?:以上)?(?:を)?(?:稼|の収入|の利益|の売上|達成)|誰でも稼げる|確実に稼げる|確実に儲かる/, "根拠のない収益保証・誇張"],
  [/案件単価|単価[\d,]+万/, "根拠のない案件の単価の表示"],
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
  [/本番環境への導入(?!には|に(?:は|あたって|際して|向けて)|前|の前|の際)/, "本番環境で使うことを勧める表現"],
  [/(?:導入|採用|活用|移行|検討)(?:は|が|こそ)?(?:もはや)?必須(?:です|と言え|でしょう)/, "導入を必須とする助言"],
  [/判定[^\n]{0,8}?(?:ADOPT|TRIAL|ASSESS|HOLD)|推奨(?:活用)?フェーズ/, "ADOPT・TRIAL などの採用判定・推奨の段階の表示"],
];

// 比較・最上級の表現。同じ段落に README 等をリンク付きで引用（> の行）している場合だけ認める
export const WEB_SUPERLATIVE_WHY = "引用の無い比較・最上級の表現";
export const WEB_SUPERLATIVE_RE = /優位|最速|上回る|上回り|上回っ|圧倒的|凌駕/;

// ライセンスの推測（禁止の記載が無いことを利用できる根拠にする）
export const WEB_LICENSE_REASONING_WHY = "禁止の記載が無いことを根拠にしたライセンスの推測";
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
    if (!quotedWithLink) hits.push(`${WEB_SUPERLATIVE_WHY} ("${m[0]}")`);
  }
  for (const m of body.matchAll(WEB_LICENSE_REASONING_RE)) {
    const near = body.slice(Math.max(0, m.index - 300), m.index + m[0].length + 300);
    if (/ライセンス|商用利用/.test(near)) hits.push(`${WEB_LICENSE_REASONING_WHY} ("${m[0]}")`);
  }
  return hits;
}

// ---- サイトの運営者の文（記事本文の外: ページの見出し・案内・ボタン・meta・llms.txt）が約束してはいけないこと ----
// 速さ（即時・N秒で）、無料のサービス、検査・除外の網羅（一切・すべて・100%）は、運営の実態やコードで裏付けられない。
// 手で書いた約束（「即時見積もり」「1秒で試算」「無料相談」「言い回しにかかわらず一切公開しません」）が、事実の確認なしに残った（2026-10-22）
export const SITE_PROMISE_RULES = [
  [/\d+\s*(?:秒|分)(?:で|以内)|即(?:時|日|座)|瞬時|\binstant(?:ly)?\b/i, "速さを約束する表現（処理・対応にかかる時間は保証できない）"],
  // 返信・対応の速さ（24時間以内にご返信・当日中に回答・翌営業日までに連絡・速やかに対応・reply within 1 business day）。
  // 期限を表す語と返信・対応の動詞が同じ文に並ぶ形で拾う（「即時」だけを止めると、言い換えた期限の約束が残る）
  [
    new RegExp(
      (() => {
        const due = String.raw`\d+\s*(?:秒|分|時間|日|営業日|週間)\s*(?:以内|内に|中に|で|後に|ほどで|までに)|当日|翌(?:営業)?日|今日中|本日中|すぐ(?:に)?|直ちに|速やか|迅速|最短|\bwithin\s+(?:\d+|one|a|an|24)\b|\bsame[- ]day\b|\bnext[- ](?:business[- ])?day\b|\basap\b|\bpromptly\b|\bright\s+away\b`;
        const act = String.raw`返信|回答|対応|納品|連絡|返事|返答|お届け|ご案内|お見積|\brepl(?:y|ies)\b|\brespon(?:d|se)|\bturnaround\b|\bdeliver|\bget\s+back\b`;
        return `(?:${due})[^。\\n]{0,40}?(?:${act})|(?:${act})[^。\\n]{0,40}?(?:${due})`;
      })(),
      "i",
    ),
    "返信・対応の速さを約束する表現（運営者の対応にかかる時間は保証できない）",
  ],
  [/無料(?:で)?(?:相談|診断|見積|サポート|導入|構築|対応)|\bfree\s+(?:consultation|quote|estimate|support)\b/i, "無料のサービスを約束する表現"],
  [
    /一切|言い回し(?:に|を)?(?:かかわらず|問わず)|(?:すべて|全て|あらゆる|いかなる|どんな)[^。\n]{0,20}(?:検査|検出|除外|排除|ブロック|取り除|防|止め)|100\s*[%％]|漏れなく|完全に(?:検査|防|排除|除外|検出)|必ず(?:検出|除外|止め|防)|\bnever\s+publish|\bguarantee/i,
    "検査・除外の網羅を保証する表現（規則に無い言い回しは検出できない）",
  ],
];

export function findSitePromises(text) {
  const hits = [];
  for (const [re, why] of SITE_PROMISE_RULES) {
    const m = String(text || "").match(re);
    if (m) hits.push(`${why} ("${m[0]}")`);
  }
  return hits;
}

// ---- 公開している「自動で検査していること」の一覧（src/pages/about.astro が表示する） ----
// 一覧は上の規則（と hype_check.mjs の HYPE_RULES）から作る。手で書くと、規則より広い範囲を保証する文になる
// （「誇張表現は公開しません」と書いていたが、規則に無い「革新的」「極限」は検出されず残った。2026-10-22）。
// 検出する語そのものはページに載せない（載せると、そのページ自体が配信物の検査に当たる）。定義はリポジトリのソースを示す
const uniqueWhys = (rules, whyAt = 1) => [...new Set(rules.map((r) => r[whyAt]))].map((why) => ({ why }));

export const PUBLIC_CHECK_GROUPS = [
  { name: "禁止表現", source: "scripts/utils/claims_check.mjs", scope: "生成時に当たった原稿は公開しません。掲載中の記事とサイトの配信物もテストで検査します。", rules: uniqueWhys(FORBIDDEN) },
  { name: "誇張・結果保証の表現", source: "scripts/utils/hype_check.mjs", scope: "生成時に当たった原稿は公開しません。掲載中の Web 記事とサイトの配信物もテストで検査します。", rules: uniqueWhys(HYPE_RULES, 2) },
  { name: "導入・採用を勧める表現", source: "scripts/utils/claims_check.mjs", scope: "生成時に当たった Web 記事は公開しません。掲載中の Web 記事とサイトの配信物もテストで検査します。", rules: uniqueWhys(WEB_ADOPTION_RULES) },
  { name: "比較・最上級の表現", source: "scripts/utils/claims_check.mjs", scope: "同じ段落に README の該当箇所をリンク付きで引用していない Web 記事は公開しません。", rules: [{ why: WEB_SUPERLATIVE_WHY }] },
  { name: "ライセンスの推測", source: "scripts/utils/claims_check.mjs", scope: "ライセンス・商用利用の文脈で当たった Web 記事は公開しません。", rules: [{ why: WEB_LICENSE_REASONING_WHY }] },
  { name: "サイトの案内文の約束", source: "scripts/utils/claims_check.mjs", scope: "記事本文以外のサイトの文（見出し・案内・ボタン・説明文）をテストで検査します。", rules: uniqueWhys(SITE_PROMISE_RULES) },
];
