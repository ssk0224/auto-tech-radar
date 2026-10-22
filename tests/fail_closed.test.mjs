// 「測れなかった」を「正常・0・空・確定失敗」に潰さない（fail-closed）ことを、クラスとして確かめる門。
// 2026-10-22 の洗い出しで、取得失敗・解析失敗・位置不明が [] / {} / null / false / "failed" に潰れ、下流が「問題なし」と読む不具合が 9 件見つかった
// （note の有料ライン監視が 37 本中 24 本で盲目、Zenn の確認・X の投稿・候補の検索・台帳・参照確認・出品履歴の読み込み・マージドライバ）。
//
// 1. 対象は手で並べず、コードから導く: 外部に問い合わせる（fetch を呼ぶ）スクリプト、git のマージドライバ（scripts/utils/git_sync.mjs の設定）、
//    公開前の監査（package.json の build / audit が実行するスクリプト）。
// 2. 対象のスクリプトはすべて、下の FAULTS に故障注入の確かめ方を持つ（新しく fetch を呼ぶスクリプトを足すと、登録するまでこのテストが赤になる）。
//    故障は HTTP 429 / 403 / 5xx・通信の例外・壊れた JSON・必須項目の欠落。結果が ok・空・「問題なし」にならず、unknown / 失敗として表に出ることを確かめる。
// 3. 形の検査: 対象のスクリプトに、何もしない catch（catch (e) {}）を置かない（捨ててよい理由があるなら、その理由を catch の中に書く）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { readText } from "./helpers/read_src.mjs";

const root = path.resolve(import.meta.dirname, "..");
const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

