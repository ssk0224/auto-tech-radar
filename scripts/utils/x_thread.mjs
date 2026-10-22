// X の投稿文（3 ツイート。x_posts/<slug>_x.txt）。生成モデルには書かせず、データだけから決まった形で作る（leakhunt #64、2026-10-22）:
// 名前・掲載時のスター数（data/readme_facts の publication）・README の最初の原文・有料版の内容一覧（*.paid.json）。
// 生成スクリプトが書き、tests/readme_grounding.test.mjs が掲載中の全記事の投稿文を同じ関数で作り直して一致を確かめる
import { sanitizeAndAttachUrlToTweet } from "./twitter_formatter.mjs";
import { X_LINK_LABEL, articleUrl } from "./funnel_copy.mjs";

const MAX_QUOTE = 110;
const clip = (s, n) => ([...s].length > n ? `${[...s].slice(0, n - 1).join("")}…` : s);

export function xThreadText({ facts, slug, quote, features }) {
  const name = String(facts.repo).split("/")[1];
  const stars = Number(facts.publication.stars).toLocaleString("en-US");
  const link = `${X_LINK_LABEL}\n${articleUrl(slug)}`;
  const tweets = [
    `【OSS の README を読む】\nGitHub で★${stars}（${facts.publication.date} 時点）の「${name}」の README の要点を、原文のまま紹介しています。\n${link}`,
    `【README より（原文）】\n${clip(quote, MAX_QUOTE)}`,
    ...(features.length ? [`【note の有料版】\nこの記事の有料版の内容: ${features.join("、")}。\n${link}`] : []),
  ];
  let out = `==================================================\n📱 ${name} X (Twitter) 投稿用スレッド\n==================================================\n\n`;
  tweets.forEach((raw, idx) => {
    let tweet = raw;
    let intentUrl;
    if (idx === 0) {
      const safe = sanitizeAndAttachUrlToTweet(tweet, slug);
      tweet = safe.tweet;
      intentUrl = safe.intentUrl;
    } else {
      intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`;
    }
    out += `--------------------------------------------------\n【ツイート ${idx + 1}】\n${tweet}\n\n👉 ワンクリックで投稿画面を開く:\n${intentUrl}\n--------------------------------------------------\n\n`;
  });
  return out;
}
