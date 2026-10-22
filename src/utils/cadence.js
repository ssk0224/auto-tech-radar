// 更新頻度の表示。「毎日更新」のような手書きの頻度は、生成が止まった日・まとめて掲載した日に事実と食い違う。
// 頻度は掲載中の記事の公開日（pubDate）から数えて出し、手書きの頻度の語はこのファイルと Cadence コンポーネントの外に書かない（tests/docs_facts.test.mjs）
import { dateLabel, jstDayStart, withinLastDays } from "./dates.js";

// 更新頻度を述べる言い方。語の一覧ではなく、頻度の「形」で拾う（書き方を変えた頻度の約束も拾うため）:
// 「毎＋時の単位」「日刊・日次・デイリー」のような周期の語、「1日N本・N本/日」のような量、「daily・every morning」、速報・定時。Cadence の外でこれに当たる文はテストで止める
const UNIT_JA = "(?:朝|昼|夕|晩|夜|日|週|月|年|時|営業日)";
const UNIT_EN = "(?:day|morning|night|evening|week|hour|month)";
const COUNT = "(?:本|件|回|記事|投稿|posts?|articles?|updates?)";
export const CADENCE_CLAIM_RE = new RegExp(
  [
    String.raw`毎${UNIT_JA}`,
    String.raw`[日週月]刊|[日週月]次|連日`,
    String.raw`デイリー|ウィークリー|マンスリー|ナイトリー|アワリー`,
    String.raw`速報|(?:随時|常時|定期)(?:更新|配信|投稿|掲載)|(?<![設所予限])定時`,
    String.raw`(?:1|１|一)\s*日\s*(?:最大|最低|に|あたり)?\s*\d*\s*${COUNT}`,
    String.raw`日に\s*\d+\s*${COUNT}`,
    String.raw`\d+\s*${COUNT}\s*(?:\/|／|per|毎|a)\s*(?:日|週|${UNIT_EN})`,
    String.raw`(?<![\w/.-])(?:daily|weekly|nightly|hourly|monthly|everyday)(?![\w/.-])`,
    String.raw`\b(?:every|each)\s+(?:single\s+)?${UNIT_EN}\b`,
    String.raw`\b(?:once|twice|\d+\s*times)\s+(?:a|per)\s+${UNIT_EN}\b`,
  ].join("|"),
  "i",
);

// 掲載本数を述べる形（「直近30日の掲載: N本」「過去7日間に公開」「新着 5 件」）。掲載データから数えた表示（data-derived の要素）以外に書かない
export const PUBLISH_COUNT_RE = new RegExp(
  [
    String.raw`(?:直近|過去|最近|この)\s*\d+\s*(?:日|週間|か月|ヶ月)間?(?!\s*以内)[^。\n]{0,8}(?:掲載|公開|更新|新着|追加)`,
    String.raw`(?:掲載|公開|新着|追加)(?:数|本数|件数|記事)?\s*[:：は]?\s*\d+\s*(?:本|件|記事)`,
    // 「N 日以内に M 本掲載済み」は選定の条件（criteria の規則）で、掲載本数の主張ではない
    String.raw`(?<!以内に\s*)(?<!\d)\d+\s*(?:本|件)(?:の記事)?を?(?:掲載|公開|追加)`,
  ].join("|"),
  "i",
);

export const CADENCE_WINDOW_DAYS = 30;

// 公開日の一覧から、直近 days 日（日本時間・今日を含む）の掲載本数・掲載のあった日数・最終掲載日を数える
export function cadenceFacts(pubDates, nowMs = Date.now(), days = CADENCE_WINDOW_DAYS) {
  const inWindow = (pubDates || [])
    .map((d) => dateLabel(d))
    .filter((d) => d && withinLastDays(jstDayStart(d), nowMs, days));
  const sorted = [...inWindow].sort();
  return { days, count: inWindow.length, activeDays: new Set(inWindow).size, lastDate: sorted.at(-1) || null };
}

export function cadenceText(facts) {
  const head = `直近${facts.days}日の掲載: ${facts.count}本`;
  return facts.count > 0 ? `${head}（掲載のあった日: ${facts.activeDays}日・最終掲載: ${facts.lastDate}）` : head;
}
