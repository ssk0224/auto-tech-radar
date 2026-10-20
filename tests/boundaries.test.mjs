// サイト・Zenn・X・note 公開部分の内容検査（過去に実際に起きた不具合を二度と出さない）
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { stripProSection, findProLeaks } from "../scripts/utils/pro_boundary.mjs";
import { extractReferences } from "../scripts/utils/reference_check.mjs";
import { zennCta } from "../scripts/utils/funnel_copy.mjs";
import { splitPaid, isSealed, assembleNote, loadPrivateKeys } from "../scripts/utils/note_vault.mjs";
import { isNoise } from "../scripts/utils/noise_filter.mjs";
import { findForbiddenClaims } from "../scripts/utils/claims_check.mjs";
import { fixMermaidInContent, mermaidProblems } from "../scripts/utils/mermaid.mjs";

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const list = (dir, re) => fs.readdirSync(dir).filter((f) => re.test(f)).map((f) => path.join(dir, f));

test("PRO 見出し以降を Web 記事から除去する／README の MCP 設定の引用は有料扱いしない", () => {
  const md = "# t\n## 無料\n```json\n{\"mcpServers\":{}}\n```\n---\n\n## 🛠️ 【Auto Tech Radar PRO限定】商用化マニュアル\n秘密";
  const out = stripProSection(md);
  assert.ok(!out.includes("秘密"));
  assert.deepEqual(findProLeaks(out), [], "無料記事の README 引用で誤検出してビルドを止めてはいけない");
});

test("Web 記事に有料キットが無い", () => {
  for (const f of list("src/pages/radar", /\.md$/)) assert.deepEqual(findProLeaks(read(f)), [], f);
});

test("note 原稿は有料ライン以降がすべて暗号化されている", () => {
  for (const f of list("note_drafts", /_note\.md$/)) {
    const c = read(f);
    assert.ok(isSealed(c), `${f}: 有料部分が平文`);
    assert.equal(splitPaid(c).paid.length, 1, `${f}: 有料ライン以降に暗号化プレースホルダ以外がある`);
  }
});

test("Zenn 記事の送客文は共通の文面（funnel_copy）と一致する", () => {
  for (const f of [...list("articles", /\.md$/), ...list("zenn_drafts", /\.md$/)]) {
    const c = read(f);
    // zenn_drafts は <slug>_zenn.md、articles は <slug>.md または <slug>-tech-radar.md
    const slug = path.basename(f).replace(/_zenn\.md$|-tech-radar\.md$|\.md$/, "");
    assert.ok(c.includes(zennCta(slug)), `${f}: 送客文が古い`);
  }
});

// 公開される文面に出してはいけない表現（存在しない機能・架空の実績・根拠のない保証）
const FORBIDDEN = [
  [/アンロック/, "サイトに有料本文は無いのに「アンロック」をうたっている"],
  [/即受注|受注に直結|に直結します/, "受注・成果を保証する表現"],
  [/(分前|時間前).{0,40}(アンロック|購読|購入|参加)しました|(アンロック|購読|購入|参加)しました.{0,40}(分前|時間前)/, "架空の購入通知"],
  [/Math\.random\(\)[^\n]{0,40}名/, "乱数で作った閲覧者数"],
  [/全編読み放題|全記事読み放題|全レポート読み放題/, "メンバーシップで全記事が読めるかのような表現（特典に追加した記事のみ）"],
  [/完全公開されています|全編公開されています/, "サイトで有料キットを公開しているかのような表現"],
  [/社内稟議・提案書ドラフト|社内稟議テンプレ付|見積内訳付き/, "誇張表現（導入企画・提案書テンプレートを使用する）"],
  [/^===\s*(SECTION|WEB ARTICLE|NOTE ARTICLE|X THREAD)\s*===$/m, "AIプロンプトのセクション区切り文字が漏洩"],
];
function publicTexts() {
  const out = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(astro|md|js|ts|txt)$/.test(e.name)) out.push([p, read(p)]);
  });
  ["src", "articles", "zenn_drafts", "public"].forEach(walk);
  for (const f of list("note_drafts", /\.md$/)) out.push([f, read(f)]);
  for (const f of list("x_posts", /\.txt$/)) {
    const text = read(f).replace(/intent\/tweet\?text=([^\s&]+)/g, (m, q) => { try { return decodeURIComponent(q); } catch (e) { return m; } });
    out.push([f, text]);
  }
  for (const f of ["scripts/note_urls.json", "scripts/note_updates.json", "scripts/launcher.mjs", "scripts/publish_helper.mjs", "README.md"]) {
    if (fs.existsSync(f)) out.push([f, read(f)]);
  }
  return out;
}
test("公開される文面に禁止表現が無い", () => {
  const hits = [];
  for (const [f, text] of publicTexts()) {
    for (const [re, why] of FORBIDDEN) if (re.test(text)) hits.push(`${f}: ${why}`);
  }
  assert.deepEqual(hits, []);
});

