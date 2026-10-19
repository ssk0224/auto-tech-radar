// 生成スクリプトのテスト用: Gemini と外部 API（GitHub・レジストリ）をモックする
import { register } from "node:module";
register("./mock_hooks.mjs", import.meta.url);
const repo = { name: "testtool", full_name: "acme/testtool", html_url: "https://github.com/acme/testtool", description: "A test tool for verifying the generation pipeline end to end", language: "Go", stargazers_count: 1234, fork: false, owner: { login: "acme" }, license: { spdx_id: "MIT" } };
globalThis.fetch = async (url) => {
  url = String(url);
  if (url.includes("/search/repositories")) return new Response(JSON.stringify({ items: [repo] }), { status: 200 });
  if (url.includes("/readme")) return new Response("# testtool\nInstall: go install acme/testtool@latest", { status: 200 });
  if (url.startsWith("https://ghcr.io/token")) return new Response("denied", { status: 403 }); // 匿名で取得できないイメージ
  if (url.startsWith("https://hub.docker.com/")) return new Response("{}", { status: 200 });
  return new Response("", { status: 404 });
};
