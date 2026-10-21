// リポジトリのライセンスを LICENSE ファイルの本文から判定する（2026-10-21）。
// GitHub の検索結果のライセンス欄（"Other" / NOASSERTION など）をそのまま生成モデルに渡すと、
// モデルが「明示的な禁止が無いので商用利用できる」のように推測で書いてしまうため、ここで判定した表記だけを渡す。
// 方針: 確実に分類できない場合は「要確認」にする。許諾の緩いライセンスを推測で当てはめることはしない。

// ライセンス本文そのもの（許諾文）に現れる特徴的な文言。名前が言及されているだけでは一致しない
const FULL_TEXTS = [
  {
    spdx: "MIT",
    name: "MIT License",
    test: (t) => /Permission is hereby granted, free of charge, to any person obtaining a copy/i.test(t) && /above copyright notice and this permission notice shall be included/i.test(t),
  },
  {
    spdx: "MIT-0",
    name: "MIT No Attribution",
    test: (t) => /Permission is hereby granted, free of charge, to any person obtaining a copy/i.test(t) && !/above copyright notice and this permission notice shall be included/i.test(t),
  },
  {
    spdx: "Apache-2.0",
    name: "Apache License 2.0",
    test: (t) => /Apache License\s*,?\s*Version 2\.0/i.test(t) && (/TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION/i.test(t) || /Licensed under the Apache License, Version 2\.0 \(the "License"\)/i.test(t)),
  },
  {
    spdx: "BSD-3-Clause",
    name: "BSD 3-Clause License",
    test: (t) => /Redistribution and use in source and binary forms/i.test(t) && /Neither the name of/i.test(t),
  },
  {
    spdx: "BSD-2-Clause",
    name: "BSD 2-Clause License",
    test: (t) => /Redistribution and use in source and binary forms/i.test(t) && !/Neither the name of|endorse or promote/i.test(t),
  },
  // GPL 系は見出し（大文字）で区別する（本文中の他の GPL 系への言及では一致させない）
  // （見出しの装飾 "== GNU GENERAL PUBLIC LICENSE ==" のような記号は間に挟まってもよい）
  { spdx: "AGPL-3.0", name: "GNU Affero General Public License v3.0", test: (t) => /GNU AFFERO GENERAL PUBLIC LICENSE[\s=#*]*Version 3/.test(t) },
  { spdx: "GPL-3.0", name: "GNU General Public License v3.0", test: (t) => /GNU GENERAL PUBLIC LICENSE[\s=#*]*Version 3/.test(t) },
  { spdx: "GPL-2.0", name: "GNU General Public License v2.0", test: (t) => /GNU GENERAL PUBLIC LICENSE[\s=#*]*Version 2,/.test(t) },
  { spdx: "LGPL-3.0", name: "GNU Lesser General Public License v3.0", test: (t) => /GNU LESSER GENERAL PUBLIC LICENSE[\s=#*]*Version 3/.test(t) },
  { spdx: "LGPL-2.1", name: "GNU Lesser General Public License v2.1", test: (t) => /GNU LESSER GENERAL PUBLIC LICENSE[\s=#*]*Version 2\.1/.test(t) },
  { spdx: "MPL-2.0", name: "Mozilla Public License 2.0", test: (t) => /Mozilla Public License,?\s+(?:Version|v\.)\s*2\.0/i.test(t) },
  {
    spdx: "ISC",
    name: "ISC License",
    test: (t) => /Permission to use, copy, modify, and\/or distribute this software for any\s+purpose with or without fee is hereby granted/i.test(t),
  },
  { spdx: "Unlicense", name: "The Unlicense", test: (t) => /This is free and unencumbered software released into the public domain/i.test(t) },
  { spdx: "BSL-1.0", name: "Boost Software License 1.0", test: (t) => /Boost Software License\s*-\s*Version 1\.0/i.test(t) },
  { spdx: "OFL-1.1", name: "SIL Open Font License 1.1", test: (t) => /SIL OPEN FONT LICENSE\s*Version 1\.1/i.test(t) && /PERMISSION & CONDITIONS/i.test(t) },
];

// ソース公開型（OSI 承認のオープンソースライセンスではない）・利用制限つきのライセンス
const RESTRICTED = [
  { key: "busl", spdx: "BUSL-1.1", name: "Business Source License 1.1", re: /Business Source License/i, note: "本番利用の条件（Additional Use Grant）と Change Date は LICENSE ファイル参照" },
  { key: "sul", spdx: null, name: "Sustainable Use License（fair-code）", re: /Sustainable Use License|fair-code/i, note: "商用利用・再配布の条件は LICENSE ファイル参照" },
  { key: "elastic", spdx: "Elastic-2.0", name: "Elastic License 2.0", re: /Elastic License(?:,? (?:Version )?2\.0| v2)/i, note: "マネージドサービスとしての提供などに制限あり。条件は LICENSE ファイル参照" },
  { key: "sspl", spdx: "SSPL-1.0", name: "Server Side Public License v1", re: /Server Side Public License/i, note: "サービスとして提供する場合の条件は LICENSE ファイル参照" },
  { key: "polyform", spdx: null, name: "PolyForm License", re: /PolyForm (?:Noncommercial|Shield|Small Business|Strict|Internal Use|Perimeter|Free Trial)/i, note: "利用目的に制限あり。条件は LICENSE ファイル参照" },
];
const COMMONS_CLAUSE = /Commons Clause/i;
// 名前の明示は無いが、商用利用を禁じる文言
const NONCOMMERCIAL = /non-?commercial (?:use|purposes) only|for non-?commercial purposes|may not (?:be used|use (?:the|this) (?:Software|material|work)) for (?:any )?commercial purposes|Attribution-NonCommercial/i;

// 主たるライセンスとは別に、一部のファイルに付く追加の表示（フォントなど）
const NOTICES = [
  { spdx: "OFL-1.1", re: /SIL Open Font License/i, text: "一部のファイル（フォント等）は SIL Open Font License 1.1（LICENSE ファイルに記載）" },
  { spdx: "CC", re: /Creative Commons/i, text: "一部のファイルは Creative Commons ライセンス（LICENSE ファイルに記載）" },
];

const familyOf = (spdx) => String(spdx || "").split(/[-.]/)[0].toUpperCase();

// LICENSE ファイルの本文からライセンスを判定する（ネットワークを使わない）
// 戻り値: { spdx, name, status: "resolved" | "unknown", sourceAvailable, extraNotices[] }
export function classifyLicenseText(text) {
  // 折り返し位置の違いで一致しなくならないよう、空白をそろえてから調べる
  const t = String(text || "").replace(/\s+/g, " ");
  const notices = (primarySpdx) =>
    NOTICES.filter((n) => n.re.test(t) && familyOf(n.spdx) !== familyOf(primarySpdx)).map((n) => n.text);
  const unknown = (reason) => ({ spdx: null, name: null, status: "unknown", sourceAvailable: false, extraNotices: reason ? [reason] : [] });
  if (!t.trim()) return unknown("LICENSE ファイルの本文を取得できませんでした");

  let full = FULL_TEXTS.filter((l) => l.test(t));
  // フォント用の OFL は、他のライセンスと並んでいるときは追加の表示として扱う
  if (full.length > 1) full = full.filter((l) => l.spdx !== "OFL-1.1");
  const restricted = RESTRICTED.filter((r) => r.re.test(t));

  if (COMMONS_CLAUSE.test(t)) {
    if (full.length !== 1 || restricted.length) return unknown("Commons Clause の記載があります（利用条件は LICENSE ファイル参照）");
    return {
      spdx: null,
      name: `${full[0].name} + Commons Clause`,
      status: "resolved",
      sourceAvailable: true,
      extraNotices: ["Commons Clause によりソフトウェアの販売（有償提供）に制限あり。条件は LICENSE ファイル参照", ...notices(full[0].spdx)],
    };
  }
  if (restricted.length) {
    // ソース公開型ライセンスと OSS ライセンスの本文が混在する（ディレクトリごとに異なる等）場合は判断しない
    if (restricted.length > 1 || full.length) return unknown("ソース公開型ライセンスの記載があります（対象範囲は LICENSE ファイル参照）");
    const r = restricted[0];
    return { spdx: r.spdx, name: r.name, status: "resolved", sourceAvailable: true, extraNotices: [r.note, ...notices(r.spdx)] };
  }
  if (NONCOMMERCIAL.test(t)) return unknown("非商用の条件を含む記載があります（条件は LICENSE ファイル参照）");
  if (full.length !== 1) return unknown(full.length > 1 ? "複数のライセンスの本文が含まれています" : "");
  return { spdx: full[0].spdx, name: full[0].name, status: "resolved", sourceAvailable: false, extraNotices: notices(full[0].spdx) };
}

// 生成モデル・ページに出すライセンスの表記
export function licenseLabel(info) {
  if (!info || info.status === "unknown") return "要確認（LICENSEファイル参照）";
  if (info.status === "none") return "ライセンス未指定（利用許諾なし）";
  const base = info.spdx ? `${info.name}（SPDX: ${info.spdx}）` : info.name;
  const kind = info.sourceAvailable ? "。ソース公開型のライセンスで、OSI 承認のオープンソースライセンスではありません" : "";
  return `${base}${kind}`;
}

const RAW_CANDIDATES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md", "COPYING", "license", "License.txt"];

const finalize = (o) => ({ extraNotices: [], ...o, label: licenseLabel(o) });

// GitHub REST API（/repos/{owner}/{repo}/license）で LICENSE ファイルを取得して判定する。
// 404 は「LICENSE ファイルが無い」。それ以外の取得失敗では raw.githubusercontent.com の代表的なファイル名を試し、
// それでも取れなければ「要確認」にする（取得できないことを「ライセンス無し」とは扱わない）
export async function resolveLicense(owner, repo, { fetchImpl = globalThis.fetch, headers = {}, timeoutMs = 15000 } = {}) {
  const repoUrl = `https://github.com/${owner}/${repo}`;
  const get = (url, accept) =>
    fetchImpl(url, { headers: { ...headers, ...(accept ? { Accept: accept } : {}) }, signal: AbortSignal.timeout(timeoutMs) });

  let apiStatus = 0;
  try {
    const res = await get(`https://api.github.com/repos/${owner}/${repo}/license`, "application/vnd.github+json");
    apiStatus = res.status;
    if (res.status === 404) {
      return finalize({ spdx: null, name: null, url: repoUrl, status: "none", sourceAvailable: false });
    }
    if (res.ok) {
      const data = await res.json();
      const text = data.content ? Buffer.from(data.content, data.encoding || "base64").toString("utf8") : "";
      const url = data.html_url || repoUrl;
      const gh = data.license || {};
      const ghKnown = gh.spdx_id && gh.spdx_id !== "NOASSERTION" && gh.key !== "other";
      const c = classifyLicenseText(text);
      if (ghKnown) {
        // GitHub が判定できたライセンスでも、ソース公開型・非商用の追加条件が本文にあれば本文の判定を優先する
        if (c.sourceAvailable || (c.status === "unknown" && (RESTRICTED.some((r) => r.re.test(text)) || COMMONS_CLAUSE.test(text) || NONCOMMERCIAL.test(text)))) {
          return finalize({ ...c, url });
        }
        const notices = NOTICES.filter((n) => n.re.test(text) && familyOf(n.spdx) !== familyOf(gh.spdx_id)).map((n) => n.text);
        return finalize({ spdx: gh.spdx_id, name: gh.name || gh.spdx_id, url, status: "resolved", sourceAvailable: false, extraNotices: notices });
      }
      return finalize({ ...c, url });
    }
  } catch (err) {
    apiStatus = -1;
  }

  // API で取得できなかった（レート制限・通信エラー等）: LICENSE ファイルを直接取りにいく
  for (const file of RAW_CANDIDATES) {
    try {
      const res = await get(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`);
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim()) continue;
      return finalize({ ...classifyLicenseText(text), url: `${repoUrl}/blob/HEAD/${file}` });
    } catch {
      // 次の候補へ
    }
  }
  // Rust 系に多い LICENSE-MIT と LICENSE-APACHE の 2 ファイル構成（どちらかを選べるデュアルライセンス）
  const dual = [];
  for (const file of ["LICENSE-MIT", "LICENSE-APACHE"]) {
    try {
      const res = await get(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file}`);
      if (res.ok) dual.push(classifyLicenseText(await res.text()));
    } catch {
      // 取得できなければ判定しない
    }
  }
  if (dual.length === 2 && dual[0].spdx === "MIT" && dual[1].spdx === "Apache-2.0") {
    return finalize({ spdx: "MIT OR Apache-2.0", name: "MIT License または Apache License 2.0（選択できるデュアルライセンス）", url: `${repoUrl}/blob/HEAD/LICENSE-MIT`, status: "resolved", sourceAvailable: false, extraNotices: [] });
  }
  const why = apiStatus === -1 ? "通信エラー" : `HTTP ${apiStatus}`;
  return finalize({ spdx: null, name: null, url: repoUrl, status: "unknown", sourceAvailable: false, extraNotices: [`ライセンス情報を取得できませんでした（${why}）`] });
}

// 生成プロンプトの「ライセンス:」欄に入れる文面（表記・確認先・追加の表示）
export function licensePromptText(info) {
  const lines = [licenseLabel(info)];
  if (info?.url) lines.push(`ライセンスの確認先: ${info.url}`);
  if (info?.extraNotices?.length) lines.push(`ライセンスの追加の表示: ${info.extraNotices.join(" / ")}`);
  return lines.join("\n");
}

// 生成プロンプトに入れるライセンスの書き方の指示
export const LICENSE_PROMPT_RULE = `- ライセンスは[リポジトリ情報]の「ライセンス」欄（LICENSE ファイルの本文から判定した表記）だけを根拠に書くこと。GitHub の表示（Other 等）や README の印象から別のライセンスを推測しないこと。
- 「明示的に禁止されていないので利用できる」「慣例として許容されることが多い」のように、禁止の記載が無いことを利用できる根拠にしないこと。
- ライセンス欄が「要確認」の場合は商用利用の可否を判断せず「要確認」と書き、「ライセンスの確認先」の URL を示すこと。「ライセンス未指定（利用許諾なし）」の場合は、著作権者の許諾なしに利用・改変・再配布できない可能性があると書くこと。
- 「ライセンスの追加の表示」がある場合（フォント等に別のライセンスが付く、ソース公開型である等）は、それも書くこと。`;

// Web 記事のライセンスの節（見出しに「ライセンス」を含む節）が、判定結果と食い違っていないかを調べる。
// 節が無い記事は対象外（ライセンスについて何も書いていなければ食い違いも無い）
export function licenseStatementProblems(markdown, info) {
  const body = String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const m = body.match(/^#{2,3}[^\n]*ライセンス[^\n]*\n([\s\S]*?)(?=^#{1,2} |(?![\s\S]))/m);
  if (!m || !info) return [];
  const section = m[1];
  const problems = [];
  const affirmsCommercial = /商用(?:利用|での利用|目的での利用)(?:は|が|も)?(?:可能(?!か)|自由に|問題な|できます)/;
  if (info.status === "none") {
    if (!/ライセンス未指定|利用許諾なし|LICENSE ?ファイルが(?:無|な|見つから|存在しな)/.test(section)) problems.push("LICENSE ファイルが無いのに、ライセンス未指定である旨が書かれていない");
    if (affirmsCommercial.test(section)) problems.push("ライセンス未指定なのに商用利用できると書いている");
  } else if (info.status === "unknown") {
    if (!/要確認/.test(section)) problems.push("ライセンスを判定できないのに「要確認」と書かれていない");
    if (affirmsCommercial.test(section)) problems.push("ライセンスが要確認なのに商用利用できると書いている");
  } else {
    const family = familyOf(info.spdx || info.name);
    const aliases = {
      MIT: /MIT/,
      APACHE: /Apache/i,
      BSD: /BSD/,
      GPL: /GPL|General Public License/,
      AGPL: /AGPL|Affero/,
      LGPL: /LGPL|Lesser General Public/,
      MPL: /MPL|Mozilla Public/,
      ISC: /ISC/,
      UNLICENSE: /Unlicense/i,
      BSL: /Boost|BSL/,
      BUSL: /Business Source|BUSL|BSL/,
      OFL: /OFL|Open Font/,
      ELASTIC: /Elastic/,
      SSPL: /SSPL|Server Side Public/,
    };
    const want = aliases[family] || new RegExp(String(info.name || "").split(/[\s（(]/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (!want.test(section)) problems.push(`ライセンスの節に LICENSE ファイルのライセンス（${info.spdx || info.name}）が書かれていない`);
    if (info.sourceAvailable && affirmsCommercial.test(section) && !/条件|制限|LICENSE ?ファイル/.test(section)) problems.push("ソース公開型ライセンスなのに条件を示さず商用利用できると書いている");
  }
  return problems;
}
