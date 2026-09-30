/**
 * rss.ts — Monta o feed RSS do blog (XML que leitores de notícias e o Google Discover leem).
 *
 * Quem chama: a rota /blog/rss.xml. Arquivo "puro", testado em `rss.test.ts`.
 * Todo texto passa por `escapeXml`: um título com "<" ou "&" não pode quebrar o XML.
 */

/** Troca os 5 caracteres especiais do XML pelas "entidades" (como o `html.escape` do Python). */
export function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export type RssItem = { title: string; url: string; description: string; publishedAt: Date };

export function buildRss(input: { title: string; siteUrl: string; feedUrl: string; description: string; items: RssItem[] }): string {
  const items = input.items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${item.publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(input.title)}</title>
    <link>${escapeXml(input.siteUrl)}</link>
    <description>${escapeXml(input.description)}</description>
    <language>pt-BR</language>
    <atom:link href="${escapeXml(input.feedUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
