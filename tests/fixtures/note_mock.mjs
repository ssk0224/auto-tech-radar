// note.com の代わり（note_browser.mjs のテスト用）。実際の挙動に合わせ、公開中の記事では見出し画像はまず下書きに付き、
// 編集画面で「公開に進む」→「更新する」を押すと記事に反映される。対象は ATR_NOTE_MOCK_TARGET の記事だけ（他は設定済み）。
// 編集画面は最初、実機と同じくいったん表示されてから note.com/login?redirectPath=編集画面 に飛ばされ、ログイン済みなので少しして自動で戻る。
// ATR_NOTE_MOCK_SESSION を指定すると自動では戻らず、そのファイルがある（＝普通の Chrome でログインした）ときだけ編集画面を開ける。
// 本文: ATR_NOTE_MOCK_WORDING の記事は古い表現を含む。ATR_NOTE_MOCK_DRIFT の記事は、編集画面の下書きが公開中と違う。
// ATR_NOTE_MOCK_INVOICE の記事はインボイス対応領収書の案内を（実機で起こりうる太字の区切りを含めて）、ATR_NOTE_MOCK_COPIPE の記事は「コピペで本番一発起動」を含む。
// その案内について、ATR_NOTE_MOCK_RESUME の記事は下書きだけ直してある（前回の実行で公開に至らなかった）、ATR_NOTE_MOCK_OTHER の記事は下書きでは同じくらいの長さの別の文になっている。
// 編集画面は本文を編集でき、「更新する」で編集後の本文が公開中の本文になる。ATR_NOTE_MOCK_DUMP を指定すると、更新のたびに更新した記事の本文（記事キー → 本文）をそのファイルに書く
// 記事 API はログイン（Cookie）ありならオーナーとして全文を、なしなら無料部分（最後の有料部分の段落より前）だけを返す。
// ATR_NOTE_MOCK_PAIDMOVE の記事は、「更新する」の後に有料ラインが外れて、ログインなしでも全文が読める（有料ラインの位置が変わった事故の再現）
//
// 実機の構造の再現（scripts/note_browser_log.json の 2026-10-21 の実機記録と、出品に使った scripts/utils/note_html.mjs の出力から）:
// - 「有料エリア設定」の画面には記事の本文（有料部分を含む）が段落ごとに表示され、段落の間に「ラインをこの場所に変更」ボタンが並ぶ。
//   このボタンが押されたら有料ラインを動かした事故として記録する（ATR_NOTE_MOCK_DUMP の "__movedLine"）
// - ATR_NOTE_MOCK_RICH の記事は、note_html.mjs（mdToNoteHtml）で変換した本文（見出し・太字・リンク・改行・箇条書き・番号付き・表・引用・コード・区切り線）
// - ATR_NOTE_MOCK_EXTRA の記事は、下書きに公開していない文が段落以外の要素（div）で残っている
// - ATR_NOTE_MOCK_PAIDHEAD の記事は、有料部分に「更新」を含む短い見出しがある（記録に有料部分が混ざらないことの確認用）
// - ATR_NOTE_MOCK_UNPUBLISHED の記事は公開されていない下書きで、最後のボタンは「更新する」ではなく「投稿する」（押すと新規出品になる）
// - ATR_NOTE_MOCK_CLOSE の記事は、「更新する」で公開された直後に編集画面の窓が閉じられる（オーナーが窓を閉じた・ブラウザが落ちた）
import fs from "fs";
import path from "path";
import { mdToNoteHtml } from "../../scripts/utils/note_html.mjs";

const INVOICE_HTML = "マイページより<strong>インボイス対応領収書</strong>が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。";
const PAID_HTML = "<p>有料部分の本文です。導入手順と見積表。</p>";
export const PAID_HEAD_HTML = "<h3>更新手順</h3><p>公開中の設定を更新する</p>";
// note_html.mjs で変換する本文（直す表現を、引用・表・見出し・太字の段落・改行の 2 行目に置く）
export const RICH_MD = [
  "## 世界中で爆発的に注目されているOSS",
  "**概要**: このOSSは [公式サイト](https://example.com) で配布されています。",
  "2 行目: GitHubで爆発的なスターを集めています。",
  "",
  "- 項目 A",
  "  - 入れ子の項目",
  "1. 手順その1",
  "2. 手順その2",
  "",
  "| 項目 | 内容 |",
  "| --- | --- |",
  "| キット | コピペで本番投入できる設定一式 |",
  "",
  "> ※noteは購入後、マイページより**インボイス対応領収書**が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。",
  "",
  "```",
  "docker compose up -d",
  "```",
  "",
  "---",
  "",
  "最後の段落です。",
].join("\n");

// [E] の正本（note_drafts/ の原稿）の代わり。模擬の公開中の本文（下の live）と同じ段落の構成で、直した後の文にした原稿（Markdown）。
// [E] は公開中の無料部分を、この原稿の無料部分を描画したものに置き換える
const RECEIPT_MD = "※noteは購入後、「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。";
export const FIXED_RICH_MD = RICH_MD.replace("世界中で爆発的に注目されている", "注目されている")
  .replace("GitHubで爆発的なスター", "GitHubで多くのスター")
  .replace("コピペで本番投入できる", "動作未検証の例を含む")
  .replace("※noteは購入後、マイページより**インボイス対応領収書**が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。", RECEIPT_MD);
