// 公開中の note の無料部分が、リポジトリの原稿（正本）を描画したものと同じかを確かめる検査（scripts/sync_note_urls.mjs）。
// 「取得できない・原稿が無い・位置が分からない」は unknown（赤）で、ok にも「問題なし」にもしない。
// note.com には接続しない（記事 API の応答は fixture）
import test from "node:test";
import assert from "node:assert/strict";
import { parseDraftToNotePayload } from "../scripts/utils/note_html.mjs";
import { freePartVerdict, renderDraftFree } from "../scripts/utils/free_part.mjs";
import { inspectPublishedNotes, paidLineReport, fetchAllNotes, nextNoteUrlMap } from "../scripts/sync_note_urls.mjs";

const DRAFT = [
  "# 海外急上昇OSS「demo」解説",
  "",
  "## 概要",
  "これは無料部分の最初の段落です。**太字**と [リンク](https://example.com) を含みます。",
  "",
  "## なぜ今注目されているのか",
  "さらに無料の説明が続き、最後の無料の文で終わります。",
  "",
  "> ※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。",
  "",
  "【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】",
  "<!-- PAID_SEALED: demo_note.paid.enc 有料エリアは暗号化保存されています -->",
  "",
  "---",
  "### 🎁 【メンバーシップのご案内】",
  "メンバーシップの案内です。",
].join("\n");
const LIVE_OK = parseDraftToNotePayload(DRAFT, true).freeBody;

test("無料部分の検査: 原稿を描画したものと同じなら ok（書式・空白の違いは無視）", () => {
  const noIds = (h) => h.replace(/ (name|id)="[^"]*"/g, "");
  assert.equal(noIds(renderDraftFree(DRAFT)), noIds(LIVE_OK));
  assert.equal(freePartVerdict(LIVE_OK, DRAFT).status, "ok");
  // note の編集画面が付け直す属性・空白は違いとして数えない
  const reformatted = LIVE_OK.replace(/ (name|id)="[^"]*"/g, "").replace(/<\/p>/g, "</p>\n");
  assert.equal(freePartVerdict(reformatted, DRAFT).status, "ok");
});

test("無料部分の検査: 文言が原稿と違えば bad（古い言い回しが公開中に残っている）", () => {
  const stale = LIVE_OK.replace("なぜ今注目されているのか", "なぜ今世界中で爆発的に注目されているのか");
  const v = freePartVerdict(stale, DRAFT);
  assert.equal(v.status, "bad");
  assert.equal(v.kind, "text");
});

test("無料部分の検査: 原稿の無料部分より先まで見えていれば bad/past、手前で終わっていれば bad/short", () => {
  const past = freePartVerdict(`${LIVE_OK}<p>${"有料の本文です。".repeat(10)}</p>`, DRAFT);
  assert.equal(past.status, "bad");
  assert.equal(past.kind, "past");
  const short = freePartVerdict(LIVE_OK.slice(0, LIVE_OK.indexOf("<h2", 10)), DRAFT);
  assert.equal(short.status, "bad");
  assert.equal(short.kind, "short");
});

test("無料部分の検査: 原稿が無い・有料ラインの無い有料原稿・本文が取れない は unknown（ok にしない）", () => {
  for (const [body, draft] of [[LIVE_OK, ""], [LIVE_OK, null], [LIVE_OK, "# t\n\n有料ラインの無い原稿"], [undefined, DRAFT], ["", DRAFT]]) {
    const v = freePartVerdict(body, draft);
    assert.equal(v.status, "unknown", JSON.stringify([String(body).slice(0, 10), draft && draft.slice(0, 10)]));
    assert.ok(v.reason);
  }
});

