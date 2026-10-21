// ライセンスの判定（scripts/utils/license_resolver.mjs）を、GitHub API をモックして確かめる。
// 判定できないものは「要確認」にし、許諾の緩いライセンスを推測で当てはめないこと
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  resolveLicense,
  classifyLicenseText,
  licenseLabel,
  licensePromptText,
  licenseStatementProblems,
  LICENSE_PROMPT_RULE,
} from "../scripts/utils/license_resolver.mjs";

const MIT = `MIT License

Copyright (c) 2026 Example

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
`;
// cleanyourtv の LICENSE と同じ構成（MIT の本文の後ろに、同梱フォントの OFL の表示）
const MIT_WITH_FONT = `${MIT}
---

The Outfit typeface in launcher/app/src/main/res/font/outfit.ttf is copyright
The Outfit Project Authors and licensed under the SIL Open Font License 1.1,
see launcher/FONT-LICENSE-OFL.txt.
`;
const BUSL = `Business Source License 1.1

Parameters

Licensor:             Example Inc.
Licensed Work:        Example 1.0
Additional Use Grant: You may make production use of the Licensed Work, provided
                      Your use does not include offering the Licensed Work to third
                      parties on a hosted or embedded basis.
Change Date:          2030-01-01
Change License:       Apache License, Version 2.0
`;

// GitHub API と raw.githubusercontent.com のモック。routes: URL の部分一致 → Response を返す関数
function mockFetch(routes) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    for (const [part, respond] of Object.entries(routes)) {
      if (String(url).includes(part)) return respond();
    }
    return new Response("", { status: 404 });
  };
  return { fetchImpl, calls };
}
const apiLicense = (text, license = { key: "other", spdx_id: "NOASSERTION", name: "Other" }) => () =>
  new Response(
    JSON.stringify({ html_url: "https://github.com/o/r/blob/main/LICENSE", encoding: "base64", content: Buffer.from(text).toString("base64"), license }),
    { status: 200 },
  );

test("MIT の本文＋フォントの OFL の表示（GitHub の判定は Other）→ MIT と判定し、OFL を追加の表示にする", async () => {
  const { fetchImpl } = mockFetch({ "api.github.com/repos/o/r/license": apiLicense(MIT_WITH_FONT) });
  const r = await resolveLicense("o", "r", { fetchImpl });
  assert.equal(r.status, "resolved");
  assert.equal(r.spdx, "MIT");
  assert.equal(r.url, "https://github.com/o/r/blob/main/LICENSE");
  assert.equal(r.sourceAvailable, false);
  assert.equal(r.extraNotices.length, 1);
  assert.match(r.extraNotices[0], /SIL Open Font License 1\.1/);
  assert.equal(r.label, "MIT License（SPDX: MIT）");
  const prompt = licensePromptText(r);
  assert.match(prompt, /^MIT License（SPDX: MIT）\nライセンスの確認先: https:\/\/github\.com\/o\/r\/blob\/main\/LICENSE\nライセンスの追加の表示: .*SIL Open Font License 1\.1/);
});

test("LICENSE ファイルが無い（API が 404）→「ライセンス未指定（利用許諾なし）」。raw のファイルは取りにいかない", async () => {
  const { fetchImpl, calls } = mockFetch({});
  const r = await resolveLicense("o", "r", { fetchImpl });
  assert.equal(r.status, "none");
  assert.equal(r.spdx, null);
  assert.equal(r.label, "ライセンス未指定（利用許諾なし）");
  assert.equal(r.url, "https://github.com/o/r");
  assert.equal(calls.length, 1);
});

test("NOASSERTION で本文から分類できない独自の条件 →「要確認」と LICENSE ファイルの URL（許諾の緩いライセンスを推測しない）", async () => {
  const custom = "Copyright (c) 2026 Example. You may use this software for evaluation. Contact us for other uses.";
  const { fetchImpl } = mockFetch({ "api.github.com/repos/o/r/license": apiLicense(custom) });
  const r = await resolveLicense("o", "r", { fetchImpl });
  assert.equal(r.status, "unknown");
  assert.equal(r.spdx, null);
  assert.equal(r.label, "要確認（LICENSEファイル参照）");
  assert.equal(r.url, "https://github.com/o/r/blob/main/LICENSE");
});