// 模擬の部品のうち、公開中の本文と原稿で文が違うもの（ATR_NOTE_MOCK_<名前> で記事キーを指定する）
export const DRAFT_PARTS = {
  ATR_NOTE_MOCK_RICH: FIXED_RICH_MD,
  ATR_NOTE_MOCK_WORDING: "これらの状況を鑑み、成熟度の目安（AI による見立て）では「TRIAL」と判定します。",
  ATR_NOTE_MOCK_COPIPE: "- 公式READMEに基づく導入手順（動作未検証の例を含む）の「Docker Compose & .env 設定キット」",
  // 規則表には無い書き方の古い文（語の置き換えでは直らなかった種類）
  ATR_NOTE_MOCK_STALE: "需要が伸びている理由を、公開情報から説明します。",
  ATR_NOTE_MOCK_INVOICE: `> ${RECEIPT_MD}`,
};
export function mockDraftMd(flags, { paid = true } = {}) {
  const parts = Object.keys(DRAFT_PARTS).filter((k) => flags.has(k)).map((k) => DRAFT_PARTS[k]);
  const paidLine = paid ? ["【有料ライン（推奨販売価格: 980円）ここから先は有料会員限定】\n<!-- PAID_SEALED: mock_note.paid.enc 有料エリアは暗号化保存されています -->"] : [];
  return ["# 模擬の記事", "## 概要\n無料部分の本文です。", ...parts, ...paidLine].join("\n\n") + "\n";
}
// 記事ごとの原稿を dir に書く（keys: slug → 記事キー、env: 部品を指定した環境変数）。ATR_NOTE_MOCK_NODRAFT の記事は原稿を書かない
export function writeMockDrafts(dir, keys, env) {
  fs.mkdirSync(dir, { recursive: true });
  const has = (name, k) => (env[name] || "").split(",").filter(Boolean).includes(k);
  for (const [slug, key] of Object.entries(keys)) {
    if (has("ATR_NOTE_MOCK_NODRAFT", key)) continue;
    const flags = new Set(Object.keys(DRAFT_PARTS).filter((n) => has(n, key)));
    const free = slug === "LEAD_MAGNET_CHEAT_SHEET";
    fs.writeFileSync(path.join(dir, free ? `${slug}.md` : `${slug}_note.md`), mockDraftMd(flags, { paid: !free }));
  }
  return dir;
}

