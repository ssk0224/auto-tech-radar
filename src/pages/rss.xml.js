import rss from '@astrojs/rss';
import { getArticles, hrefOf, slugOf, pubTime } from '../utils/articles.js';
import { SITE_DESCRIPTION } from '../utils/site_copy.js';

export async function GET(context) {
  // ノイズ除外・新しい順は getArticles 側。pubDate が無い記事は日付を偽らず除外する
  const posts = getArticles().filter((post) => pubTime(post) !== null);

  return rss({
    title: 'Auto Tech Radar | 海外急上昇OSS日本語インデックス',
    description: SITE_DESCRIPTION,
    site: 'https://ssk0224.github.io/auto-tech-radar/',
    items: posts.map((post) => {
      const slug = slugOf(post);
      return {
        title: post.frontmatter?.title || slug,
        pubDate: new Date(pubTime(post)),
        description: post.frontmatter?.description || '',
        link: hrefOf(post),
        // enclosure は実ファイルサイズを取得できないため付けない（length の偽装を避ける）
      };
    }),
    customData: `<language>ja</language>`,
  });
}
