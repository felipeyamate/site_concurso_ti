/**
 * site.ts — Nome e textos fixos do site (usados no SEO, nos dados estruturados e no RSS).
 *
 * Quem chama: páginas públicas, `sitemap.ts`, `robots.ts`, o RSS do blog.
 * Arquivo "puro" (sem segredos): pode ser usado em qualquer lugar. O ENDEREÇO do site fica em
 * `site.server.ts` (vem das variáveis de ambiente).
 */

export const SITE_NAME = "Concurso TI";
export const SITE_DESCRIPTION =
  "Aprenda Informática, TI e Segurança da Informação para concursos públicos, em linguagem simples, focando no que mais cai nas provas.";
