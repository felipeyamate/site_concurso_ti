/**
 * rss.test.ts — Feed RSS: formato e escape dos textos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { buildRss, escapeXml } from "./rss";

describe("RSS", () => {
  it("escapa os caracteres especiais do XML", () => {
    expect(escapeXml(`Vírus & worms: "<b>" 'x'`)).toBe("Vírus &amp; worms: &quot;&lt;b&gt;&quot; &apos;x&apos;");
  });

  it("um item por post, com data no formato do RSS", () => {
    const xml = buildRss({
      title: "Blog",
      siteUrl: "https://x",
      feedUrl: "https://x/blog/rss.xml",
      description: "d",
      items: [{ title: "A & B", url: "https://x/blog/a", description: "texto", publishedAt: new Date("2026-10-01T12:00:00Z") }],
    });
    expect(xml).toContain("<title>A &amp; B</title>");
    expect(xml).toContain("<pubDate>Thu, 01 Oct 2026 12:00:00 GMT</pubDate>");
    expect(xml.match(/<item>/g)).toHaveLength(1);
  });
});
