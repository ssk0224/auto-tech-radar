// 記事ページの購入導線を確かめる: note 有料版の案内は note 出品済みの記事だけに、導入部の直後へ 1 か所。
// B2B（協賛 ¥100,000〜・導入支援 ¥800,000〜）の案内は記事ページに出さず、/contact/・/sponsor/ はフッターからだけ辿れる。
// テンプレートの文字列ではなく、実際に astro build した配信 HTML で確かめる（表示の崩れや出し漏れを見逃さないため）
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { noteOfferFor, splitAfterIntro, approxCharsLabel, dateModifiedOf } from "../src/utils/article_page.js";

const root = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(p, "utf8");
const noteUrls = JSON.parse(read(path.join(root, "scripts/note_urls.json")));
const slugs = fs.readdirSync(path.join(root, "src/pages/radar")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
const paidSummaryOf = (slug) => {
  const p = path.join(root, "note_drafts", `${slug}_note.paid.json`);
  return fs.existsSync(p) ? JSON.parse(read(p)) : undefined;
};
const unescapeHtml = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e]));
const offerBoxes = (html) => [...html.matchAll(/<aside\b[^>]*\bclass="note-offer\b[^"]*"[^>]*>[\s\S]*?<\/aside>/g)];
const beforeFooter = (html) => html.slice(0, html.search(/<footer[\s>]/));

test("有料版の案内は note の URL がある記事だけに出し、見出しの価格は note_urls.json、項目と分量は paid.json から取る", () => {
  const urls = { a: { url: "https://note.com/x/n/n1", price: 980 }, b: { url: "https://note.com/x/n/n2", price: null } };
  const o = noteOfferFor("a", urls, { chars: 4761, features: ["導入提案書テンプレート（Markdown）", "工数・見積表"] });
  assert.equal(o.heading, "有料版（note ¥980）に含まれるもの");
  assert.equal(o.url, "https://note.com/x/n/n1");
  assert.equal(o.priceLabel, "¥980");
  assert.deepEqual(o.features, ["導入提案書テンプレート（Markdown）", "工数・見積表"]);
  assert.equal(o.charsLabel, "約4,800字");
  // 価格が分からない記事は見出しに価格を書かない（推測の価格を出さない）。内容一覧が無ければ項目も出さない
  const b = noteOfferFor("b", urls, undefined);
  assert.equal(b.heading, "有料版（note）に含まれるもの");
  assert.deepEqual(b.features, []);
  assert.equal(b.charsLabel, "");
  assert.equal(noteOfferFor("c", urls, { chars: 1000, features: ["x"] }), null);
  // 無料にした記事（価格 0）・価格が数値でない記事も、価格を出さない見出しにする
  assert.equal(noteOfferFor("z", { z: { url: "https://note.com/x/n/n3", price: 0 } }, undefined).heading, "有料版（note）に含まれるもの");
  assert.equal(noteOfferFor("z", { z: { url: "https://note.com/x/n/n3" } }, undefined).priceLabel, "");
  assert.equal(approxCharsLabel(30), "約30字");
});

test("案内は導入部の直後（最初の h2 の直前）に入り、h2 の無い記事でも本文の末尾だけにはならない", () => {
  assert.deepEqual(splitAfterIntro('<h1>t</h1><p>導入</p><h2 id="a">A</h2><p>b</p><h2>B</h2>'), ["<h1>t</h1><p>導入</p>", '<h2 id="a">A</h2><p>b</p><h2>B</h2>']);
  assert.deepEqual(splitAfterIntro("<h1>t</h1><p>x</p><p>y</p>"), ["<h1>t</h1><p>x</p>", "<p>y</p>"]);
  assert.deepEqual(splitAfterIntro("<h1>t</h1>"), ["<h1>t</h1>", ""]);
  // コードブロック内の <h2> はエスケープされているので区切りにしない
  assert.deepEqual(splitAfterIntro("<pre><code>&lt;h2&gt;</code></pre><h2>A</h2>"), ["<pre><code>&lt;h2&gt;</code></pre>", "<h2>A</h2>"]);
});

test("構造化データの dateModified は記事の updatedDate、無ければ pubDate（固定の日付を使わない）", () => {
  assert.equal(dateModifiedOf({ pubDate: "2026-10-16", updatedDate: "2026-10-20" }), "2026-10-20");
  assert.equal(dateModifiedOf({ pubDate: "2026-10-16" }), "2026-10-16");
  assert.equal(dateModifiedOf({}), undefined);
  assert.equal(dateModifiedOf(undefined), undefined);
  assert.doesNotMatch(read(path.join(root, "src/layouts/Layout.astro")), /"dateModified":[^\n]*"20\d\d-\d\d-\d\d"/);
});

test("経費精算ガイドは適格請求書（インボイス）の発行をうたわず、領収書の発行場所を note のヘルプどおりに案内する", () => {
  // オーナーは適格請求書発行事業者ではない（note の領収書は 設定 → 購入・チップ履歴 から発行）
  const src = read(path.join(root, "src/pages/expense.astro"));
  assert.doesNotMatch(src, /適格領収書/);
  assert.doesNotMatch(src, /適格(簡易)?請求書[^。]{0,20}発行され/);
  assert.match(src, /購入・チップ履歴/);
  assert.match(src, /適格請求書発行事業者ではない/);
  // 経費精算できるかは所属先しだいなので「自己負担ゼロ」と約束しない。申請文テンプレートに確かめられない主張（国内に先行事例がない・即座に）を入れない
  assert.doesNotMatch(src, /自己負担ゼロ|先行事例がない|即座に/);
});

// ---- 実際のビルド結果での確認（astro build を一時ディレクトリに出力する） ----
let outDir = "";
let build = null;
before(() => {
  outDir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-site-"));
  const astroBin = path.join(root, "node_modules", "astro", JSON.parse(read(path.join(root, "node_modules/astro/package.json"))).bin.astro);
  build = spawnSync(process.execPath, [astroBin, "build", "--outDir", outDir], { cwd: root, encoding: "utf8", timeout: 240000 });
});
after(() => {
  if (outDir) fs.rmSync(outDir, { recursive: true, force: true });
});
const page = (rel) => read(path.join(outDir, rel));
const assertBuilt = () => assert.equal(build?.status, 0, `astro build が失敗: ${(build?.stderr || "") + (build?.stdout || "")}`.slice(0, 4000));

test("ビルド結果が配信物の監査（scripts/audit_dist.mjs）に合格する", () => {
  assertBuilt();
  const r = spawnSync(process.execPath, [path.join(root, "scripts/audit_dist.mjs"), outDir], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout + r.stderr).split("\n").filter((l) => l.includes("❌")).join("\n"));
});

