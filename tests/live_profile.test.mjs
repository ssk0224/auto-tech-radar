// リポジトリの外にある公開文面（note のクリエイター紹介・メンバーシップの説明・X の自己紹介・GitHub の About）の正本は
// data/profile_copy.json。公開中の文面がそれと同じか、正本自体が事実どおりか（毎朝・全記事読み放題などを言わないか）を確かめる。
// note・X・GitHub には接続しない（取得した値は fixture）。取得できない面は unknown で、ok にしない
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { PROFILE_SURFACES, copyProblems, liveProfileVerdicts, liveProfileReport, normalizeCopy, membershipClaimProblems } from "../scripts/live_profile_check.mjs";

const COPY = JSON.parse(fs.readFileSync("data/profile_copy.json", "utf8"));

// 公開中の値が正本どおりの状態（note の API は説明文の改行の後に空白を入れて返す）
function liveFromCopy(copy, over = {}) {
  return {
    noteProfile: copy.note.creatorProfile.replace(/\n/g, "\n    "),
    circleName: copy.note.circle.name,
    circleDescription: copy.note.circle.description.replace(/\n/g, "\n  "),
    planName: copy.note.plan.name,
    planDescription: copy.note.plan.description,
    xBio: copy.x.bio.replace(/https?:\/\/\S+/g, "https://t.co/abc123"),
    githubDescription: copy.github.description,
    githubHomepage: copy.github.homepage,
    paidNotes: 36,
    membershipConnected: 3,
    ...over,
  };
}

test("正本 data/profile_copy.json はすべての面の文面を持ち、それ自体が事実どおり（毎朝・毎日・全記事読み放題・誇張・禁止表現が無い）", () => {
  for (const s of PROFILE_SURFACES) assert.ok(String(s.copy(COPY) || "").trim(), `${s.id} の文面が正本に無い`);
  assert.deepEqual(copyProblems(COPY), []);
});

test("正本の検査は、毎朝・毎日の配信、根拠の無い最上級、全記事読み放題、GitHub Trending 由来とする文面を見つける", () => {
  const bad = structuredClone(COPY);
  bad.note.creatorProfile = "海外の急上昇OSSを毎朝徹底解剖";
  bad.x.bio = "世界最速のOSSメディア";
  bad.note.plan.description = "毎朝配信される全有料技術レポートの読み放題";
  bad.github.description = "GitHub Trending 直結の解説";
  const p = copyProblems(bad).join("\n");
  assert.match(p, /note\.creatorProfile.*毎朝/);
  assert.match(p, /x\.bio.*世界最速/);
  assert.match(p, /note\.plan\.description.*読み放題/);
  assert.match(p, /github\.description.*Trending/);
});

test("公開中の文面が正本と同じなら全部 ok（改行の後の空白・X の短縮 URL の違いは無視）", () => {
  const v = liveProfileVerdicts(COPY, liveFromCopy(COPY));
  for (const [id, r] of Object.entries(v)) assert.equal(r.status, "ok", `${id}: ${r.reason}`);
});

test("公開中の文面が正本と違えば bad（どの面が違うかを返す）", () => {
  const v = liveProfileVerdicts(COPY, liveFromCopy(COPY, { noteProfile: "海外の急上昇OSSを毎朝徹底解剖", githubDescription: "世界最速のAIエージェント・急上昇OSS解体新書" }));
  assert.equal(v.noteProfile.status, "bad");
  assert.equal(v.githubDescription.status, "bad");
  assert.equal(v.xBio.status, "ok");
});

test("取得できなかった面は unknown（ok にしない）", () => {
  const v = liveProfileVerdicts(COPY, liveFromCopy(COPY, { xBio: undefined, planDescription: null, membershipConnected: undefined }));
  assert.equal(v.xBio.status, "unknown");
  assert.equal(v.planDescription.status, "unknown");
  assert.equal(v.membership.status, "unknown");
});

