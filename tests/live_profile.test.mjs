// リポジトリの外にある公開文面（note のクリエイター紹介・メンバーシップの説明・X の自己紹介・GitHub の About）の正本は
// data/profile_copy.json。公開中の文面がそれと同じか、正本自体が裏付けのある語だけで書かれているかを確かめる。
// note・X・GitHub には接続しない（取得した値は fixture）。取得できない面は unknown で、ok にしない
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { PROFILE_SURFACES, copyProblems, liveProfileVerdicts, liveProfileReport, normalizeCopy, membershipClaimProblems, renderSurface } from "../scripts/live_profile_check.mjs";
import { TERMS, placeholders, termEvidenceProblems, vocabularyProblems } from "../scripts/utils/profile_vocabulary.mjs";

const COPY = JSON.parse(fs.readFileSync("data/profile_copy.json", "utf8"));
const withStatement = (id, text) => ({ ...COPY, statements: { ...COPY.statements, [id]: text } });

// 公開中の値が正本どおりの状態（note の API は説明文の改行の後に空白を入れて返す。X は URL を t.co に置き換える）
function liveFromCopy(copy, over = {}) {
  const r = (id) => renderSurface(copy, PROFILE_SURFACES.find((s) => s.id === id).path);
  return {
    noteProfile: r("noteProfile").replace(/\n/g, "\n    "),
    circleName: r("circleName"),
    circleDescription: r("circleDescription").replace(/\n/g, "\n  "),
    planName: r("planName"),
    planDescription: r("planDescription"),
    xBio: r("xBio").replace(/https?:\/\/\S+/g, "https://t.co/abc123"),
    githubDescription: r("githubDescription"),
    githubHomepage: r("githubHomepage"),
    paidNotes: 36,
    membershipConnected: 3,
    ...over,
  };
}

test("正本 data/profile_copy.json はすべての面を、登録された文の組み合わせとして持ち、正本自体に問題が無い", () => {
  for (const s of PROFILE_SURFACES) assert.ok(String(renderSurface(COPY, s.path) || "").trim(), `${s.id} の文面が正本に無い`);
  assert.deepEqual(copyProblems(COPY), []);
});

test("語の裏付け: 登録した語はすべて、その語の根拠になるコード・設定の中に根拠が実在する", () => {
  assert.deepEqual(termEvidenceProblems(), []);
  // 根拠のファイルから根拠が消えたら（機能が変わったら）、その語を使う文面は正本に置けない
  const gone = termEvidenceProblems(() => "");
  assert.equal(gone.length, TERMS.length, gone.join("\n"));
});

test("面の形: 面は登録された文の id の並びだけ。面に直接書いた文・知らない id は問題", () => {
  const free = structuredClone(COPY);
  free.surfaces["note.plan.description"] = "有料記事はどれでも追加料金なしで読めます";
  assert.match(copyProblems(free).join("\n"), /note\.plan\.description/);
  const unknownId = structuredClone(COPY);
  unknownId.surfaces["x.bio"] = [...unknownId.surfaces["x.bio"], "hype"];
  assert.match(copyProblems(unknownId).join("\n"), /x\.bio.*hype/);
});

// 2026-10-22 の検証で、語の一覧（毎朝・読み放題・最速 など）を言い換えるとすり抜けた文。
// 裏付けの無い語・数字・記号を使う文は、どんな言い回しでも正本に置けない（既知の言い回しを並べて止めるのではない）
test("正本の文: 裏付けの無い語・数字・記号を含む文は、言い回しによらず問題（言い換えた全記事・頻度・誇張の主張）", () => {
  for (const [id, text] of [
    ["membership", "これまでの有料記事（36本）をまるごと読めます。"],
    ["membership", "有料記事はどれでも追加料金なしで読めます。"],
    ["subject", "平日は朝7時に新着を配信。GitHub で注目を集めているオープンソースを、README などの公開情報をもとに日本語で解説しています。"],
    ["subject", "業界トップクラスの速さで GitHub で注目を集めているオープンソースを解説しています。"],
    ["subject", "GitHub で注目を集めているオープンソースを、すべて日本語で解説しています。"],
    ["aiMade", "記事は AI が生成したもので、動作は検証していません🥇"],
  ]) {
    const p = copyProblems(withStatement(id, text));
    assert.ok(p.some((x) => x.startsWith(`statements.${id}:`)), `${text}\n${p.join("\n")}`);
  }
});

