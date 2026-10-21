// [U] の一覧に、CI が公開中の note で見つけた問題を出すかどうか。
// 「差し替えた」と記録した時刻が、CI の最新の確認より後のときだけ隠す（次の確認で直っていなければ、また出す）。
// 日付だけで比べると、同じ日に「更新する」を押し忘れた記事がその日いっぱい隠れてしまう（2026-10-21 に実際に起きた）
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

// 公開中の note に残った、直すべき表現の一覧。[E]（note_browser.mjs maintain）が編集画面で from を選んで to に打ち替え、
// CI（sync_note_urls.mjs）が detect で見つけて issue の文言で記録する。
// ランチャーは issue の文言で「[E] で自動修正できる問題」かを見分けるので、CI とこの表で文言を必ずそろえる（この表から取る）
const RING_ISSUE = "第三者（ThoughtWorks）の評価のような表現";
// オーナーはインボイス発行事業者に登録していないので、購入者が受け取れるのは通常の領収書だけ（note 公式ヘルプ: 設定 → 購入・チップ履歴から発行）
const INVOICE_ISSUE = "インボイス対応領収書の案内（インボイス発行事業者に未登録のため事実と異なる）";
const COPIPE_ISSUE = "「コピペで本番〜」の表現（動作を確かめていない手順・設定を、そのまま本番で使えるかのように案内）";
const HYPE_ISSUE = "根拠のない誇張・成約を保証するかのような表現（爆発的・即決・驚異的・怪物級）";
// 文字列そのものだけを検出する正規表現（原稿の雛形から入った決まった言い回しだけを直す規則に使う）
const exact = (s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
// (d) の規則: [from, to]。生成スクリプトの検査（utils/hype_check.mjs）で禁止した誇張のうち、公開中の note に残っている決まった言い回し。
// 雛形由来の 3 つ（見出し・提案シナリオ・営業トーク）と、記事ごとの文（原稿 note_drafts/ にある形そのまま）
const HYPE_FIXES = [
  ["hype-heading", "世界中で爆発的に注目されている", "注目されている"],
  ["hype-close-client", "クライアントを即決させる", "クライアントへの"],
  ["hype-close-order", "発注即決を勝ち取る", "商談で使える"],
  ["hype-explosive-demand", "需要が爆発的に高まっています", "需要が高まっています"],
  ["hype-explosive-stars", "GitHubで爆発的なスター", "GitHubで多くのスター"],
  ["hype-explosive-forks", "爆発的な勢いでフォークされている", "活発にフォークされている"],
  ["hype-monster-engine", "突破した怪物級の", "突破した"],
  ["hype-monster-oss", "記録した怪物級OSS", "記録したOSS"],
  ["hype-amazing-project", "再実装された驚異的なプロジェクト", "再実装されたプロジェクト"],
  ["hype-amazing-secret", "の驚異的な速度の秘密", "の速さの秘密"],
  ["hype-amazing-speed", "という驚異的な速度で", "という速度で"],
  ["hype-amazing-run", "驚異的な速度で実行されます", "高速に実行されます"],
  ["hype-amazing-cost", "高速性と驚異的なコスト削減", "高速性とコスト削減"],
];
export const NOTE_TEXT_RULES = [
  // (a) 古い成熟度の表現。以前の [U] / [E] と同じく、途中まで直して「ThoughtWorks」だけ残った形も直す
  { id: "ring-judge", detect: /ThoughtWorks/, from: "ThoughtWorks成熟度リング判定", to: NEW_RING_WORDS, issue: RING_ISSUE },
  { id: "ring", detect: /ThoughtWorks/, from: "ThoughtWorks成熟度リング", to: NEW_RING_WORDS, issue: RING_ISSUE },
  { id: "ring-judge-short", detect: /ThoughtWorks/, from: "ThoughtWorks判定", to: NEW_RING_WORDS, issue: RING_ISSUE },
  { id: "ring-leftover", detect: /ThoughtWorks/, from: "ThoughtWorks", to: NEW_RING_WORDS, issue: RING_ISSUE },
  // (b) インボイス対応領収書。直した後の文は「※noteは購入後、「購入・チップ履歴」から領収書を発行できます。…」になる
  {
    id: "invoice",
    detect: /インボイス対応領収書/,
    from: "マイページよりインボイス対応領収書が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。",
    to: "「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。",
    issue: INVOICE_ISSUE,
  },
  // 長い文が編集画面で段落をまたいで選べないときの予備（インボイスの部分だけ直す）
  { id: "invoice-short", detect: /インボイス対応領収書/, from: "インボイス対応領収書が即時発行可能です", to: "領収書を発行できます", issue: INVOICE_ISSUE },
  // (c) 動作未検証の手順・設定を「コピペで本番〜」と案内しない。原稿の「コピペで本番一発起動できる「…キット」」は「できる」ごと直す（「…を含む）できる」と文が崩れるため）。
  // 「実稼働 …キット」（opendots）は「実稼働」も外す（「動作未検証」と並べない）。
  // 検出は「コピペで本番」全体（どの規則にも当たらない書き方は [E] では直せないものとして [U] に回す）
  { id: "copipe-kit-live", detect: /コピペで本番/, from: "コピペで本番一発起動できる「実稼働 ", to: "公式READMEに基づく導入手順（動作未検証の例を含む）の「", issue: COPIPE_ISSUE },
  { id: "copipe-kit", detect: /コピペで本番/, from: "コピペで本番一発起動できる", to: "公式READMEに基づく導入手順（動作未検証の例を含む）の", issue: COPIPE_ISSUE },
  { id: "copipe", detect: /コピペで本番/, from: "コピペで本番一発起動", to: "公式READMEに基づく導入手順（動作未検証の例を含む）", issue: COPIPE_ISSUE },
  // 「コピペで本番投入できる環境構築・設定ファイル…完全版」（16 本）と「コピペで本番検証できる…」（filmcraft）
  { id: "copipe-deploy", detect: /コピペで本番/, from: "コピペで本番投入できる", to: "動作未検証の例を含む", issue: COPIPE_ISSUE },
  { id: "copipe-verify", detect: /コピペで本番/, from: "コピペで本番検証できる", to: "動作未検証の例を含む", issue: COPIPE_ISSUE },
  // (d) 根拠のない誇張・成約の保証（決まった言い回しだけ。検出もその文字列だけにして、ほかの書き方の記事を [U] に回さない）
  ...HYPE_FIXES.map(([id, from, to]) => ({ id, detect: exact(from), from, to, issue: HYPE_ISSUE })),
];
export const NOTE_TEXT_ISSUES = new Set(NOTE_TEXT_RULES.map((r) => r.issue));

// 本文 text に規則を当てる。長い from から順に置き換え、置き換えた箇所（置き換え後の語を含む）を短い規則でもう一度置き換えない
function rewrite(text) {
  let out = String(text || "");
  const rules = [];
  for (const r of [...NOTE_TEXT_RULES].sort((a, b) => b.from.length - a.from.length)) {
    if (!out.includes(r.from)) continue;
    out = out.split(r.from).join(`\u0000${rules.length}\u0001`);
    rules.push(r);
  }
  return { rules, text: out.replace(/\u0000(\d+)\u0001/g, (_, i) => rules[i].to) };
}

// 本文 text に当てはまる規則（長い from から順。同じ箇所に 2 つの規則を当てない）
export const applicableNoteRules = (text) => rewrite(text).rules;
// 規則をすべて当てた後の本文（[E] が編集画面で行う置き換えと同じ結果）
export const applyNoteRules = (text) => rewrite(text).text;

// 本文 text に、直すべき表現（detect）が残っているか
export const hasNoteTextIssue = (text) => NOTE_TEXT_RULES.some((r) => r.detect.test(String(text || "")));

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
export function noteFixBudget(history, now = Date.now(), max = NOTE_FIX_MAX, windowMs = NOTE_FIX_WINDOW_MS) {
  const recent = (Array.isArray(history) ? history : [])
    .map((h) => Date.parse(h?.at))
    .filter((t) => Number.isFinite(t) && t > now - windowMs && t <= now + 60 * 1000)
    .sort((a, b) => a - b);
  const left = Math.max(0, max - recent.length);
  // 古い方から数えて、期限切れになると残りが 1 本以上になる記録の、24 時間後
  const nextAt = left > 0 ? null : new Date(recent[recent.length - max] + windowMs).toISOString();
  return { left, used: recent.length, nextAt };
}

// [E] で直す記事を決める。notes: [{ slug, key, body(HTML) }]（note_urls.json の順）。
// 直すべき表現が残っている記事を上限まで選び、残りの本数を返す。
// 規則をすべて当てても表現が残る記事（想定外の書き方）は、編集画面を開かずに manual として返す（毎回同じ記事で止まらないように）
export function planNoteFixes(notes, max = NOTE_FIX_MAX) {
  const found = notes.map((n) => ({ slug: n.slug, key: n.key, text: noteHtmlText(n.body) })).filter((n) => hasNoteTextIssue(n.text));
  const manual = found.filter((n) => hasNoteTextIssue(applyNoteRules(n.text))).map((n) => n.slug);
  const targets = found.filter((n) => !manual.includes(n.slug)).map((n) => ({ slug: n.slug, key: n.key, rules: applicableNoteRules(n.text).map((r) => r.id) }));
  return { fix: targets.slice(0, max), remaining: Math.max(0, targets.length - max), manual };
}

// CI の検査で見つかった問題が、すべて [E] で自動修正できる表現か
export const autoFixableByMaintain = (status) => Boolean(status?.issues?.length) && status.issues.every((i) => NOTE_TEXT_ISSUES.has(i));

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
