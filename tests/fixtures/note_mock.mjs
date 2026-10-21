// note.com の代わり（note_browser.mjs のテスト用）。実際の挙動に合わせ、公開中の記事では見出し画像はまず下書きに付き、
// 編集画面で「公開に進む」→「更新する」を押すと記事に反映される。対象は ATR_NOTE_MOCK_TARGET の記事だけ（他は設定済み）。
// 編集画面は最初、実機と同じくいったん表示されてから note.com/login?redirectPath=編集画面 に飛ばされ、ログイン済みなので少しして自動で戻る。
// ATR_NOTE_MOCK_SESSION を指定すると自動では戻らず、そのファイルがある（＝普通の Chrome でログインした）ときだけ編集画面を開ける。
// 本文: ATR_NOTE_MOCK_WORDING の記事は古い表現を含む。ATR_NOTE_MOCK_DRIFT の記事は、編集画面の下書きが公開中と違う。
// ATR_NOTE_MOCK_INVOICE の記事はインボイス対応領収書の案内を（実機で起こりうる太字の区切りを含めて）、ATR_NOTE_MOCK_COPIPE の記事は「コピペで本番一発起動」を含む。
// その案内について、ATR_NOTE_MOCK_RESUME の記事は下書きだけ直してある（前回の実行で公開に至らなかった）、ATR_NOTE_MOCK_OTHER の記事は下書きでは同じくらいの長さの別の文になっている。
// 編集画面は本文を編集でき、「更新する」で編集後の本文が公開中の本文になる。ATR_NOTE_MOCK_DUMP を指定すると、更新のたびに更新した記事の本文（記事キー → 本文）をそのファイルに書く
import fs from "fs";

const INVOICE_HTML = "マイページより<strong>インボイス対応領収書</strong>が即時発行可能です。会社の「技術調査費」「自己研鑽費」として経費精算いただけます。";

export default async function install(ctx) {
  const sessionFile = process.env.ATR_NOTE_MOCK_SESSION;
  const state = { draft: "", published: "", editorSession: false, live: {}, updated: {} };
  const target = process.env.ATR_NOTE_MOCK_TARGET;
  const keysOf = (v) => (v || "").split(",").filter(Boolean);
  const has = (name, k) => keysOf(process.env[name]).includes(k);
  const live = (k) =>
    (state.live[k] ??= [
      "<h2>概要</h2><p>無料部分の本文です。</p>",
      has("ATR_NOTE_MOCK_WORDING", k) ? "<p>これらの状況を鑑み、ThoughtWorksでは「TRIAL」と判定します。</p>" : "",
      has("ATR_NOTE_MOCK_COPIPE", k) ? "<ul><li><p>コピペで本番一発起動できる「Docker Compose &amp; .env 設定キット」</p></li></ul>" : "",
      has("ATR_NOTE_MOCK_INVOICE", k) ? `<blockquote><p>※noteは購入後、${INVOICE_HTML}</p></blockquote>` : "",
      "<p>有料部分の本文です。導入手順と見積表。</p>",
    ].join(""));
  const draft = (k) => {
    if (has("ATR_NOTE_MOCK_DRIFT", k)) return `${live(k)}<p>${"以前の手作業で貼り付けた別の本文。".repeat(20)}</p>`;
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
    if (m) return route.fulfill({ json: { data: { id: 42, eyecatch: m[1] === target ? state.published : "https://x/img.png", updated_at: "x", body: live(m[1]) } } });
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
    // 実機と同じく、公開設定の画面には「更新する」が無く、「有料エリア設定」を押した次の画面に出る
    if (u.pathname.endsWith("/publish/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><h1>公開設定</h1><button>キャンセル</button><button onclick="document.getElementById('paid').style.display='block';this.remove()">有料エリア設定</button><div id="paid" style="display:none"><p>有料ラインの位置</p><button onclick="fetch('/mock-publish?key=${key}',{method:'POST',body:sessionStorage.getItem('d')||''}).then(()=>location.href='/notes/${key}/edit/')">更新する</button></div></body></html>` });
    if (u.pathname === "/mock-publish") {
      const k = u.searchParams.get("key");
      if (k === target) state.published = state.draft;
      const body = route.request().postData();
      if (body) state.live[k] = state.updated[k] = body;
      if (process.env.ATR_NOTE_MOCK_DUMP) fs.writeFileSync(process.env.ATR_NOTE_MOCK_DUMP, JSON.stringify(state.updated));
      return route.fulfill({ body: "ok" });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