test("Business Source License → ソース公開型の表記（OSI 承認の OSS ライセンスではない）", async () => {
  const { fetchImpl } = mockFetch({ "api.github.com/repos/o/r/license": apiLicense(BUSL) });
  const r = await resolveLicense("o", "r", { fetchImpl });
  assert.equal(r.status, "resolved");
  assert.equal(r.spdx, "BUSL-1.1");
  assert.equal(r.sourceAvailable, true);
  assert.match(r.label, /^Business Source License 1\.1（SPDX: BUSL-1\.1）。ソース公開型のライセンスで、OSI 承認のオープンソースライセンスではありません$/);
  assert.ok(r.extraNotices.some((n) => /Additional Use Grant/.test(n)));
  // Change License に Apache の名前があっても、Apache とは判定しない
  assert.notEqual(classifyLicenseText(BUSL).spdx, "Apache-2.0");
});

test("GitHub が MIT と判定しても、本文に Commons Clause・ソース公開型・非商用の条件があれば本文の判定を優先する", async () => {
  const cc = `"Commons Clause" License Condition v1.0\n\nThe Software is provided to you by the Licensor under the License, as defined below, subject to the following condition.\n\n${MIT}`;
  const a = await resolveLicense("o", "r", { fetchImpl: mockFetch({ "/license": apiLicense(cc, { key: "mit", spdx_id: "MIT", name: "MIT License" }) }).fetchImpl });
  assert.equal(a.status, "resolved");
  assert.equal(a.sourceAvailable, true);
  assert.match(a.name, /MIT License \+ Commons Clause/);
  const mixed = `${MIT}\n\nThe files under ee/ are licensed under the Elastic License 2.0.`;
  const b = await resolveLicense("o", "r", { fetchImpl: mockFetch({ "/license": apiLicense(mixed, { key: "mit", spdx_id: "MIT", name: "MIT License" }) }).fetchImpl });
  assert.equal(b.status, "unknown");
});

test("GitHub が判定できたライセンスは、その SPDX をそのまま使う", async () => {
  const r = await resolveLicense("o", "r", { fetchImpl: mockFetch({ "/license": apiLicense("Apache License\nVersion 2.0, January 2004", { key: "apache-2.0", spdx_id: "Apache-2.0", name: "Apache License 2.0" }) }).fetchImpl });
  assert.equal(r.status, "resolved");
  assert.equal(r.spdx, "Apache-2.0");
  assert.equal(r.label, "Apache License 2.0（SPDX: Apache-2.0）");
});

test("API が取得できない（403 等）ときは LICENSE ファイルを直接取りにいき、それも取れなければ「要確認」（ライセンス無しとはしない）", async () => {
  const forbidden = () => new Response("rate limited", { status: 403 });
  const viaRaw = await resolveLicense("o", "r", {
    fetchImpl: mockFetch({ "api.github.com": forbidden, "raw.githubusercontent.com/o/r/HEAD/LICENSE": () => new Response(MIT, { status: 200 }) }).fetchImpl,
  });
  assert.equal(viaRaw.status, "resolved");
  assert.equal(viaRaw.spdx, "MIT");
  assert.equal(viaRaw.url, "https://github.com/o/r/blob/HEAD/LICENSE");

  const dual = await resolveLicense("o", "r", {
    fetchImpl: mockFetch({
      "api.github.com": forbidden,
      "HEAD/LICENSE-MIT": () => new Response(MIT, { status: 200 }),
      "HEAD/LICENSE-APACHE": () => new Response("Apache License\nVersion 2.0, January 2004\nTERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION", { status: 200 }),
    }).fetchImpl,
  });
  assert.equal(dual.spdx, "MIT OR Apache-2.0");

  const nothing = await resolveLicense("o", "r", { fetchImpl: mockFetch({ "api.github.com": forbidden }).fetchImpl });
  assert.equal(nothing.status, "unknown");
  assert.match(nothing.extraNotices[0], /HTTP 403/);
  const offline = await resolveLicense("o", "r", { fetchImpl: async () => { throw new Error("ECONNRESET"); } });
  assert.equal(offline.status, "unknown");
  assert.match(offline.extraNotices[0], /通信エラー/);
});