test("無料のリードマグネットは本文全体を原稿と比べる", () => {
  const lead = "# 早見表\n\n無料の本文です。\n\n## 一覧\n- a\n- b\n\n---\n**【note出品時用 推奨ハッシュタグ】**\n#AI";
  const html = parseDraftToNotePayload(lead, false).freeBody;
  assert.equal(freePartVerdict(html, lead, { isPaid: false }).status, "ok");
  assert.equal(freePartVerdict(html.replace("無料の本文", "古い本文"), lead, { isPaid: false }).status, "bad");
});

test("有料ラインの位置: 原稿の末尾が見つからないときは inside ではなく unknown。長さで原稿より先まで見えるなら past", () => {
  const draft = "# T\n\n## 概要\nこれは無料部分の最初の段落です。とても大事な説明が続きます。\n\n## 詳細\nさらに無料の説明が続き、最後の無料の文で終わります。\n\n【有料ライン ここから先は有料】\n---\n### 🎁 【メンバーシップのご案内】\nx";
  const free = "<p>これは無料部分の最初の段落です。とても大事な説明が続きます。</p><h2>詳細</h2><p>さらに無料の説明が続き、最後の無料の文で終わります。</p>";
  assert.equal(paidLineReport(free, draft).position, "inside");
  // 末尾の文言が原稿と違う（古い案内のまま）うえに、有料部分まで見えている: 以前は pastDraft: false（見えていない扱い）だった
  const tailDiffers = `${free.replace("最後の無料の文で終わります", "最後の古い文で終わります")}<p>${"有料の秘密の内容です。".repeat(30)}</p>`;
  const r = paidLineReport(tailDiffers, draft);
  assert.equal(r.position, "past");
  assert.equal(r.pastDraft, true);
  // 末尾が違い、長さも原稿と同じくらい: 位置は分からない（unknown）
  assert.equal(paidLineReport(free.replace("最後の無料の文で終わります", "最後の古い文で終わります"), draft).position, "unknown");
});

// 記事 API の fixture。keys: 記事キー → 応答（body）または失敗（status / throw）
function detailFrom(table) {
  return async (key) => {
    const v = table[key];
    if (v instanceof Error) throw v;
    if (typeof v === "number") throw new Error(`HTTP ${v}`);
    return { name: "海外急上昇OSS「demo」解説", eyecatch: "x", body: v };
  };
}
const MAP = { demo: { url: "https://note.com/u/n/n0001" }, demo2: { url: "https://note.com/u/n/n0002" }, demo3: { url: "https://note.com/u/n/n0003" } };
const drafts = (slug) => (slug === "nodraft" ? null : DRAFT);

test("公開中の note の検査: 原稿と同じ記事だけが ok。違う・取得できない・原稿が無い記事は ::error で、終了コードを失敗にする", async () => {
  const r = await inspectPublishedNotes(
    { ...MAP, nodraft: { url: "https://note.com/u/n/n0004" } },
    { fetchDetail: detailFrom({ n0001: LIVE_OK, n0002: LIVE_OK.replace("最初の段落", "古い段落"), n0003: 429, n0004: LIVE_OK }), readDraft: drafts, delayMs: 0 },
  );
  assert.equal(r.notes.demo.freePart.status, "ok");
  assert.deepEqual(r.notes.demo.issues, []);
  assert.equal(r.notes.demo2.freePart.status, "bad");
  assert.ok(r.notes.demo2.issues.some((i) => /原稿と違う/.test(i)), r.notes.demo2.issues.join());
  assert.equal(r.notes.demo3.freePart.status, "unknown");
  assert.ok(r.notes.demo3.issues.some((i) => /未計測/.test(i)));
  assert.equal(r.notes.nodraft.freePart.status, "unknown");
  assert.deepEqual(r.counts, { ok: 1, bad: 1, unknown: 2 });
  assert.equal(r.exitCode, 1);
  assert.ok(r.lines.some((l) => l.startsWith("::error") && /未計測 2/.test(l)), r.lines.join("\n"));
  assert.ok(r.lines.some((l) => l.startsWith("::error") && /demo2/.test(l)));
});

