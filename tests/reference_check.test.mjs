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
