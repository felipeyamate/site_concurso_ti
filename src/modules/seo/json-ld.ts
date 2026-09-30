/**
 * json-ld.ts — "Dados estruturados" para o Google (JSON-LD, padrão schema.org).
 *
 * Quem chama: as páginas públicas (início, curso, post do blog, edital), pelo componente `JsonLd`.
 * O que devolve: objetos no formato do schema.org e o texto seguro para pôr na página.
 * Arquivo "puro", testado em `json-ld.test.ts`.
 *
 * Por que: com esses dados, o Google entende que a página é um curso, um artigo etc., e pode
 * mostrar resultados mais ricos (trilha de navegação, autor, data do artigo...).
 */

export type JsonLdObject = Record<string, unknown>;

/**
 * Texto do JSON para pôr dentro de <script type="application/ld+json">.
 * Por que escapar "<": um título com "</script>" fecharia a tag e o resto viraria HTML da página.
 * "<" é o mesmo caractere para o JSON, mas não fecha a tag. (Idem ">" "&" e as quebras de
 * linha U+2028/U+2029, que quebram o JavaScript em navegadores antigos.)
 */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/** A escola (aparece na página inicial). */
export function organizationJsonLd(input: { siteUrl: string; name: string; description: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: input.name,
    url: input.siteUrl,
    description: input.description,
  };
}

/** O site (aparece na página inicial). */
export function websiteJsonLd(input: { siteUrl: string; name: string }): JsonLdObject {
  return { "@context": "https://schema.org", "@type": "WebSite", name: input.name, url: input.siteUrl, inLanguage: "pt-BR" };
}

/** Trilha de navegação ("Início › Blog › Post"). */
export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

/** Um curso. */
export function courseJsonLd(input: { name: string; description: string; url: string; providerName: string; providerUrl: string }): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: "pt-BR",
    provider: { "@type": "Organization", name: input.providerName, sameAs: input.providerUrl },
  };
}

/** Um post do blog. Datas em ISO (ex.: "2026-10-01T12:00:00.000Z"). */
export function articleJsonLd(input: {
  headline: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified: string;
  authorName: string | null;
  publisherName: string;
  publisherUrl: string;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    inLanguage: "pt-BR",
    author: input.authorName ? { "@type": "Person", name: input.authorName } : { "@type": "Organization", name: input.publisherName },
    publisher: { "@type": "Organization", name: input.publisherName, url: input.publisherUrl },
  };
}