test("有料版の案内は note の URL がある記事にだけ 1 つあり、その記事の paid.json の項目・分量・価格・購入ボタンを出す", () => {
  assertBuilt();
  const linked = slugs.filter((s) => noteUrls[s]?.url);
  assert.ok(linked.length > 0 && linked.length < slugs.length, "note 出品済みの記事と未出品の記事の両方で確かめる");
  for (const slug of slugs) {
    const html = page(`radar/${slug}/index.html`);
    const boxes = offerBoxes(html);
    const item = noteUrls[slug];
    if (!item?.url) {
      assert.equal(boxes.length, 0, `${slug}: note 未出品の記事に有料版の案内がある`);
      assert.ok(!html.includes('id="note-buy-btn"'), `${slug}: note 未出品の記事に購入ボタンがある`);
      continue;
    }
    assert.equal(boxes.length, 1, `${slug}: 有料版の案内がちょうど 1 つではない`);
    const box = boxes[0][0];
    const summary = paidSummaryOf(slug);
    // 見出しは記事ページと同じ noteOfferFor で作る（CI が更新した note_urls.json の価格が null・0 でも、価格を出さない見出しとして確かめる）
    const heading = noteOfferFor(slug, noteUrls, summary).heading;
    assert.ok(box.includes(`>${heading}</p>`), `${slug}: 見出しが違う（${heading}）`);
    if (typeof item.price === "number" && item.price > 0) assert.ok(heading.includes(`¥${item.price.toLocaleString("ja-JP")}`), `${slug}: 見出しに価格が無い`);
    assert.ok(summary, `${slug}: note_drafts/${slug}_note.paid.json が無い`);
    const items = [...box.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => unescapeHtml(m[1]));
    assert.deepEqual(items, summary.features, `${slug}: 項目が paid.json の features と一致しない`);
    assert.ok(box.includes(`有料部分の分量: ${approxCharsLabel(summary.chars)}`), `${slug}: 分量（約N字）が無い`);
    // 主ボタンは note の記事 URL への 1 つだけ。メンバーシップは本文中のテキストリンク
    assert.equal((html.match(/id="note-buy-btn"/g) || []).length, 1, `${slug}: 購入ボタンが 1 つではない`);
    assert.match(box, new RegExp(`<a href="${item.url}"[^>]*class="note-offer-btn"[^>]*id="note-buy-btn"`), `${slug}: 購入ボタンの URL が違う`);
    assert.equal((box.match(/class="note-offer-btn"/g) || []).length, 1, `${slug}: ボタンが複数ある`);
    assert.match(box, /<p class="note-offer-sub"[^>]*>[^<]*<a href="https:\/\/note\.com\/vast_ixora7005\/membership"[^>]*>note メンバーシップ（¥1,980\/月）<\/a>/, `${slug}: メンバーシップのテキストリンクが無い`);
    // 導入部の直後（本文の最初の h2 より前）に置く。記事の末尾には置かない
    const article = html.slice(html.indexOf('<article id="article-body"'), html.indexOf("</article>"));
    const at = article.indexOf(box);
    assert.ok(at > 0, `${slug}: 案内が本文の中に無い`);
    assert.doesNotMatch(article.slice(0, at), /<h2[\s>]/, `${slug}: 案内が最初の h2 より後ろにある`);
    assert.match(article.slice(at + box.length), /^<h2[\s>]/, `${slug}: 案内の直後が最初の h2 ではない`);
    // 収入額・誇張の表現を案内に入れない
    assert.doesNotMatch(box, /稼げ|月収|万円|収入|今だけ|限定|最強|必ず/, `${slug}: 案内に収入額・誇張の表現がある`);
  }
});