test("本文からの分類: 主要なライセンスを特徴的な文言で判定し、複数の本文や非商用の条件は「要確認」", () => {
  const gpl3 = "                    GNU GENERAL PUBLIC LICENSE\n                       Version 3, 29 June 2007\n";
  const gpl2 = "== GNU GENERAL PUBLIC LICENSE ==\n\nVersion 2, June 1991\n";
  const agpl = "                    GNU AFFERO GENERAL PUBLIC LICENSE\n                       Version 3, 19 November 2007\n";
  const bsd3 = "Redistribution and use in source and binary forms, with or without modification, are permitted. Neither the name of the copyright holder nor the names";
  const isc = "Permission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted";
  assert.equal(classifyLicenseText(gpl3).spdx, "GPL-3.0");
  assert.equal(classifyLicenseText(gpl2).spdx, "GPL-2.0");
  assert.equal(classifyLicenseText(agpl).spdx, "AGPL-3.0");
  assert.equal(classifyLicenseText(bsd3).spdx, "BSD-3-Clause");
  assert.equal(classifyLicenseText(isc).spdx, "ISC");
  assert.equal(classifyLicenseText("Mozilla Public License Version 2.0").spdx, "MPL-2.0");
  assert.equal(classifyLicenseText("This is free and unencumbered software released into the public domain.").spdx, "Unlicense");
  assert.equal(classifyLicenseText("This project is distributed under the Sustainable Use License (fair-code).").sourceAvailable, true);
  assert.equal(classifyLicenseText(`${MIT}\n${gpl3}`).status, "unknown");
  assert.equal(classifyLicenseText("Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License").status, "unknown");
  assert.equal(classifyLicenseText("Licensed under MIT").status, "unknown", "名前の言及だけでは判定しない");
  assert.equal(classifyLicenseText("").status, "unknown");
  assert.equal(licenseLabel(undefined), "要確認（LICENSEファイル参照）");
});

test("Web 記事のライセンスの節が判定結果と食い違っていれば検出する（節が無い記事は対象外）", () => {
  const page = (section) => `---\ntitle: "x"\n---\n# x\n## 概要\n本文\n## 商用利用可否 & ライセンス考察\n${section}\n`;
  const none = { status: "none" };
  const unknown = { status: "unknown" };
  const mit = { status: "resolved", spdx: "MIT", name: "MIT License" };
  const busl = { status: "resolved", spdx: "BUSL-1.1", name: "Business Source License 1.1", sourceAvailable: true };
  assert.deepEqual(licenseStatementProblems("# x\n## 概要\n本文", none), []);
  assert.deepEqual(licenseStatementProblems(page("ライセンス未指定（利用許諾なし）のため、利用前に著作権者へ確認してください。"), none), []);
  assert.ok(licenseStatementProblems(page("MIT License なので商用利用は可能です。"), none).length >= 1);
  assert.deepEqual(licenseStatementProblems(page("要確認（LICENSE ファイル参照）。商用利用が可能かどうかは判断できません。"), unknown), []);
  assert.ok(licenseStatementProblems(page("商用利用は可能と解釈できます。"), unknown).length >= 1);
  assert.deepEqual(licenseStatementProblems(page("**MIT License** で公開されています。"), mit), []);
  assert.ok(licenseStatementProblems(page("Apache License 2.0 で公開されています。"), mit).length === 1);
  assert.deepEqual(licenseStatementProblems(page("Business Source License 1.1（BUSL）です。本番利用の条件は LICENSE ファイルの Additional Use Grant を確認してください。"), busl), []);
});

test("生成プロンプトの指示に、推測の禁止・要確認の書き方・追加の表示が含まれ、生成スクリプトが使っている", () => {
  for (const term of ["推測しない", "禁止の記載が無いことを利用できる根拠にしない", "「要確認」と書き", "ライセンス未指定（利用許諾なし）", "追加の表示"]) {
    assert.ok(LICENSE_PROMPT_RULE.includes(term), term);
  }
  const src = fs.readFileSync("scripts/crawl_and_generate.mjs", "utf8");
  assert.match(src, /\$\{LICENSE_PROMPT_RULE\}/);
  assert.match(src, /licensePromptText\(await licenseFor\(repo\)\)/);
  assert.match(src, /licenseStatementProblems\(result\.web, await licenseFor\(repo\)\)/);
  // GitHub の検索結果のライセンス欄（"Other" 等）をプロンプトに使わない
  assert.doesNotMatch(src, /repo\.license\?\.(?:name|spdx_id)/);
});
