/**
 * json-ld.test.ts — Dados estruturados: formato e segurança do texto dentro do <script>.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { articleJsonLd, breadcrumbJsonLd, serializeJsonLd } from "./json-ld";

describe("serializeJsonLd", () => {
  it("SEGURANÇA: '</script>' num título não fecha a tag, e o JSON continua igual", () => {
    const data = { headline: "Veja </script><script>alert(1)</script> & mais" };
    const text = serializeJsonLd(data);
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(JSON.parse(text)).toEqual(data);
  });
});

describe("formatos", () => {
  it("trilha de navegação numerada a partir de 1", () => {
    expect(breadcrumbJsonLd([{ name: "Início", url: "https://x/" }, { name: "Blog", url: "https://x/blog" }])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, name: "Início", item: "https://x/" },
        { position: 2, name: "Blog", item: "https://x/blog" },
      ],
    });
  });

  it("artigo sem autor usa a escola como autora", () => {
    const article = articleJsonLd({
      headline: "Phishing",
      description: "d",
      url: "https://x/blog/phishing",
      datePublished: "2026-10-01T00:00:00.000Z",
      dateModified: "2026-10-02T00:00:00.000Z",
      authorName: null,
      publisherName: "Concurso TI",
      publisherUrl: "https://x",
    });
    expect(article).toMatchObject({ "@type": "BlogPosting", author: { "@type": "Organization", name: "Concurso TI" } });
  });
});
