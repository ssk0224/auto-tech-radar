// 更新頻度の表示。「毎日更新」のような手書きの頻度は、生成が止まった日・まとめて掲載した日に事実と食い違う。
// 頻度は掲載中の記事の公開日（pubDate）から数えて出し、手書きの頻度の語はこのファイルと Cadence コンポーネントの外に書かない（tests/docs_facts.test.mjs）
import { dateLabel, jstDayStart, withinLastDays } from "./dates.js";

// 更新頻度を述べる語（頻度を約束する言い方）。Cadence の外でこれに当たる文はテストで止める
export const CADENCE_CLAIM_RE = /毎朝|毎日|毎晩|毎週|毎時|日刊|日次|(?<![設所予限])定時|速報|1日最大|\bdaily\b|every\s+(?:day|morning)/i;

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