test("生成物の参照抽出（イメージ・npm・PyPI）", () => {
  const r = extractReferences("services:\n  a:\n    image: ghcr.io/x/y:1\nFROM rust:1.95-slim AS builder\nnpx -y @scope/pkg@1.0 arg\npip install foo-bar\n");
  assert.deepEqual(r.images.sort(), ["ghcr.io/x/y:1", "rust:1.95-slim"]);
  assert.deepEqual(r.npm, ["@scope/pkg"]);
  assert.deepEqual(r.pypi, ["foo-bar"]);
});

// 根拠のない主張（景品表示法の優良誤認リスク）を再発させないための検査。
// 記事本文（src/pages/radar）に書かれた「想定」の見積もりは対象外で、サイトのテンプレートと生成スクリプトだけを見る
function templateSources() {
  const out = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "radar") walk(p); }
    else if (/\.(astro|js|ts)$/.test(e.name)) out.push([p, read(p)]);
  });
  walk("src");
  if (fs.existsSync("scripts/generate_og_cards.mjs")) out.push(["scripts/generate_og_cards.mjs", read("scripts/generate_og_cards.mjs")]);
  return out;
}
const TEMPLATE_FORBIDDEN = [
  [/Stripe/, "サイト独自の決済（Stripe）では有料本文を届けられない（OSS の解説記事本文は対象外）"],
  [/商用活用可能/, "全OSSに同じ「商用活用可能」を返す FAQ（ライセンスの根拠データが無い）"],
  [/"FAQPage"/, "根拠データの無い FAQ 構造化データ"],
  [/100%\s*経費/, "「100%経費精算可能」という断定（経費可否は所属先の規定による）"],
  [/経費精算可能|経費で落とせ/, "経費精算できるという断定（経費可否は所属先の規定による）"],
  [/100%遮断/, "漏洩リスクの「100%遮断」という断定"],
  [/専任(エンジニア)?チーム/, "運営は個人のため、専任チームがいるかのような表現"],
  [/想定受託単価|推奨受託単価|RANK #/, "スター数・タグから機械的に決めた単価・順位の表示"],
  [/annualSaving\s*=\s*\d/, "全OSS共通の固定の年間削減額"],
  [/document\.querySelector\(['"]article['"]\)/, "記事ページに存在しないセレクタ（#article-body を使う）"],
  [/Object\.values\(postModules\)|import\.meta\.glob\([^)]*radar\/\*\.md/, "ノイズ除外を通らない記事読み込み（src/utils/articles.js を使う）"],
];
test("サイトのテンプレートに根拠のない主張・再発させたくない実装が無い", () => {
  const hits = [];
  for (const [f, text] of templateSources()) {
    if (f.endsWith(path.join("utils", "articles.js"))) continue; // 共通ヘルパー自身は glob を持つ
    for (const [re, why] of TEMPLATE_FORBIDDEN) if (re.test(text)) hits.push(`${f}: ${why}`);
  }
  assert.deepEqual(hits, []);
});

test("公開文面に「100%経費精算可能」「専任エンジニアチームが」が無い", () => {
  const hits = [];
  for (const [f, text] of publicTexts()) {
    if (/100%\s*経費精算可能|専任エンジニアチームが/.test(text)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});

test("復号可能な環境では有料本文に禁止表現・根拠なき固定単価が無く、無料部分の予告と一致する", () => {
  let keys = [];
  try {
    keys = loadPrivateKeys();
  } catch {}
  if (keys.length === 0) return;

  const hits = [];
  for (const f of list("note_drafts", /_note\.md$/)) {
    if (isNoise(path.basename(f).replace("_note.md", ""))) continue;
    const full = assembleNote(f, keys);
    const parts = splitPaid(full);
    assert.ok(parts, `${f}: 有料ラインが分割できること`);
    const paidText = parts.paid.join("\n");
    for (const [re, why] of FORBIDDEN) {
      if (re.test(paidText)) hits.push(`${f} [有料部]: ${why} (${paidText.match(re)?.[0]})`);
    }
    const hasPrice = /80万|250万|150万|300万/.test(paidText);
    if (hasPrice) {
      const lines = paidText.split(/\r?\n/);
      const hasBasis = lines.some(l => 
        l.includes("|") && 
        (l.includes("工程") || l.includes("項目") || l.includes("業務")) && 
        (l.includes("工数") || l.includes("人日")) && 
        l.includes("単価") && 
        l.includes("小計") && 
        (l.includes("作業") || l.includes("詳細") || l.includes("内訳") || l.includes("成果物"))
      );
      assert.ok(hasBasis, `${f}: 有料部内の価格表記には積算根拠表（工程・工数・単価・小計）が必須`);
    }
  }
  assert.deepEqual(hits, []);
});

test("全Web記事のFrontmatter完全性 (stars, title, description, pubDate)", () => {
  const radarDir = path.resolve("src/pages/radar");
  const files = fs.readdirSync(radarDir).filter(f => f.endsWith(".md"));
  for (const f of files) {
    const content = fs.readFileSync(path.join(radarDir, f), "utf8");
    const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert.ok(m, `${f}: Frontmatterが存在しません`);
    const fm = Object.fromEntries(
      m[1].split(/\r?\n/)
        .map(l => l.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/))
        .filter(Boolean)
        .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")])
    );
    assert.ok(fm.title && fm.title.length > 0, `${f}: titleが空`);
    assert.ok(fm.description && fm.description.length > 0, `${f}: descriptionが空`);
    assert.ok(fm.stars !== undefined && !isNaN(Number(fm.stars)) && Number(fm.stars) >= 0, `${f}: starsが不正 (${fm.stars})`);
    assert.match(fm.pubDate, /^\d{4}-\d{2}-\d{2}$/, `${f}: pubDateがYYYY-MM-DD形式ではない`);
  }
});

test("scripts/note_urls.json は note 公開済みの全非ノイズ記事を含み、タイトルに # や禁止表現を含まない", () => {
  // 新しく生成した記事は、オーナーが note に出品するまで note_urls.json に載らない（定期実行のたびに落ちないよう、公開済みだけを見る）
  const history = JSON.parse(fs.readFileSync("scripts/publish_history.json", "utf8"));
  const nonNoise = Object.keys(history).filter((s) => history[s]?.note && !isNoise(s) && fs.existsSync(`note_drafts/${s}_note.md`));
  const raw = fs.readFileSync("scripts/note_urls.json", "utf8");

  // 重複キー検査
  const seen = new Set();
  for (const line of raw.split(/\r?\n/)) {
    const km = line.match(/^  "([^"]+)"\s*:\s*\{/);
    if (km) {
      assert.ok(!seen.has(km[1]), `note_urls.json に重複キーがあります: ${km[1]}`);
      seen.add(km[1]);
    }
  }

  const data = JSON.parse(raw);
  for (const slug of nonNoise) {
    assert.ok(data[slug], `非ノイズ記事 ${slug} が note_urls.json にありません`);
    assert.ok(!data[slug].title.startsWith("#"), `${slug}: タイトルに # プレフィックスがあります`);
    assert.deepEqual(findForbiddenClaims(data[slug].title), [], `${slug}: 禁止表現が含まれています`);
    assert.match(data[slug].url, /^https:\/\/note\.com\/[\w-]+\/n\/[a-zA-Z0-9]+$/, `${slug}: URLが不正`);
  }
});

test("全Mermaidダイアグラムは未エスケープHTMLタグ・未クォート特殊文字ラベルを含まない", () => {
  const problems = [];
  for (const dir of ["src/pages/radar", "articles"]) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".md"))) {
      for (const p of mermaidProblems(read(path.join(dir, f)))) problems.push(`${dir}/${f}: ${p}`);
    }
  }
  assert.deepEqual(problems, []);
});

