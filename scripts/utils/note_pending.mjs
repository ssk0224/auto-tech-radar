// [U] の一覧に、CI が公開中の note で見つけた問題を出すかどうか。
// 「差し替えた」と記録した時刻が、CI の最新の確認より後のときだけ隠す（次の確認で直っていなければ、また出す）。
// 日付だけで比べると、同じ日に「更新する」を押し忘れた記事がその日いっぱい隠れてしまう（2026-10-21 に実際に起きた）
import { findHype } from "./hype_check.mjs";
import { utcStamp } from "../../src/utils/dates.js";

export function hiddenAfterOwnerFix(noteUpdatedAt, checkedAt) {
  return Boolean(noteUpdatedAt && checkedAt && noteUpdatedAt > checkedAt);
}

// 公開中の note に残っている古い表現（オーナーに「この語を探して直す」と伝えるためだけに使う。公開文面には出さない）。
// 「ThoughtWorks」の後に「成熟度リング」「判定」が続く形と、途中まで直して「ThoughtWorks」だけ残った形（2026-10-21 effectcraft）がある
export const OLD_RING_WORDS = "ThoughtWorks成熟度リング";
const OLD_RING_RE = /ThoughtWorks(?:成熟度リング)?(?:判定)?/;
// 置き換え後の語。🎯 などの前後の文字は含めない（見出しの 🎯 ごと貼ると 🎯 が二重になった、2026-10-21）
export const NEW_RING_WORDS = "成熟度の目安（AI による見立て）";

