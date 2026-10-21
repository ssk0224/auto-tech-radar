// 記事ページ（src/layouts/Layout.astro）の表示内容を決める小さな関数群。
// import.meta.glob を使わないので、テスト（node:test）からもそのまま読み込める。
//
// note 有料版の案内は、記事の導入部の直後に 1 か所だけ出す。
// 対象は scripts/note_urls.json に note の URL がある記事だけ。
// 含まれる項目と分量は、暗号化時に有料部分の見出しから作る公開メタデータ（note_drafts/<slug>_note.paid.json）から取る（本文は含まない）

// 有料部分の文字数は 100 字単位に丸めて「約N字」と出す（暗号化のたびに数字が細かく揺れないように）
export function approxCharsLabel(chars) {
  const n = Number(chars) || 0;
  if (n <= 0) return "";
  const rounded = Math.round(n / 100) * 100 || n;
  return `約${rounded.toLocaleString("ja-JP")}字`;
}

// 案内に出す内容。note の URL が無い記事は null（案内を出さない）
export function noteOfferFor(slug, noteUrls, paidSummary) {
  const item = noteUrls?.[slug];
  if (!item?.url) return null;
  const priceLabel = item.price ? `¥${Number(item.price).toLocaleString("ja-JP")}` : "";
  return {
    url: item.url,
    priceLabel,
    heading: `有料版（note${priceLabel ? ` ${priceLabel}` : ""}）に含まれるもの`,
    features: Array.isArray(paidSummary?.features) ? paidSummary.features.map(String) : [],
    charsLabel: approxCharsLabel(paidSummary?.chars),
  };
}

// 記事本文の HTML を「導入部」と「それ以降」に分ける。案内は最初の h2 の直前（導入部の直後）に置く。
// h2 が無い記事は最初の段落の後ろ、段落も無ければ本文の後ろに置く（記事の末尾だけに置かれる事態を避ける）
export function splitAfterIntro(html) {
  const s = String(html || "");
  const h2 = s.search(/<h2[\s>]/i);
  if (h2 !== -1) return [s.slice(0, h2), s.slice(h2)];
  const p = s.search(/<\/p>/i);
  if (p !== -1) return [s.slice(0, p + 4), s.slice(p + 4)];
  return [s, ""];
}

// JSON-LD の dateModified（更新日が無い記事は公開日）。どちらも無ければ出さない
export function dateModifiedOf(frontmatter) {
  return frontmatter?.updatedDate || frontmatter?.pubDate || undefined;
}