export default async function install(ctx) {
  const sessionFile = process.env.ATR_NOTE_MOCK_SESSION;
  const state = { draft: "", published: "", editorSession: false, live: {}, updated: {} };
  const target = process.env.ATR_NOTE_MOCK_TARGET;
  const keysOf = (v) => (v || "").split(",").filter(Boolean);
  const has = (name, k) => keysOf(process.env[name]).includes(k);
  const dump = () => process.env.ATR_NOTE_MOCK_DUMP && fs.writeFileSync(process.env.ATR_NOTE_MOCK_DUMP, JSON.stringify(state.updated));
  const live = (k) =>
    (state.live[k] ??= [
      "<h2>概要</h2><p>無料部分の本文です。</p>",
      has("ATR_NOTE_MOCK_RICH", k) ? mdToNoteHtml(RICH_MD).html : "",
      has("ATR_NOTE_MOCK_WORDING", k) ? "<p>これらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。</p>" : "",
      has("ATR_NOTE_MOCK_COPIPE", k) ? "<ul><li><p>コピペで本番一発起動できる「Docker Compose &amp; .env 設定キット」</p></li></ul>" : "",
      has("ATR_NOTE_MOCK_STALE", k) ? "<p>需要が<strong>爆発的に</strong>伸びている理由を、独自の調査から断言します。</p>" : "",
      // 引用は実機と同じく figure で包む（この形で出品している: scripts/utils/note_html.mjs の引用の変換）
      has("ATR_NOTE_MOCK_INVOICE", k) ? `<figure name="q1" id="q1"><blockquote><p>※noteは購入後、${INVOICE_HTML}</p></blockquote><figcaption></figcaption></figure>` : "",
      PAID_HTML,
      has("ATR_NOTE_MOCK_PAIDHEAD", k) ? PAID_HEAD_HTML : "",
    ].join(""));
  const draft = (k) => {
    if (has("ATR_NOTE_MOCK_DRIFT", k)) return `${live(k)}<p>${"以前の手作業で貼り付けた別の本文。".repeat(20)}</p>`;
    if (has("ATR_NOTE_MOCK_EXTRA", k)) return live(k).replace(PAID_HTML, `<div>まだ公開していない追記の文。</div>${PAID_HTML}`);
    if (has("ATR_NOTE_MOCK_RESUME", k)) return live(k).replace(INVOICE_HTML, "「購入・チップ履歴」から領収書を発行できます。経費精算の可否は所属先の規程をご確認ください。");
    if (has("ATR_NOTE_MOCK_OTHER", k)) return live(k).replace(INVOICE_HTML, "購入後の手続きは note の設定画面からできます。詳しくは note のヘルプをご覧ください。");
    return live(k);
  };
  await ctx.route("https://note.com/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname === "/login") {
      if (sessionFile) return route.fulfill({ contentType: "text/html; charset=utf-8", body: "<html><body><button>ログイン</button></body></html>" });
      state.editorSession = true;
      const back = JSON.stringify(u.searchParams.get("redirectPath") || "/");
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><button>ログイン</button><script>setTimeout(()=>location.href=${back},1500)</script></body></html>` });
    }
    if (u.pathname === "/notes") return route.fulfill({ body: "<html><body>notes</body></html>", contentType: "text/html" });
    const m = u.pathname.match(/^\/api\/v3\/notes\/(n\w+)$/);
    if (m) {
      const owner = /XSRF-TOKEN=/.test((await req.allHeaders()).cookie || "");
      const full = live(m[1]);
      const moved = (has("ATR_NOTE_MOCK_PAIDMOVE", m[1]) && state.updated[m[1]]) || state.movedLine;
      const body = owner || moved ? full : full.slice(0, full.lastIndexOf(PAID_HTML));
      return route.fulfill({ json: { data: { id: 42, eyecatch: m[1] === target ? state.published : "https://x/img.png", updated_at: "x", body } } });
    }
    if (u.pathname === "/api/v1/stats/pv") return route.fulfill({ json: { data: { note_stats: [{ name: "記事A", read_count: 12, like_count: 1, comment_count: 0 }], total_pv: 12, total_like: 1, last_page: true } } });
    if (u.pathname === "/api/v1/image_upload/note_eyecatch") {
      const body = req.postDataBuffer().toString("latin1");
      if (!/name="note_id"\r\n\r\n42/.test(body) || !body.includes("Content-Type: image/png") || !req.headers()["x-xsrf-token"]) return route.fulfill({ status: 500, body: "bad form" });
      state.draft = "https://img/uploaded.png";
      return route.fulfill({ json: { data: { url: state.draft } } });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await ctx.addCookies([{ name: "XSRF-TOKEN", value: "tok", domain: "note.com", path: "/" }]);
  await ctx.route("https://editor.note.com/**", async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/edit/") && !(sessionFile ? fs.existsSync(sessionFile) : state.editorSession)) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><script>setTimeout(()=>location.replace(${JSON.stringify(`https://note.com/login?redirectPath=${encodeURIComponent(u.href)}`)}),1000)</script></body></html>` });
    const key = u.pathname.match(/\/notes\/(n\w+)\//)?.[1];
    if (u.pathname.endsWith("/edit/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><textarea>タイトル</textarea><div contenteditable="true" id="ed">${draft(key)}</div><button onclick="sessionStorage.setItem('d', document.getElementById('ed').innerHTML); location.href='/notes/${key}/publish/'">公開に進む</button></body></html>` });
    // 実機と同じく、公開設定の画面には「更新する」が無く、「有料エリア設定」を押した次の画面に出る。
    // その画面には本文が段落ごとに表示され、段落の間に「ラインをこの場所に変更」が並ぶ（押してはいけない）
    if (u.pathname.endsWith("/publish/")) {
      const final = has("ATR_NOTE_MOCK_UNPUBLISHED", key) ? "投稿する" : "更新する";
      const showPaid = `document.getElementById('paid').style.display='block';this.remove();` +
        `const d=document.createElement('div');d.innerHTML=sessionStorage.getItem('d')||'';const area=document.getElementById('area');` +
        `for(const b of [...d.children]){area.appendChild(b);const l=document.createElement('button');l.textContent='ラインをこの場所に変更';l.onclick=()=>fetch('/mock-move-line',{method:'POST'});area.appendChild(l);}`;
      return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><h1>公開設定</h1><button>キャンセル</button><button onclick="${showPaid}">有料エリア設定</button><div id="paid" style="display:none"><p>有料ラインの位置</p><div id="area"></div><button onclick="fetch('/mock-publish?key=${key}',{method:'POST',body:sessionStorage.getItem('d')||''}).then(()=>location.href='/notes/${key}/edit/')">${final}</button></div></body></html>` });
    }
    if (u.pathname === "/mock-move-line") {
      state.movedLine = true;
      state.updated.__movedLine = true;
      dump();
      return route.fulfill({ body: "ok" });
    }
    if (u.pathname === "/mock-publish") {
      const k = u.searchParams.get("key");
      if (k === target) state.published = state.draft;
      const body = route.request().postData();
      if (body) state.live[k] = state.updated[k] = body;
      dump();
      await route.fulfill({ body: "ok" });
      if (has("ATR_NOTE_MOCK_CLOSE", k)) await route.request().frame().page().close().catch(() => {});
      return;
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