// CI の検査結果が「古い表現だけ」の問題なら、その箇所（前後の文）と、選んで置き換える語を返す。それ以外は null
export function oldRingWordingSpot(status) {
  if (!status.issues?.length || !status.issues.every((i) => /ThoughtWorks/.test(i))) return null;
  const excerpt = (status.excerpt || "").replace(/^[^>]*">/, "").trim();
  const m = excerpt.match(OLD_RING_RE);
  return m ? { excerpt, words: m[0] } : null;
}

// 公開中の note に残っていると CI が名前を付けて知らせる表現（検出だけ。直すのは [E] が無料部分を原稿の描画に置き換えて行う）。
// 以前は語ごとの置き換え規則（from → to）で直していたが、規則に無い書き方・規則を足し忘れた語は直らないまま残った
// （2026-10-22: 公開中の 37 本中 27 本の無料部分が原稿と違った）。正本は原稿で、規則表ではない
const RING_ISSUE = "第三者（ThoughtWorks）の評価のような表現";
// オーナーはインボイス発行事業者に登録していないので、購入者が受け取れるのは通常の領収書だけ（note 公式ヘルプ: 設定 → 購入・チップ履歴から発行）
const INVOICE_ISSUE = "インボイス対応領収書の案内（インボイス発行事業者に未登録のため事実と異なる）";
const COPIPE_ISSUE = "「コピペで本番〜」の表現（動作を確かめていない手順・設定を、そのまま本番で使えるかのように案内）";
const HYPE_ISSUE = "根拠のない誇張・成約を保証するかのような表現（生成時に禁止した表現: utils/hype_check.mjs）";
export const NOTE_TEXT_CHECKS = [
  { id: "ring", detect: (t) => /ThoughtWorks/.test(t), issue: RING_ISSUE },
  { id: "invoice", detect: (t) => /インボイス対応領収書/.test(t), issue: INVOICE_ISSUE },
  { id: "copipe", detect: (t) => /コピペで本番/.test(t), issue: COPIPE_ISSUE },
  // 誇張は生成時の禁止表現（HYPE_RULES）と同じ定義で見る。「コピペで本番」は上の名前で知らせる
  { id: "hype", detect: (t) => findHype(t).some((h) => !/コピペで本番/.test(h)), issue: HYPE_ISSUE },
];

// 本文 text に当てはまる表現の名前（issue の文言）
export const noteTextIssues = (text) => NOTE_TEXT_CHECKS.filter((c) => c.detect(String(text || ""))).map((c) => c.issue);
// 本文 text に、知らせる表現が残っているか
export const hasNoteTextIssue = (text) => noteTextIssues(text).length > 0;

// 段落の比較用の正規化（全角・半角の揺れ、空白・改行・ゼロ幅文字は違いとして扱わない）。空の段落は除く。
// [E] の編集画面での比較（note_browser.mjs）と、置き換えの計画（planFreePartReplace）で同じものを使う
export const normBlock = (b) => String(b).normalize("NFKC").replace(/[\s\u200b-\u200d\u2060\ufeff]+/g, "");
export const normBlocks = (blocks) => (blocks || []).map(normBlock).filter(Boolean);

// 公開中の無料部分 live を、原稿の無料部分を描画したもの want に合わせる計画（どちらも normBlocks 済みの段落の配列）。
// 段落の数が同じなら、違う段落を丸ごと原稿の段落に置き換える（段落の区切り＝有料ラインの位置の基準は変えない）。
// 段落の数が違う（有料ラインの位置・段落の構成が原稿と違う）ものは、自動では置き換えない（manual）
export function planFreePartReplace(live, want) {
  if (!want?.length) return { action: "manual", reason: "原稿の無料部分が空のため置き換えられません" };
  if (!live?.length) return { action: "manual", reason: "公開中の無料部分を読めないため置き換えられません" };
  if (live.length !== want.length) {
    return { action: "manual", reason: `無料部分の段落の数が原稿と違います（公開中 ${live.length} / 原稿 ${want.length}。有料ラインの位置か段落の構成が違うため [U] で差し替えてください）` };
  }
  const changes = want.map((w, i) => (w === live[i] ? -1 : i)).filter((i) => i >= 0);
  return changes.length ? { action: "replace", changes } : { action: "same" };
}

// [E] で直す記事を決める。notes: [{ slug, key, plan }]（plan は planFreePartReplace の結果。note_urls.json の順）。
// 置き換える記事を上限 max まで選び、残りの本数と、自動では直せない記事（manual: [{ slug, reason }]）を返す
export function planFreePartFixes(notes, max = NOTE_FIX_MAX) {
  const targets = notes.filter((n) => n.plan?.action === "replace").map((n) => ({ slug: n.slug, key: n.key, changes: n.plan.changes }));
  const manual = notes.filter((n) => n.plan?.action === "manual").map((n) => ({ slug: n.slug, reason: n.plan.reason }));
  return { fix: targets.slice(0, max), remaining: Math.max(0, targets.length - max), manual };
}

// note の API が返す本文（HTML）を、編集画面の innerText に近い文字列にする（段落の区切りは改行、太字などの書式は外してつなぐ）
export function noteHtmlText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|h[1-6]|li|blockquote|pre|figcaption|div|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// [E] で直す記事の上限（note への編集・公開を短時間に繰り返さない）。1 回の実行だけでなく、直近 24 時間で数える
// （1 回の上限だけだと、続けて [E] を押せば短時間に全記事を更新できてしまう）。直した時刻はオーナー端末に残す（note_browser.mjs）
export const NOTE_FIX_MAX = 12;
export const NOTE_FIX_WINDOW_MS = 24 * 60 * 60 * 1000;

// 直した記録 history（[{ at: ISO 時刻, slug }]）から、今あと何本直せるか（left）と、0 本のときに次に直せるようになる時刻（nextAt）を返す
// 今より後の時刻の記録（記録したときに端末の時計が進んでいて、後で合わせ直された）は「今」直したものとして数える。
// 数えないと、時計を直しただけで直近に直した分が消えて上限を超える。今に寄せるので、次に直せる時刻が遠い先になることもない
export function noteFixBudget(history, now = Date.now(), max = NOTE_FIX_MAX, windowMs = NOTE_FIX_WINDOW_MS) {
  const recent = (Array.isArray(history) ? history : [])
    .map((h) => Date.parse(h?.at))
    .filter((t) => Number.isFinite(t) && t > now - windowMs)
    .map((t) => Math.min(t, now))
    .sort((a, b) => a - b);
  const left = Math.max(0, max - recent.length);
  // 古い方から数えて、期限切れになると残りが 1 本以上になる記録の、24 時間後
  const nextAt = left > 0 ? null : utcStamp(recent[recent.length - max] + windowMs);
  return { left, used: recent.length, nextAt };
}

// CI の検査で見つかった問題を [E] で直せるか。CI（sync_note_urls.mjs）が「無料部分を原稿の描画に置き換えた後の記事に問題が残らない」ときに
// maintainFixes: true を記録する。記録が無い（古い形式の検査結果・取得できなかった記事）は直せるとみなさない
export const autoFixableByMaintain = (status) => Boolean(status?.issues?.length) && status.maintainFixes === true;

// [E] の実行記録（scripts/note_browser_log.json）のうち、CI の最新の確認より後に直した記事。次の確認までは「直した」として扱う
export function fixedByMaintainSince(log, checkedAt) {
  if (!log?.at || !checkedAt || !(log.at > checkedAt)) return new Set();
  return new Set(log.result?.wording?.fixed || []);
}

// [U] に出す、CI が公開中の note で見つけた問題（scripts/note_status.json の st）。
// [E] で自動修正できる表現だけが問題の記事は出さない（本文の全差し替えは、有料ラインを入れ直す手間と危険があるため）。
// 古い成熟度の表現だけの記事は、[E] が使えないときの手作業として、その語だけ直す案内（wording）を続ける
export function statusUpdateItems(st, history = {}, { listed = new Set(), log = null } = {}) {
  const fixed = fixedByMaintainSince(log, st?.checkedAt);
  const items = [];
  for (const [slug, v] of Object.entries(st?.notes || {})) {
    if (!v.issues?.length || listed.has(slug) || fixed.has(slug)) continue;
    if (hiddenAfterOwnerFix(history[slug]?.noteUpdatedAt, st.checkedAt)) continue;
    const spot = oldRingWordingSpot(v);
    if (spot) items.push({ slug, action: "wording", spot: spot.excerpt, words: spot.words, reason: `無料部分に古い表現「${spot.words}」が残っています` });
    else if (!autoFixableByMaintain(v)) items.push({ slug, action: "replace", reason: `公開中の note に問題があります: ${v.issues.join(" / ")}` });
  }
  return items;
}

// ランチャーの見出しに出す数: [E] で自動修正できる記事（[E] で直した後、CI がまだ確認していない記事を除く）と、それ以外の要修正の記事
export function noteIssueCounts(st, log = null) {
  const fixed = fixedByMaintainSince(log, st?.checkedAt);
  const bad = Object.entries(st?.notes || {}).filter(([, v]) => v.issues?.length);
  const auto = bad.filter(([slug, v]) => autoFixableByMaintain(v) && !fixed.has(slug)).length;
  return { auto, other: bad.filter(([, v]) => !autoFixableByMaintain(v)).length };
}
