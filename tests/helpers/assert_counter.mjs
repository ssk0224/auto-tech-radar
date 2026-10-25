// node:assert（と node:assert/strict・t.assert）の関数が、どのテストの中で呼ばれたかを数え、一つも呼ばずに通ったテストを、終わった直後（afterEach）に失敗にする。
// プロセス全体の回数で数えると、並行に走る隣のテストのアサーションで空振りのテストが緑になる。どのテストの中かは、非同期の文脈（async_hooks）でたどる:
// テストの本体は node:test の Test（AsyncResource）の中で走り、その中で作られた Promise・タイマーなどは、作られたときのテストを受け継ぐ。
// skip（宣言・t.skip）・todo のテストは数えない。子テストのアサーションは親にも数える。
// もう一つ、ファイル全体の空振り: テストを一つも登録しなかったファイル・走らせ終える前に process.exit した（Windows だけ抜ける等）ファイルを失敗にする。
// node:test の内部（Test の name・parent・passed・endTime）に頼るので、それが変わって見つけられなくなったら、黙って通さず失敗にする。
import fs from "fs";
import module from "node:module";
import { createHook, executionAsyncResource } from "node:async_hooks";

export function countAssertions() {
  const require = module.createRequire(import.meta.url);
  const OWNER = Symbol("auto-tech-radar.test");
  const tests = new Set();
  createHook({
    init(id, type, trigger, resource) {
      if (type === "Test") {
        resource[OWNER] = resource;
        if (resource.constructor?.name === "Test") tests.add(resource); // Suite（describe）・TestHook（beforeEach など）は数えない
        return;
      }
      const owner = executionAsyncResource()?.[OWNER];
      if (owner) resource[OWNER] = owner;
    },
  }).enable();
  const counts = new Map();
  const count = () => {
    for (let t = executionAsyncResource()?.[OWNER]; t; t = t.parent) counts.set(t, (counts.get(t) ?? 0) + 1);
  };
  const assertModule = require("node:assert");
  for (const obj of [assertModule, assertModule.strict]) {
    for (const [k, f] of Object.entries(obj)) {
      if (typeof f !== "function" || k === "strict" || /^[A-Z]/.test(k)) continue; // AssertionError などのクラス
      obj[k] = function (...args) {
        count();
        return f.apply(this, args);
      };
    }
  }

  const fullName = (t) => {
    const names = [];
    for (; t && t.parent; t = t.parent) names.unshift(t.name);
    return names.join(" > ");
  };
  const checked = new Set();
  const { afterEach, after } = require("node:test");
  afterEach((ctx) => {
    if (!ctx.passed) return; // 失敗したテストは、すでに赤
    // いま終わったテスト: 名前が同じで、通ったばかり（passed）で、まだ終了時刻の無いもの
    const t = [...tests].find((x) => !checked.has(x) && x.passed && !x.endTime && fullName(x) === ctx.fullName);
    if (!t) throw new Error(`空振りの検査が、終わったテストを見つけられない（node:test の内部が変わった）: ${ctx.fullName}。tests/helpers/assert_counter.mjs を直す`);
    checked.add(t);
    if (t.skipped || t.isTodo) return;
    if (!(counts.get(t) > 0)) {
      throw new Error("テストがアサーションを一つも実行していない（何も検証せずに緑になる）。環境が無くて実行できないなら t.skip(理由) にする。assert(x) の直接呼び出しは数えられないので assert.ok(x) を使う（tests/helpers/assert_counter.mjs）");
    }
  });

  let finished = false;
  after(() => {
    finished = true;
    // テストが一つも無いとき、root の after の例外は合否に数えられない（node:test）ので、終了コードで止める
    if (![...tests].some((t) => t.parent)) none = true; // root（parent の無い Test）は数えない
  });
  let none = false;
  process.on("exit", () => {
    if (!none) return;
    fs.writeSync(2, "\nこのテストファイルではテストが一つも登録されなかった（環境で分けて登録しないと、何も検証せずに緑になる。skip(理由) にする）\n");
    process.exitCode = 1;
  });
  const unfinished = "\nテストを走らせ終える前に、テストファイルのプロセスが終わった（process.exit など）。何も検証せずに緑になるので失敗にする（環境で分けるなら skip(理由)）\n";
  const reallyExit = process.reallyExit;
  process.reallyExit = function (code) {
    if (!finished && !code) {
      fs.writeSync(2, unfinished);
      code = 1;
    }
    return reallyExit.call(this, code);
  };
  process.on("exit", (code) => {
    if (!finished && !code) {
      fs.writeSync(2, unfinished);
      process.exitCode = 1;
    }
  });
}