test("記事ページに B2B の案内（導入支援 800000・協賛 ¥100,000 のカード）が無く、/contact/・/sponsor/ はフッターからだけ辿れる", () => {
  assertBuilt();
  for (const slug of slugs) {
    const html = page(`radar/${slug}/index.html`);
    assert.ok(!html.includes("800000"), `${slug}: 800000 が残っている`);
    assert.ok(!html.includes("¥100,000"), `${slug}: ¥100,000 の協賛カードが残っている`);
    assert.ok(!html.includes("B2B 協賛"), `${slug}: B2B 協賛のカードが残っている`);
    assert.doesNotMatch(beforeFooter(html), /href="[^"]*\/auto-tech-radar\/(contact|sponsor)\//, `${slug}: フッター以外に /contact/・/sponsor/ への導線がある`);
    const footer = html.slice(html.search(/<footer[\s>]/));
    assert.match(footer, /href="\/auto-tech-radar\/contact\/"/, `${slug}: フッターから /contact/ に行けない`);
    assert.match(footer, /href="\/auto-tech-radar\/sponsor\/"/, `${slug}: フッターから /sponsor/ に行けない`);
    // X（@AutoTechRadar）はオーナーが手動で投稿しているので、記事ページのリンクは残す
    assert.ok(html.includes('href="https://x.com/AutoTechRadar"'), `${slug}: X（@AutoTechRadar）へのリンクが無い`);
  }
  // ページ自体は残す
  assert.ok(fs.existsSync(path.join(outDir, "contact/index.html")));
  assert.ok(fs.existsSync(path.join(outDir, "sponsor/index.html")));
});

test("記事ページの構造化データの dateModified は、その記事の updatedDate（無ければ pubDate）", () => {
  assertBuilt();
  for (const slug of slugs) {
    const md = read(path.join(root, "src/pages/radar", `${slug}.md`));
    const fm = (key) => (md.match(new RegExp(`^${key}:\\s*["']?([^"'\\r\\n]+)["']?\\s*$`, "m")) || [])[1];
    const html = page(`radar/${slug}/index.html`);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1])).find((j) => j["@type"] === "TechArticle");
    assert.ok(ld, `${slug}: TechArticle の構造化データが無い`);
    assert.equal(ld.dateModified, fm("updatedDate") || fm("pubDate"), slug);
  }
});

test("新着の本数の表示は 1 日 1 本（生成は 1 日 1 本）", () => {
  assertBuilt();
  const htmlFiles = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) htmlFiles.push(p);
  });
  walk(outDir);
  for (const f of htmlFiles) assert.doesNotMatch(read(f), /1日(最大)?2本/, path.relative(outDir, f));
  assert.match(page("index.html"), /新着は1日最大1本/);
  assert.match(page(`radar/${slugs[0]}/index.html`), /新着は1日最大1本/);
});

// ---- 配信物の監査（audit_dist）が購入導線・B2B 導線の崩れを本当に止めるか（わざと崩した HTML で確かめる） ----
const FEATURES = ["導入提案書テンプレート（Markdown）", "工数・見積表"];
const NOTE_URL = "https://note.com/x/n/n1";
const offer = (features = FEATURES, url = NOTE_URL) =>
  `<aside class="note-offer atr-paywall-gate"><p class="note-offer-title">有料版（note ¥980）に含まれるもの</p><ul class="note-offer-list">${features.map((f) => `<li>${f}</li>`).join("")}</ul><a href="${url}" target="_blank" rel="noopener" class="note-offer-btn" id="note-buy-btn">note で有料版を見る（¥980）</a></aside>`;
