// Dockerfile の参照抽出が、ステージ名や変数入りイメージを実在確認の対象にしないことを確かめる
import test from "node:test";
import assert from "node:assert/strict";
import { extractReferences } from "../scripts/utils/reference_check.mjs";

test("マルチステージのステージ名はイメージとして抽出しない", () => {
  const df = "FROM node:20 AS deps\nFROM deps AS builder\nFROM builder\nFROM nginx:1.27 AS Runner\nFROM runner\nCOPY --from=builder /app /app\n";
  assert.deepEqual(extractReferences(df).images.sort(), ["nginx:1.27", "node:20"]);
});

test("ステージ名は大文字小文字を区別せず除外する", () => {
  assert.deepEqual(extractReferences("FROM golang:1.22 AS Build\nFROM BUILD\n").images, ["golang:1.22"]);
});

test("scratch と ${VAR} 入りの ARG イメージは対象外", () => {
  const df = "ARG BASE=node\nFROM ${BASE}\nFROM node:${V}\nFROM $BASE\nFROM scratch\nFROM --platform=linux/amd64 alpine:3.20\n";
  assert.deepEqual(extractReferences(df).images, ["alpine:3.20"]);
});

test("Python の `from x import y` をイメージとして抽出しない", () => {
  assert.deepEqual(extractReferences("```python\nfrom fastapi import FastAPI\nfrom os import path\n```\n").images, []);
});

test("pip / npx の VCS・URL 指定（git+https://…、https://…whl）は、パッケージ名として実在確認しない", () => {
  // PyPI に "git" というパッケージは無いため、以前は README どおりの `pip install git+https://…` を含む原稿が「実在しない参照」で不採用になっていた
  const text = "pip install git+https://github.com/acme/tool.git\nuv pip install git+ssh://git@github.com/acme/x\npipx install https://example.com/x-1.0-py3-none-any.whl\npip install requests==2.32.0\npip install -U uv\nnpx github:acme/tool\n";
  const refs = extractReferences(text);
  assert.deepEqual(refs.pypi.sort(), ["requests", "uv"]);
  assert.deepEqual(refs.npm, []);
});

test("docker-compose で build: と並ぶ image:（自分でビルドするイメージの名前）は、レジストリの実在確認の対象にしない", () => {
  // README に公式イメージが無いときの「自作のコンテナ化例」で生成モデルがよく書く形。以前は Docker Hub に無いため不採用になっていた
  const compose = "services:\n  app:\n    build: .\n    image: testtool:latest\n    ports:\n      - \"8080:8080\"\n  db:\n    image: postgres:16-alpine\n  worker:\n    image: acme/worker:dev\n    build:\n      context: ./worker\n";
  assert.deepEqual(extractReferences(compose).images, ["postgres:16-alpine"]);
});

test("参照の実在確認: 確認できなかった参照（レート制限・通信の失敗・対象外のレジストリ）は unverified として返し、「実在する」に数えない", async () => {
  const { checkReferences, findMissingReferences } = await import("../scripts/utils/reference_check.mjs");
  const text = "FROM node:20\nFROM quay.io/acme/tool:1\nFROM ghost-image-xyz:1\nnpx -y some-pkg\npip install requests\n";
  const fetchImpl = async (url) => {
    if (url.includes("hub.docker.com") && url.includes("library/node")) return new Response("", { status: 429 });
    if (url.includes("ghost-image-xyz")) return new Response("", { status: 404 });
    if (url.includes("registry.npmjs.org")) throw new Error("fetch failed");
    return new Response("{}", { status: 200 });
  };
  const r = await checkReferences(text, { fetchImpl });
  assert.deepEqual(r.missing, ["image ghost-image-xyz:1"]);
  assert.deepEqual(r.unverified.sort(), ["image node:20", "image quay.io/acme/tool:1", "npm some-pkg"]);
  // 以前の呼び出し方（実在しないと確認できたものだけ）はそのまま
  assert.deepEqual(await findMissingReferences(text, { fetchImpl }), ["image ghost-image-xyz:1"]);
});

test("生成スクリプトは参照の未確認の件数をログに出す（参照の名前は出さない: 有料部分の文面を含みうる）", async () => {
  const { readText } = await import("./helpers/read_src.mjs");
  const src = readText("scripts/crawl_and_generate.mjs");
  assert.match(src, /const refs = await checkReferences\(/);
  assert.match(src, /refs\.unverified\.length/);
  assert.doesNotMatch(src, /refs\.unverified\.join/);
});
