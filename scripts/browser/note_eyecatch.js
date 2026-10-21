// note.com にログインしたブラウザ（note.com のページ）の DevTools コンソールで実行する見出し画像の一括設定。
// ローカルの note_api_server（http://127.0.0.1:18921）から対象記事と画像を受け取り、
// 見出し画像が未設定の記事だけにアップロードし、設定されたことを読み直して確認する。
// note に公式 API は無く、これは note のエディタが使う非公開エンドポイント（予告なく変わりうる）を使う。
(async () => {
  const BRIDGE = "http://127.0.0.1:18921";
  const log = async (text) => {
    console.log(text);
    try {
      await fetch(`${BRIDGE}/log`, { method: "POST", body: JSON.stringify({ text }) });
    } catch (e) {}
  };
  if (location.hostname !== "note.com") {
    console.error("note.com のページ（例: https://note.com/notes）を開いてから実行してください");
    return { set: [], skipped: [], failed: ["note.com のページではありません"] };
  }
  const xsrf = decodeURIComponent((document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/) || [])[1] || "");
  const headers = { "X-Requested-With": "XMLHttpRequest", ...(xsrf ? { "X-XSRF-TOKEN": xsrf } : {}) };
  const noteInfo = async (key) => {
    const r = await fetch(`/api/v3/notes/${key}`, { credentials: "include", headers });
    if (!r.ok) throw new Error(`記事情報の取得に失敗 HTTP ${r.status}`);
    const d = (await r.json()).data || {};
    return { id: d.id, eyecatch: d.eyecatch || "" };
  };

  const tasks = await (await fetch(`${BRIDGE}/eyecatch-tasks`)).json();
  const result = { set: [], skipped: [], failed: [] };
  for (const t of tasks) {
    try {
      const info = await noteInfo(t.key);
      if (!info.id) throw new Error("記事 ID が取得できません");
      if (info.eyecatch) {
        result.skipped.push(t.slug);
        continue;
      }
      const png = await (await fetch(`${BRIDGE}/eyecatch/${encodeURIComponent(t.slug)}.png`)).blob();
      const form = new FormData();
      form.append("note_id", String(info.id));
      form.append("width", String(t.width));
      form.append("height", String(t.height));
      // ファイル部分の Content-Type が無いと 500 になるため、型付きの File で送る
      form.append("file", new File([png], `${t.slug}.png`, { type: "image/png" }));
      const up = await fetch("/api/v1/image_upload/note_eyecatch", { method: "POST", credentials: "include", headers, body: form });
      if (!up.ok) throw new Error(`アップロード失敗 HTTP ${up.status} ${(await up.text()).slice(0, 200)}`);
      // 反映を読み直して確認する（アップロードが成功しても記事に付いていなければ失敗として扱う）
      const after = await noteInfo(t.key);
      if (!after.eyecatch) throw new Error("アップロード後も見出し画像が記事に反映されていません（下書きに付いた可能性。note の編集画面で「更新する」を押してください）");
      result.set.push(t.slug);
      await log(`✓ 見出し画像を設定: ${t.slug}`);
    } catch (e) {
      result.failed.push(`${t.slug}: ${e.message}`);
      await log(`✕ ${t.slug}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 1500)); // note への連続アクセスを避ける
  }
  await log(`見出し画像: 設定 ${result.set.length} / 設定済みのため変更なし ${result.skipped.length} / 失敗 ${result.failed.length}`);
  await fetch(`${BRIDGE}/eyecatch-complete`, { method: "POST", body: JSON.stringify(result) });
  return result;
})();
