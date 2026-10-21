// note.com の代わり（note_browser.mjs のテスト用）。実際の挙動に合わせ、公開中の記事では見出し画像はまず下書きに付き、
// 編集画面で「公開に進む」→「更新する」を押すと記事に反映される。対象は ATR_NOTE_MOCK_TARGET の記事だけ（他は設定済み）。
// 編集画面は最初、実機と同じくいったん表示されてから note.com/login?redirectPath=編集画面 に飛ばされ、ログイン済みなので少しして自動で戻る。
// ATR_NOTE_MOCK_SESSION を指定すると自動では戻らず、そのファイルがある（＝普通の Chrome でログインした）ときだけ編集画面を開ける
import fs from "fs";

export default async function install(ctx) {
  const sessionFile = process.env.ATR_NOTE_MOCK_SESSION;
  const state = { draft: "", published: "", editorSession: false };
  const target = process.env.ATR_NOTE_MOCK_TARGET;
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
    if (m) return route.fulfill({ json: { data: { id: 42, eyecatch: m[1] === target ? state.published : "https://x/img.png", updated_at: "x" } } });
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
    if (u.pathname.endsWith("/edit/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><button onclick="location.href='/notes/${target}/publish/'">公開に進む</button></body></html>` });
    if (u.pathname.endsWith("/publish/")) return route.fulfill({ contentType: "text/html; charset=utf-8", body: `<html><body><button onclick="fetch('/mock-publish',{method:'POST'}).then(()=>location.href='/notes/${target}/edit/')">更新する</button></body></html>` });
    if (u.pathname === "/mock-publish") {
      state.published = state.draft;
      return route.fulfill({ body: "ok" });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
