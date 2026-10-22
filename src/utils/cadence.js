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

// 語の一覧・決まった言い回しでは、言い換えた頻度（週に3回更新・日々追加・朝8時に配信・every weekday）を拾えない。
// 頻度の主張は「繰り返しを表す時の表現」と「掲載・配信の動詞」が同じ文に並ぶ形なので、その組み合わせで拾う
const NUM = "[0-9０-９一二三四五六七八九十数]";
const TIME_UNIT = "(?:日|週|か?月|ヶ月|年|時間|分|朝|晩|夜|営業日)";
const WEEKDAY_JA = "[月火水木金土日]";
const WEEKDAY_EN = "(?:mon|tues|wednes|thurs|fri|satur|sun)days?";
export const RECURRENCE_RE = new RegExp(
  [
    String.raw`毎`,
    String.raw`${TIME_UNIT}\s*(?:ごと|おき|置き|毎)`,
    String.raw`隔${TIME_UNIT}|日々|連日|平日|週末|土日|休日`,
    String.raw`(?:週|月|年|日)\s*(?:に|あたり|当たり)?\s*${NUM}+\s*(?:回|本|件|度)`,
    String.raw`${NUM}+\s*(?:回|度)\s*(?:\/|／|ずつ)?`,
    String.raw`${WEEKDAY_JA}曜|${WEEKDAY_JA}\s*[・、,／/]\s*${WEEKDAY_JA}`,
    String.raw`[朝昼夕晩夜]\s*[0-9０-９]+\s*時|[朝夕晩夜]方|[0-9０-９]+\s*時(?:\s*[0-9０-９]+\s*分)?\s*(?:に|から|頃|ごろ)`,
    String.raw`[日週月]刊|[日週月]次|デイリー|ウィークリー|マンスリー|速報|定時`,
    String.raw`\b(?:bi-?|semi-?)?(?:daily|weekly|monthly|hourly|nightly)\b|\beveryday\b|\bfortnight`,
    String.raw`\b(?:every|each|per|a|once|twice|other)\s+(?:other\s+)?(?:day|week|month|morning|evening|night|hour|weekday|weekend|${WEEKDAY_EN})s?\b`,
    String.raw`\b(?:on|every)\s+${WEEKDAY_EN}\b|\bweekdays?\b|\bweekends?\b|\b\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.)|o'clock`,
  ].join("|"),
  "i",
);
export const PUBLISH_VERB_RE = /更新|配信|投稿|掲載|公開|追加|お届け|届け|届き|発信|配布|リリース|新着|取り上げ|まとめ|ダイジェスト|\b(?:updated?|updates|posts?|posted|publish(?:ed|es)?|add(?:ed|s)?|deliver(?:ed|s)?|releases?|released|digests?|sen[dt]|ship(?:ped|s)?|go(?:es)?\s+out)\b|\bnew\s+(?:posts?|reports?|articles?|entries)/i;

// 頻度・掲載本数の主張（文ごと）。決まった形（毎日・1日N本・直近N日の掲載）と、繰り返しの時の表現＋掲載の動詞の組み合わせ
export function findCadenceClaims(text) {
  const hits = [];
  for (const sentence of String(text || "").split(/(?<=[。！？!?\n])|(?<=\.)\s/)) {
    for (const re of [CADENCE_CLAIM_RE, PUBLISH_COUNT_RE]) {
      const m = sentence.match(re);
      if (m) hits.push(m[0]);
    }
    const r = sentence.match(RECURRENCE_RE);
    const v = r && sentence.match(PUBLISH_VERB_RE);
    if (v) hits.push(`${r[0]}…${v[0]}`);
  }
  return [...new Set(hits)];
}

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

// 数字を大きく出す表示（トップの指標）。[本数, 説明] の 2 行
export function cadenceMetricParts(facts) {
  return [`${facts.count} 本`, `直近${facts.days}日の掲載${facts.lastDate ? `（最終 ${facts.lastDate}）` : ""}`];
}
export const cadenceMetricText = (facts) => cadenceMetricParts(facts).join(" ");

// 週間ダイジェストの範囲の表示（WEEK_DAYS から作る）
export const weekWindowText = (days) => `直近${days}日間`;
