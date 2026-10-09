import rss from '@astrojs/rss';

export async function GET(context) {
  const postImportResult = import.meta.glob('../radar/*.md', { eager: true });
  const posts = Object.values(postImportResult);

  return rss({
    title: 'Auto Tech Radar | 海外急上昇OSS日本語インデックス',
    description: '世界のGitHubトレンドから急上昇OSSを毎朝AIが自動検出し、日本語技術アーキテクチャ解説と受託・SaaSマネタイズ実践法をお届けします。',
    site: context.site || 'https://ssk0224.github.io/auto-tech-radar/',
    items: posts.map((post) => ({
      title: post.frontmatter?.title || 'Tech Radar Entry',
      pubDate: post.frontmatter?.pubDate ? new Date(post.frontmatter.pubDate) : new Date(),
      description: post.frontmatter?.description || '',
      link: post.url,
    })),
    customData: `<language>ja</language>`,
  });
}
