// note.com の非公開 API の代わり（note_browser.mjs のテスト用）。zcode だけ見出し画像が未設定で、アップロードすると設定される
export const uploads = [];
export default async function install(ctx) {
  const state = {};
  await ctx.route("https://note.com/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.pathname === "/notes") return route.fulfill({ body: "<html><body>notes</body></html>", contentType: "text/html" });
    const m = u.pathname.match(/^\/api\/v3\/notes\/(n\w+)$/);
    if (m) {
      const key = m[1];
      const isTarget = process.env.ATR_NOTE_MOCK_TARGET === key;
      return route.fulfill({ json: { data: { id: 42, eyecatch: isTarget ? state.eyecatch || "" : "https://x/img.png" } } });
    }
    if (u.pathname === "/api/v1/image_upload/note_eyecatch") {
      const body = req.postDataBuffer().toString("latin1");
      if (!/name="note_id"\r\n\r\n42/.test(body) || !body.includes("Content-Type: image/png")) return route.fulfill({ status: 500, body: "bad form" });
      state.eyecatch = "https://img/uploaded.png";
      return route.fulfill({ json: { data: { url: state.eyecatch } } });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}
