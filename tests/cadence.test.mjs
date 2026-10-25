// 更新頻度の表示は、手書きの「毎日更新」ではなく掲載中の記事の公開日から数える
import test from "node:test";
import assert from "node:assert/strict";
import { cadenceFacts, cadenceText, findCadenceClaims, CADENCE_CLAIM_RE, CADENCE_WINDOW_DAYS, PUBLISH_COUNT_RE } from "../src/utils/cadence.js";

const NOW = Date.parse("2026-10-22T06:17:00+09:00");

test("直近30日（日本時間・今日を含む）の掲載本数・掲載のあった日数・最終掲載日を、公開日から数える", () => {
  // 10-09 に 3 本まとめて掲載、10-20 は 0 本、9-22 は 30 日の外（今日を含めて 31 日目）
  const dates = ["2026-10-09", "2026-10-09", "2026-10-09", "2026-10-21", "2026-10-22", "2026-09-22", "2026-09-23"];
  const f = cadenceFacts(dates, NOW);
  assert.equal(f.days, CADENCE_WINDOW_DAYS);
  assert.equal(f.count, 6);
  assert.equal(f.activeDays, 4);
  assert.equal(f.lastDate, "2026-10-22");
});

test("未来の日付・不正な日付は数えない（生成スクリプトの誤った日付で本数を水増ししない）", () => {
  const f = cadenceFacts(["2026-10-23", "", null, "2026-13-01", new Date("2026-10-20")], NOW);
  assert.equal(f.count, 1);
  assert.equal(f.lastDate, "2026-10-20");
});

test("表示文は数えた値だけを述べ、頻度を約束する語を使わない。0 本なら 0 本と出す", () => {
  const text = cadenceText(cadenceFacts(["2026-10-21", "2026-10-22"], NOW));
  assert.equal(text, "直近30日の掲載: 2本（掲載のあった日: 2日・最終掲載: 2026-10-22）");
  assert.doesNotMatch(text, CADENCE_CLAIM_RE);
  assert.equal(cadenceText(cadenceFacts([], NOW)), "直近30日の掲載: 0本");
});

test("頻度の語の検出は、書き方を変えても拾う（毎日・毎朝・Daily・every morning・速報・1日最大）", () => {
  for (const s of ["毎日更新", "毎朝AIが", "Daily updates", "updated every morning", "最新レーダー速報", "新着は1日最大1本", "定時クロール", "日次で更新"]) {
    assert.match(s, CADENCE_CLAIM_RE, s);
  }
  for (const s of ["直近30日の掲載: 3本", "週間ダイジェスト", "定期購読", "月額1,980円", "未設定時は GITHUB_TOKEN を使用"]) assert.doesNotMatch(s, CADENCE_CLAIM_RE, s);
});

test("頻度の語は語の一覧ではなく形（毎＋時の単位・時の単位＋ly・every/each＋時の単位・N本／日・カタカナの頻度語）で拾う", () => {
  for (const s of ["（デイリー更新）", "新着は毎夕に追加", "Updated everyday", "1日1本ずつ追加", "毎日更新中", "毎営業日に配信", "nightly builds of the radar", "updated each morning", "3本/日のペースで", "ウィークリーでお届け", "2 posts per day", "日に2本"]) {
    assert.match(s, CADENCE_CLAIM_RE, s);
  }
  for (const s of ["1本ずつ差し替えられます", "月額保守", "週間ダイジェスト", "定期購読", "1日以上たったリポジトリ", "30日あたりのスター増加数"]) assert.doesNotMatch(s, CADENCE_CLAIM_RE, s);
});

test("掲載本数を述べる形（直近N日の掲載・公開がN本）を拾い、掲載本数と関係のない期間の記述は拾わない", () => {
  for (const s of ["直近30日の掲載: 99本", "過去7日間に公開された記事", "この1週間で12本を掲載", "新着 5 件"]) assert.match(s, PUBLISH_COUNT_RE, s);
  for (const s of ["直近 30 日間のスターの伸び", "全 39 本の技術レポート", "作成から 7 日以上", "Zenn の公開状態を 1 本も確認できませんでした", "同じオーナーの記事を直近 30 日以内に 1 本掲載済み"]) assert.doesNotMatch(s, PUBLISH_COUNT_RE, s);
});

test("頻度は語の一覧でなく「繰り返しの時の表現」と「掲載・配信の動詞」が同じ文にあるかで拾う（週に3回更新・日々追加・朝8時に配信・every weekday）", () => {
  for (const s of [
    "週に3回更新しています",
    "New reports are added every weekday.",
    "週1回のまとめをお届けします",
    "新しいレポートが日々追加されます",
    "レーダーは朝8時に配信",
    "隔日で追加",
    "24時間ごとに更新",
    "1日ごとに新着",
    "bi-weekly digest",
    "3 new posts a week",
    "月・水・金に配信",
    "土日を除き新着を公開",
    "平日の夕方にまとめて掲載",
    "We publish on Mondays and Thursdays",
    "週２回のペースで記事を追加",
    "3日おきに投稿",
    "posts go out twice weekly",
  ]) {
    assert.ok(findCadenceClaims(s).length > 0, s);
  }
  for (const s of [
    "X投稿にPRO実務キットが丸ごと漏洩しています",
    "設定変更が行われるごとに git push を実行",
    "日々の技術キャッチアップにご活用ください",
    "定期購読",
    "同じオーナーの記事を直近 30 日以内に 1 本掲載済み",
    "公開日: 2026-10-22",
    "週間ダイジェスト",
    "throw new Error('置き換えられません')",
  ]) {
    assert.deepEqual(findCadenceClaims(s), [], s);
  }
});
