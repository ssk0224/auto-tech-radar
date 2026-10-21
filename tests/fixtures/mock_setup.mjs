// 生成スクリプトのテスト用: Gemini と外部 API（GitHub・レジストリ）をモックする
import { register } from "node:module";
register("./mock_hooks.mjs", import.meta.url);
// MOCK_REPO（JSON）があれば、検索結果の 1 件目の項目をその値で上書きする（リポジトリ名・説明文など実データの揺れの再現用）
const repo = { name: "testtool", full_name: "acme/testtool", html_url: "https://github.com/acme/testtool", description: "A test tool for verifying the generation pipeline end to end", language: "Go", topics: ["cli", "devops", "hacktoberfest"], stargazers_count: 1234, created_at: "2026-01-15T00:00:00Z", fork: false, owner: { login: "acme" }, license: { spdx_id: "MIT" }, ...(process.env.MOCK_REPO ? JSON.parse(process.env.MOCK_REPO) : {}) };
// MOCK_NOW（ミリ秒）があれば、生成スクリプトから見た現在時刻をその時刻にずらす（既存記事の公開日を書き換えずに「本日分」を避ける）
if (process.env.MOCK_NOW) {
  const offset = Number(process.env.MOCK_NOW) - Date.now();
  const realNow = Date.now;
  Date.now = () => realNow() + offset;
}
// MOCK_SECOND_REPO があれば候補を 2 件にする（1 回の実行で生成する本数の上限を確かめる。同じオーナーは選定の上限で外れるため別オーナーにする）
const items = process.env.MOCK_SECOND_REPO ? [repo, { ...repo, name: "othertool", full_name: "other/othertool", html_url: "https://github.com/other/othertool", owner: { login: "other" } }] : [repo];
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes("/search/repositories")) return new Response(JSON.stringify({ items }), { status: 200 });
  if (url.includes("/readme")) return new Response("# testtool\nInstall: go install acme/testtool@latest", { status: 200 });
  // LICENSE ファイル（/repos/{o}/{r}/license）。MOCK_LICENSE_TEXT があればその本文を GitHub の判定 "Other"（NOASSERTION）で返し、無ければ 404（LICENSE ファイル無し）
  if (url.includes("/license") && process.env.MOCK_LICENSE_TEXT) {
    return new Response(JSON.stringify({ html_url: "https://github.com/acme/testtool/blob/main/LICENSE", encoding: "base64", content: Buffer.from(process.env.MOCK_LICENSE_TEXT).toString("base64"), license: { key: "other", spdx_id: "NOASSERTION", name: "Other" } }), { status: 200 });
  }
  if (url.startsWith("https://ghcr.io/token")) return new Response("denied", { status: 403 }); // 匿名で取得できないイメージ
  if (url.startsWith("https://hub.docker.com/")) return new Response("{}", { status: 200 });
  return new Response("", { status: 404 });
};