// 外部に問い合わせるスクリプト（fetch / fetchImpl を呼ぶもの）
const NETWORK_CALL = /\bfetch(?:Impl)?\s*\(/;
export function networkScripts() {
  return walk(path.join(root, "scripts")).filter((f) => /\.(mjs|js)$/.test(f) && NETWORK_CALL.test(fs.readFileSync(f, "utf8"))).map(rel);
}
// git のマージドライバ（共有の状態ファイルを機械的に合わせる。読めない入力を空として合わせると記録が消える）
export function mergeDrivers() {
  return [...readText("scripts/utils/git_sync.mjs").matchAll(/node (scripts\/[\w/.-]+\.mjs) %O %A %B/g)].map((m) => m[1]);
}
// 公開前の監査（package.json の build / audit が実行するスクリプト）
export function auditScripts() {
  const s = JSON.parse(readText("package.json")).scripts;
  return [...`${s.build} ${s.audit}`.matchAll(/node (scripts\/[\w/.-]+\.mjs)/g)].map((m) => m[1]);
}
const TARGETS = [...new Set([...networkScripts(), ...mergeDrivers(), ...auditScripts()])].sort();

const res = (status, body = "") => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
const FAULTS_HTTP = [429, 403, 500, 503];
const throwing = async () => {
  throw new Error("fetch failed");
};
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// 別のテストファイルの、名前が name に当たるテスト（test("…") か、表から作るテストの名前の文字列）で確かめている（そのテストが消えたら赤）
const coveredBy = (file, name) => () => {
  const src = readText(file);
  const literals = [...src.matchAll(/(["'`])((?:(?!\1)[^\n])*)\1/g)].map((m) => m[2]);
  assert.ok(literals.some((n) => name.test(n)), `${file} に ${name} に当たるテストが無い`);
};

// マージドライバに壊れた入力を渡すと、失敗で終わり（git は衝突として止まる）、結果のファイルを書き換えない
function mergeDriverRejectsBrokenInput(script) {
  return () => {
    for (const broken of ["ours", "theirs"]) {
      const dir = tmp("atr-fc-merge-");
      try {
        const files = { base: path.join(dir, "base"), ours: path.join(dir, "ours"), theirs: path.join(dir, "theirs") };
        const good = '{"a": {"url": "https://note.com/u/n/n1", "note": true}}\n';
        fs.writeFileSync(files.base, good);
        fs.writeFileSync(files.ours, good);
        fs.writeFileSync(files.theirs, good);
        fs.writeFileSync(files[broken], '{"a": {"url": ');
        const before = fs.readFileSync(files.ours, "utf8");
        const r = spawnSync(process.execPath, [path.join(root, script), files.base, files.ours, files.theirs], { encoding: "utf8" });
        assert.notEqual(r.status, 0, `${script}: 壊れた ${broken} を空として合わせた`);
        assert.equal(fs.readFileSync(files.ours, "utf8"), before, `${script}: 失敗したのに結果を書き換えた`);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  };
}

const FAULTS = {
  "scripts/sync_note_urls.mjs": async () => {
    const { inspectPublishedNotes, fetchAllNotes, nextNoteUrlMap } = await import("../scripts/sync_note_urls.mjs");
    const draft = "# t\n\n## 概要\n無料部分の本文です。\n\n【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】\n<!-- PAID_SEALED: x 有料 -->\n";
    for (const fault of [...FAULTS_HTTP.map((s) => () => Promise.reject(new Error(`HTTP ${s}`))), throwing, async () => ({ name: "x" })]) {
      const r = await inspectPublishedNotes({ a: { url: "https://note.com/u/n/n1" } }, { fetchDetail: fault, readDraft: () => draft, delayMs: 0 });
      assert.equal(r.notes.a.freePart.status, "unknown");
      assert.equal(r.counts.unknown, 1);
      assert.equal(r.exitCode, 1);
    }
    for (const s of FAULTS_HTTP) await assert.rejects(fetchAllNotes({ fetchImpl: async () => res(s), delayMs: 0 }));
    await assert.rejects(fetchAllNotes({ fetchImpl: async () => res(200, { data: { contents: [] } }), delayMs: 0 }), /isLastPage/);
    assert.equal(nextNoteUrlMap({ a: 1, b: 1, c: 1, d: 1, e: 1 }, {}).replace, false);
  },
  "scripts/check_zenn.mjs": async () => {
    const { zennArticleResult, zennWarnings } = await import("../scripts/check_zenn.mjs");
    for (const f of [...FAULTS_HTTP.map((s) => async () => res(s)), throwing, async () => res(200, { article: {} }), async () => res(200, "not json")]) {
      assert.equal((await zennArticleResult("a", false, f)).live, null);
    }
    assert.ok(zennWarnings([{ slug: "a", published: false, live: false }, { slug: "b", published: false, live: null, status: 429 }]).length > 0);
  },
  "scripts/auto_tweet_x.mjs": async () => {
    const { classifyXResponse, postLatestTweet } = await import("../scripts/auto_tweet_x.mjs");
    for (const s of [402, 408, 425, 429, 500, 503]) assert.equal(classifyXResponse(s, ""), "retry", String(s));
    const dir = tmp("atr-fc-x-");
    try {
      fs.mkdirSync(path.join(dir, "scripts"));
      fs.mkdirSync(path.join(dir, "x_posts"));
      fs.writeFileSync(path.join(dir, "scripts/publish_history.json"), "{broken");
      const calls = [];
      const r = await postLatestTweet({ root: dir, env: { X_API_KEY: "k", X_API_SECRET: "s", X_ACCESS_TOKEN: "t", X_ACCESS_TOKEN_SECRET: "u" }, fetchImpl: async (u) => (calls.push(u), res(201)), log: () => {} });
      assert.equal(r.exitCode, 1);
      assert.deepEqual(calls, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
  "scripts/utils/reference_check.mjs": async () => {
    const { checkReferences } = await import("../scripts/utils/reference_check.mjs");
    for (const f of [...FAULTS_HTTP.map((s) => async () => res(s)), throwing]) {
      const r = await checkReferences("FROM node:20\nnpx -y some-pkg\npip install requests\n", { fetchImpl: f });
      assert.deepEqual(r.missing, []);
      assert.equal(r.unverified.length, 3);
    }
  },
  "scripts/snapshot_ledger.mjs": async () => {
    const { snapshotLedger } = await import("../scripts/snapshot_ledger.mjs");
    for (const f of [throwing, async () => res(429), async () => res(200, { incomplete_results: true, items: [] }), async () => res(500)]) {
      const dir = tmp("atr-fc-ledger-");
      try {
        const r = await snapshotLedger({ rootDir: dir, now: Date.parse("2026-10-21T03:00:00Z"), fetchImpl: f, delayMs: 0 });
        assert.equal(r.status, "partial");
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  },
  "scripts/live_profile_check.mjs": async () => {
    const { liveProfileVerdicts, liveProfileReport } = await import("../scripts/live_profile_check.mjs");
    const copy = JSON.parse(readText("data/profile_copy.json"));
    const v = liveProfileVerdicts(copy, { errors: { noteProfile: "HTTP 429" } });
    assert.ok(Object.values(v).every((x) => x.status === "unknown"));
    assert.equal(liveProfileReport(v).exitCode, 1);
  },
  "scripts/ping_search_engines.mjs": async () => {
    const { notifyIndexNow } = await import("../scripts/ping_search_engines.mjs");
    for (const f of [...FAULTS_HTTP.map((s) => async () => res(s)), throwing]) {
      const lines = [];
      const r = await notifyIndexNow(["https://example.invalid/a/"], { fetchImpl: f, log: (l) => lines.push(l) });
      assert.notEqual(r.status, "ok");
      assert.ok(lines.some((l) => l.startsWith("::warning")), lines.join("\n"));
    }
  },
  "scripts/alert_if_no_article.mjs": async () => {
    const { sendAlert } = await import("../scripts/alert_if_no_article.mjs");
    for (const f of [...FAULTS_HTTP.map((s) => async () => res(s)), throwing]) await assert.rejects(sendAlert({ repo: "a/b", token: "t", body: "x", fetchImpl: f }));
  },
  "scripts/utils/license_resolver.mjs": async () => {
    const { resolveLicense } = await import("../scripts/utils/license_resolver.mjs");
    for (const f of [...FAULTS_HTTP.map((s) => async () => res(s)), throwing]) assert.equal((await resolveLicense("a", "b", { fetchImpl: f })).status, "unknown");
  },
  // 生成スクリプトは読み込むと実行されるので、模擬の GitHub で動かすテスト（tests/generator.test.mjs）で確かめる
  "scripts/crawl_and_generate.mjs": coveredBy("tests/generator.test.mjs", /upstream_unavailable/),
  // オーナー端末で note を自動操作するスクリプト。実際の Chrome と模擬の note で確かめる
  "scripts/note_browser.mjs": () => {
    coveredBy("tests/note_browser.test.mjs", /note_status\.json）が壊れて読めない/)();
    coveredBy("tests/note_browser_safety.test.mjs", /直した記録のファイルが壊れていたら/)();
  },
  "scripts/browser/note_eyecatch.js": coveredBy("tests/note_eyecatch.test.mjs", /反映を読み直して確認する/),
  "scripts/merge_publish_history.mjs": mergeDriverRejectsBrokenInput("scripts/merge_publish_history.mjs"),
  "scripts/merge_note_urls.mjs": mergeDriverRejectsBrokenInput("scripts/merge_note_urls.mjs"),
  "scripts/merge_note_status.mjs": mergeDriverRejectsBrokenInput("scripts/merge_note_status.mjs"),
  "scripts/audit_quality.mjs": coveredBy("tests/gates.test.mjs", /出品履歴.*壊れて読めない/),
  "scripts/audit_dist.mjs": () => {
    const dir = tmp("atr-fc-dist-");
    try {
      const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), dir], { encoding: "utf8" });
      assert.notEqual(r.status, 0, "空の配信物を合格にした");
      const missing = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), path.join(dir, "none")], { encoding: "utf8" });
      assert.notEqual(missing.status, 0, "配信物が無いのに合格にした");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  },
};

test("登録: 外部に問い合わせる・状態ファイルを合わせる・公開前に監査するスクリプトは、すべて故障注入の表に載っている", () => {
  assert.ok(TARGETS.length >= 10, TARGETS.join(", "));
  assert.deepEqual(TARGETS.filter((f) => !(f in FAULTS)), [], "故障注入の表（FAULTS）に無いスクリプトがある");
  assert.deepEqual(Object.keys(FAULTS).filter((f) => !TARGETS.includes(f)), [], "表にあるが、対象でなくなった（または名前が変わった）スクリプトがある");
});

for (const file of Object.keys(FAULTS)) {
  test(`故障注入: ${file} は取得・解析の失敗を ok・空・問題なしにしない`, async () => {
    await FAULTS[file]();
  });
}

test("形: 対象のスクリプトに、何もしない catch（catch (e) {}）が無い", () => {
  const empty = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
  const offenders = [];
  for (const f of TARGETS) {
    const src = readText(f);
    for (const m of src.matchAll(empty)) offenders.push(`${f}:${src.slice(0, m.index).split("\n").length}`);
  }
  assert.deepEqual(offenders, []);
});