test("公開中の note の検査: すべて原稿どおりなら終了コード 0（::error を出さない）", async () => {
  const r = await inspectPublishedNotes(MAP, { fetchDetail: detailFrom({ n0001: LIVE_OK, n0002: LIVE_OK, n0003: LIVE_OK }), readDraft: drafts, delayMs: 0 });
  assert.deepEqual(r.counts, { ok: 3, bad: 0, unknown: 0 });
  assert.equal(r.exitCode, 0);
  assert.ok(!r.lines.some((l) => l.startsWith("::error")), r.lines.join("\n"));
});

test("公開中の note の検査: 取得に失敗した記事は前回の結果を残して stale と印を付け、半数以上が失敗なら記録を上書きしない", async () => {
  const prev = { checkedAt: "2026-10-21T00:00:00.000Z", notes: { demo3: { issues: ["前回の問題"], freePart: { status: "bad", kind: "text" } } } };
  const r = await inspectPublishedNotes(MAP, { fetchDetail: detailFrom({ n0001: LIVE_OK, n0002: LIVE_OK, n0003: new Error("fetch failed") }), readDraft: drafts, prev, delayMs: 0 });
  assert.equal(r.notes.demo3.stale, true);
  assert.equal(r.notes.demo3.previous.freePart.kind, "text", "前回の結果を残す");
  assert.equal(r.notes.demo3.freePart.status, "unknown");
  assert.equal(r.write, true);
  const many = await inspectPublishedNotes(MAP, { fetchDetail: detailFrom({ n0001: 500, n0002: 503, n0003: LIVE_OK }), readDraft: drafts, prev, delayMs: 0 });
  assert.equal(many.write, false, "多くが未計測の回は、前回の記録を空の結果で置き換えない");
  assert.ok(many.lines.some((l) => l.startsWith("::error") && /上書きしません/.test(l)));
});

test("note の記事一覧: isLastPage が真偽値でない応答は最後のページとみなさず失敗にする", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ data: { contents: [{ name: "a", noteUrl: "https://note.com/u/n/n1" }] } }), { status: 200 });
  await assert.rejects(fetchAllNotes({ fetchImpl, delayMs: 0 }), /isLastPage/);
});

test("購入リンクの対応表: 新しい一覧が前回の 8 割未満なら置き換えない（一覧の欠けで購入リンクを消さない）", () => {
  const prev = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`s${i}`, { url: `u${i}` }]));
  const small = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`s${i}`, { url: `u${i}` }]));
  const r = nextNoteUrlMap(prev, small);
  assert.equal(r.replace, false);
  assert.match(r.reason, /8 割/);
  const ok = nextNoteUrlMap(prev, Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`s${i}`, { url: `u${i}` }])));
  assert.equal(ok.replace, true);
  assert.equal(nextNoteUrlMap({}, small).replace, true);
});

// 比較の正規化が消してよいのは、空白（改行・字下げ）と、NFKC で同じになる全角・半角の揺れだけ。
// 数字・符号・記号・句読点は意味を運ぶ（+30% と -30%、○ と ×、$ と €）。以前は記号と句読点をすべて消してから比べていたため、
// 逆の事実を書いた公開中の本文も「原稿どおり」と判定していた（2026-10-22 の検証）
const SYMBOL_DRAFT = DRAFT.replace(
  "さらに無料の説明が続き、最後の無料の文で終わります。",
  "| 項目 | demo | 競合 |\n|---|---|---|\n| **Linux** | ○ 対応 | × 非対応 |\n| 速度 | +30% | $5/月 |\n\nさらに無料の説明が続き、最後の無料の文で終わります。",
);
const SYMBOL_LIVE = parseDraftToNotePayload(SYMBOL_DRAFT, true).freeBody;