const articlePage = (body, extra = "") =>
  `<html><head><meta property="og:url" content="x"></head><body><main><article id="article-body"><h1>t</h1>${body}</article><p class="ai-disclosure">AI</p>${extra}</main><footer><a href="/auto-tech-radar/contact/">相談</a><a href="/auto-tech-radar/sponsor/">協賛</a><a href="https://x.com/AutoTechRadar">X</a></footer></body></html>`;

function auditFixture(pages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "atr-offer-"));
  try {
    fs.cpSync(path.join(root, "scripts"), path.join(dir, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dir, "scripts/note_urls.json"), JSON.stringify({ linked: { url: NOTE_URL, price: 980 } }));
    fs.mkdirSync(path.join(dir, "note_drafts"));
    fs.writeFileSync(path.join(dir, "note_drafts/linked_note.paid.json"), JSON.stringify({ chars: 4761, features: FEATURES }));
    const put = (rel, html) => {
      fs.mkdirSync(path.dirname(path.join(dir, "dist", rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, "dist", rel), html);
    };
    put("contact/index.html", '<html><head><meta property="og:url" content="x"></head><body>_captcha _replyto</body></html>');
    put("sponsor/index.html", '<html><head><meta property="og:url" content="x"></head><body>sponsor</body></html>');
    for (const [slug, html] of Object.entries(pages)) put(`radar/${slug}/index.html`, html);
    const r = spawnSync(process.execPath, [path.join(dir, "scripts", "audit_dist.mjs")], { cwd: dir, encoding: "utf8" });
    return { status: r.status, out: r.stdout + r.stderr };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const goodLinked = articlePage(`<p>導入</p>${offer()}<h2>構成</h2><p>本文</p>`);
const goodPlain = articlePage("<p>導入</p><h2>構成</h2><p>本文</p>");

test("配信物の監査: 正しい購入導線（note 出品済みの記事だけに導入部直後の案内）は合格する", () => {
  const r = auditFixture({ linked: goodLinked, plain: goodPlain });
  assert.equal(r.status, 0, r.out);
});

const broken = [
  ["note 出品済みの記事に案内が無い", "BUY CARD", { linked: articlePage("<p>導入</p><h2>構成</h2>"), plain: goodPlain }],
  ["note 未出品の記事に案内がある", "BUY CARD", { linked: goodLinked, plain: articlePage(`<p>導入</p>${offer()}<h2>構成</h2>`) }],
  ["案内に paid.json の項目が欠けている", "BUY CARD", { linked: articlePage(`<p>導入</p>${offer(FEATURES.slice(0, 1))}<h2>構成</h2>`), plain: goodPlain }],
  ["購入ボタンが別の記事の URL を指す", "BUY CARD", { linked: articlePage(`<p>導入</p>${offer(FEATURES, "https://note.com/x/n/other")}<h2>構成</h2>`), plain: goodPlain }],
  ["案内が記事の末尾（最初の h2 より後ろ）にある", "BUY CARD", { linked: articlePage(`<p>導入</p><h2>構成</h2><p>本文</p>${offer()}`), plain: goodPlain }],
  ["記事末尾の購入カードが戻る（購入ボタンが 2 つ）", "BUY CARD", { linked: articlePage(`<p>導入</p>${offer()}<h2>構成</h2>`, `<a href="${NOTE_URL}" id="note-buy-btn">購入</a>`), plain: goodPlain }],
  ["導入支援 ¥800,000 の相談バナーが戻る", "B2B OFFER", { linked: goodLinked, plain: articlePage("<p>導入</p><h2>構成</h2>", '<section><a href="/auto-tech-radar/contact/?plan=plain&price=800000">無料相談</a></section>') }],
  ["協賛 ¥100,000 のカードが戻る", "B2B OFFER", { linked: goodLinked, plain: articlePage("<p>導入</p><h2>構成</h2>", '<div class="price-card"><a href="/auto-tech-radar/sponsor/">スポンサー詳細</a></div>') }],
];
for (const [name, expected, pages] of broken) {
  test(`配信物の監査が止める: ${name}`, () => {
    const r = auditFixture(pages);
    assert.notEqual(r.status, 0, r.out);
    assert.ok(r.out.split("\n").some((l) => l.includes("❌") && l.includes(expected)), `期待する ❌ が出ていない: ${expected}\n${r.out}`);
  });
}