test("Mermaid の補正は検査で見つかる問題をすべて直す（生成時に補正→検査で採用可否を決めるため）", () => {
  const md = "```mermaid\ngraph TD\n  A[ユーザー] --> C[画像, テキスト, 音声]\n  C --> D[API: v1 (beta)]\n  D --> E[a & b]\n  subgraph Data Layer\n  F[x<br>y]\n  end\n```";
  assert.ok(mermaidProblems(md).length > 0);
  assert.deepEqual(mermaidProblems(fixMermaidInContent(md)), []);
});

test("全Astroテンプレート内のtarget=_blankリンクには必ずrel=noopener noreferrerが付与されている", () => {
  function walk(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (fs.statSync(fp).isDirectory()) files = files.concat(walk(fp));
      else if (fp.endsWith(".astro")) files.push(fp);
    }
    return files;
  }
  const files = walk("src");
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const matches = content.match(/<a\s+[^>]*?target="_blank"[^>]*?>/gs) || [];
    for (const m of matches) {
      assert.ok(
        m.includes('rel="noopener') || m.includes("rel='noopener"),
        `${file} 内のリンクに rel="noopener noreferrer" がありません:\n${m}`
      );
    }
  }
});


test("Zenn・X の記事リンクはすべて実在する Web 記事を指す", () => {
  const broken = [];
  for (const dir of ["zenn_drafts", "articles", "x_posts"]) {
    for (const f of fs.readdirSync(dir)) {
      for (const m of read(path.join(dir, f)).matchAll(/auto-tech-radar\/radar\/([a-z0-9_.-]+)\//g)) {
        if (!fs.existsSync(`src/pages/radar/${m[1]}.md`)) broken.push(`${dir}/${f}: ${m[1]}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});