test("メンバーシップで「全記事・全アーカイブ読み放題」と言えるのは、有料記事がすべて特典に入っているときだけ", () => {
  const claim = "毎朝配信される全有料技術レポートの読み放題\n過去の全アーカイブ閲覧権";
  assert.ok(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: 3 }).length > 0);
  assert.deepEqual(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: 36 }), []);
  // note の API は説明文を途中で改行して返す（「すべて読み\n  放題」2026-10-22 の実測）。改行・空白で分かれていても見つける
  assert.ok(membershipClaimProblems("レポートがすべて読み\n  放題になります", { paidNotes: 36, membershipConnected: 3 }).length > 0);
  assert.match(copyProblems({ ...COPY, x: { ...COPY.x, bio: "毎\n 朝 お届け" } }).join(), /x\.bio.*毎朝/);
  // 本数が分からないときは言えるかどうかも分からない（問題として扱う）
  assert.ok(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: undefined }).length > 0);
  // 限定した言い方（特典に追加した記事）は本数によらず問題ない
  assert.deepEqual(membershipClaimProblems("メンバーシップ特典に追加した有料記事を読めます", { paidNotes: 36, membershipConnected: 3 }), []);
  // 公開中の説明が「全有料レポート読み放題」で、3 / 36 本しか特典に入っていない状態（2026-10-22 の実測）は bad
  const v = liveProfileVerdicts(COPY, liveFromCopy(COPY, { circleDescription: `${COPY.note.circle.description}\n${claim}` }));
  assert.equal(v.circleDescription.status, "bad");
  assert.match(v.circleDescription.reason, /読み放題|全/);
});

test("報告: bad / unknown が 1 つでもあれば ::error を出して終了コード 1。全部 ok なら 0", () => {
  const okR = liveProfileReport(liveProfileVerdicts(COPY, liveFromCopy(COPY)));
  assert.equal(okR.exitCode, 0);
  assert.ok(!okR.lines.some((l) => l.startsWith("::error")));
  const badR = liveProfileReport(liveProfileVerdicts(COPY, liveFromCopy(COPY, { xBio: undefined, noteProfile: "違う" })));
  assert.equal(badR.exitCode, 1);
  assert.ok(badR.lines.some((l) => l.startsWith("::error") && /xBio/.test(l) && /未計測/.test(l)), badR.lines.join("\n"));
  assert.ok(badR.lines.some((l) => l.startsWith("::error") && /noteProfile/.test(l)));
});

test("live-check.yml: 定期と手動で公開中の文面（プロフィール類・note の無料部分）を確かめ、違う・未計測なら失敗。サイトの公開とは別で、書き込み権限を持たない", () => {
  const wf = fs.readFileSync(".github/workflows/live-check.yml", "utf8").replace(/\r\n/g, "\n");
  assert.match(wf, /\n  schedule:\n    - cron: "[^"]+"/);
  assert.match(wf, /\n  workflow_dispatch:/);
  // 書き込み権限が無い（commit・push・Pages の公開をしない）
  assert.match(wf, /\npermissions:\n  contents: read\n/);
  assert.doesNotMatch(wf, /contents: write|pages: write|deploy-pages|upload-pages-artifact|git push|git commit/);
  // 2 つの検査を両方走らせ（片方が赤でももう片方を確かめる）、どちらかが成功でなければ最後に失敗にする
  assert.match(wf, /id: profile\n\s+continue-on-error: true[\s\S]*?run: node scripts\/live_profile_check\.mjs/);
  assert.match(wf, /id: notes\n\s+continue-on-error: true[\s\S]*?run: node scripts\/sync_note_urls\.mjs/);
  assert.match(wf, /if: \$\{\{ steps\.profile\.outcome != 'success' \|\| steps\.notes\.outcome != 'success' \}\}\n\s+run: \|[\s\S]*?exit 1/);
  // サイトの公開の workflow は、この検査に依存しない（公開を止めない）
  assert.doesNotMatch(fs.readFileSync(".github/workflows/daily-crawl.yml", "utf8"), /live_profile_check|live-check/);
});

test("比較の正規化: 全角半角・空白・改行の違いは無視し、文字の違いは残す", () => {
  assert.equal(normalizeCopy("Ａ  B\n   C"), normalizeCopy("A B C"));
  assert.notEqual(normalizeCopy("毎朝"), normalizeCopy("毎日"));
});