// 性質の検査: 記事の生成に使っている指示文（scripts/crawl_and_generate.mjs）の語のうち、登録していない語は、
// どれを正本の文に足しても問題になる（誇張・宣伝の語を多く含む実在の語彙から作る。手で並べた例ではない）
test("正本の文: 生成の指示文に出てくる未登録の語は、どれを文に足しても問題になる", () => {
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  const seg = new Intl.Segmenter("ja", { granularity: "word" });
  const words = new Set();
  for (const m of src.matchAll(/[\p{Script=Han}\p{Script=Katakana}ー]{2,}/gu)) {
    for (const s of seg.segment(m[0])) if (s.isWordLike && s.segment.length >= 2) words.add(s.segment);
  }
  const unregistered = [...words].filter((w) => vocabularyProblems(w).length > 0);
  assert.ok(unregistered.length >= 50, `試せる語が少ない: ${unregistered.length}`);
  const missed = unregistered.filter((w) => copyProblems(withStatement("subject", `${COPY.statements.subject}${w}。`)).length === 0);
  assert.deepEqual(missed, []);
});

test("語の検査: 登録した語・文法の語・句読点・差し込み（{site} など）だけの文は問題なし。数字・記号は問題", () => {
  for (const t of Object.values(COPY.statements)) assert.deepEqual(vocabularyProblems(t, placeholders(COPY.names)), [], t);
  assert.ok(vocabularyProblems("記事は 100 本あります").length > 0, "数字は差し込みでしか書けない");
  assert.ok(vocabularyProblems("+30% の記事").length > 0);
  assert.ok(vocabularyProblems("記事は {unknown} です").length > 0, "知らない差し込み");
});

test("名前（プラン名）: カタカナ・ラテン文字だけの短い名前。漢字・数字・長い文は問題", () => {
  for (const plan of ["最強プラン", "全記事読み放題プラン", "プラン 2026", "毎日更新されるメンバーシッププランの名前がとても長い"]) {
    const bad = structuredClone(COPY);
    bad.names.plan = plan;
    assert.ok(copyProblems(bad).length > 0, plan);
  }
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

test("メンバーシップで「全記事・全アーカイブ読み放題」と言えるのは、有料記事がすべて特典に入っているときだけ（どの面でも確かめる）", () => {
  const claim = "毎朝配信される全有料技術レポートの読み放題\n過去の全アーカイブ閲覧権";
  assert.ok(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: 3 }).length > 0);
  assert.deepEqual(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: 36 }), []);
  // note の API は説明文を途中で改行して返す（「すべて読み\n  放題」2026-10-22 の実測）
  assert.ok(membershipClaimProblems("レポートがすべて読み\n  放題になります", { paidNotes: 36, membershipConnected: 3 }).length > 0);
  assert.ok(membershipClaimProblems(claim, { paidNotes: 36, membershipConnected: undefined }).length > 0);
  // 公開中の説明が「全有料レポート読み放題」で、3 / 36 本しか特典に入っていない状態（2026-10-22 の実測）は bad。
  // 面に印を付けて選ぶのではなく、すべての面で確かめる
  for (const id of PROFILE_SURFACES.map((s) => s.id)) {
    const v = liveProfileVerdicts(COPY, liveFromCopy(COPY, { [id]: `${liveFromCopy(COPY)[id]}\n${claim}` }));
    assert.equal(v[id].status, "bad", id);
    assert.match(v[id].reason, /読み放題|全/, id);
  }
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