test("無料部分の検査: 数字の符号・○×・通貨記号が原稿と逆なら bad（記号を消して比べない）", () => {
  assert.equal(freePartVerdict(SYMBOL_LIVE, SYMBOL_DRAFT).status, "ok");
  for (const [from, to] of [["+30%", "-30%"], ["○ 対応", "× 対応"], ["$5", "€5"], ["30%", "80%"]]) {
    assert.ok(SYMBOL_LIVE.includes(from), from);
    const v = freePartVerdict(SYMBOL_LIVE.replace(from, to), SYMBOL_DRAFT);
    assert.equal(v.status, "bad", `${from} → ${to}`);
  }
});

// 実際の原稿（note_drafts/ の全記事）から作る性質の検査: 原稿の無料部分に現れる文字の種類（文字・数字・句読点・記号）ごとに、
// 本文の 1 文字を同じ種類の別の文字に変えると、必ず bad になる（正規化が、その種類の文字を比較から消していない）
const CATEGORIES = { L: /\p{L}/u, N: /\p{N}/u, P: /\p{P}/u, S: /\p{S}/u };
const SWAP = { L: ["あ", "い"], N: ["1", "2"], P: ["、", "。"], S: ["○", "×"] };
// HTML のタグ・実体参照の外にある、種類 cat の最初の文字の位置
function firstTextChar(html, re) {
  let inTag = false;
  let inEntity = false;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (inTag) inTag = c !== ">";
    else if (inEntity) inEntity = c !== ";";
    else if (c === "<") inTag = true;
    else if (c === "&") inEntity = true;
    else if (re.test(c) && c.normalize("NFKC") === c) return i;
  }
  return -1;
}
test("無料部分の検査: 実際の原稿すべてで、文字・数字・句読点・記号のどれを 1 文字変えても bad になる", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const dir = "note_drafts";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith("_note.md"));
  assert.ok(files.length >= 10, files.join());
  const seen = new Set();
  for (const f of files) {
    const draft = fs.readFileSync(path.join(dir, f), "utf8");
    const html = renderDraftFree(draft);
    if (!html) continue;
    assert.equal(freePartVerdict(html, draft).status, "ok", f);
    for (const [cat, re] of Object.entries(CATEGORIES)) {
      const i = firstTextChar(html, re);
      if (i < 0) continue;
      seen.add(cat);
      const [a, b] = SWAP[cat];
      const to = html[i] === a ? b : a;
      const mutated = html.slice(0, i) + to + html.slice(i + 1);
      assert.equal(freePartVerdict(mutated, draft).status, "bad", `${f}: ${cat} の 1 文字を変えても bad にならない`);
    }
  }
  assert.deepEqual([...seen].sort(), ["L", "N", "P", "S"], "原稿に 4 種類の文字が揃っていない（検査の前提が崩れた）");
});

test("無料部分の検査: 文言が違い、しかも原稿より大きく長い本文は past（末尾が一致しなくても有料部分が見えている恐れ）", () => {
  const longer = `${LIVE_OK.replace("最後の無料の文で終わります", "最後の古い文で終わります")}<p>${"有料の本文です。".repeat(40)}</p>`;
  const v = freePartVerdict(longer, DRAFT);
  assert.equal(v.status, "bad");
  assert.equal(v.kind, "past");
});

test("公開中の note の検査: 原稿と対応づかない note の取得に失敗したら未計測として ::warning に数え、終了コードを失敗にする", async () => {
  const r = await inspectPublishedNotes(MAP, {
    fetchDetail: detailFrom({ n0001: LIVE_OK, n0002: LIVE_OK, n0003: LIVE_OK, n0009: 503 }),
    readDraft: drafts,
    unlinked: [{ name: "古い版", noteUrl: "https://note.com/u/n/n0009", price: 980, publishAt: "" }],
    delayMs: 0,
  });
  assert.equal(r.unlinked.length, 1);
  assert.ok(r.unlinked[0].issues.some((i) => /未計測/.test(i)), JSON.stringify(r.unlinked[0]));
  assert.equal(r.exitCode, 1);
  assert.ok(r.lines.some((l) => /未計測 1 本/.test(l)), r.lines.join("\n"));
});
