/**
 * feeds.server.ts — Monta o mapa do site (sitemap.xml) e o feed RSS do blog a partir do banco.
 *
 * Quem chama: `src/app/sitemap.ts` e `src/app/blog/rss.xml/route.ts` (depois do `await connection()`)
 * e os testes de integração, que chamam estas funções direto (fora de um pedido HTTP o `connection()`
 * do Next dá erro — por isso a montagem fica aqui, separada da rota).
 * O que devolve: a lista de endereços do sitemap e o texto XML do RSS.
 */
import "server-only";

import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { markdownToPlainText, truncateText } from "@/lib/markdown/parse";
import { listPostsForFeeds } from "@/modules/blog/blog.server";
import { listNoticesForSitemap } from "@/modules/notices/notices.server";
import { listTracksForSitemap } from "@/modules/tracks/tracks.server";

import { buildRss } from "./rss";
import { SITE_NAME } from "./site";
import { absoluteUrl, siteUrl } from "./site.server";

// Páginas públicas fixas (sem banco). Área do aluno, painel e checkout ficam de fora: são privadas.
const FIXED_PATHS = ["/", "/cursos", "/trilhas", "/planos", "/concursos", "/blog", "/o-que-mais-cai"];
const LEGAL_PATHS = ["/termos", "/privacidade"];

/**
 * Lista do sitemap: páginas fixas, cursos publicados, trilhas publicadas (Fase 8), páginas de edital
 * publicadas e posts publicados.
 * Rascunhos nunca entram (as funções de listagem já filtram por "publicado").
 */
export async function buildSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  // Quatro consultas em paralelo (como um `asyncio.gather`).
  const [courses, posts, notices, tracks] = await Promise.all([
    prisma.course.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    listPostsForFeeds(),
    listNoticesForSitemap(),
    listTracksForSitemap(),
  ]);
  const fixed = FIXED_PATHS.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "weekly" as const,
    priority: path === "/" ? 1 : 0.8,
  }));
  return [
    ...fixed,
    ...courses.map((course) => ({ url: absoluteUrl(`/cursos/${course.slug}`), lastModified: course.updatedAt, priority: 0.9 })),
    ...tracks.map((track) => ({ url: absoluteUrl(`/trilhas/${track.slug}`), lastModified: track.updatedAt, priority: 0.8 })),
    ...notices.map((notice) => ({ url: absoluteUrl(`/concursos/${notice.slug}`), lastModified: notice.updatedAt, priority: 0.8 })),
    ...posts.map((post) => ({ url: absoluteUrl(`/blog/${post.slug}`), lastModified: post.updatedAt, priority: 0.6 })),
    ...LEGAL_PATHS.map((path) => ({ url: absoluteUrl(path), priority: 0.1 })),
  ];
}

/**
 * XML do feed RSS com os `limit` posts publicados mais novos. O resumo é o "resumo" do post ou, sem
 * ele, o começo do texto (sem a marcação do Markdown).
 */
export async function buildBlogRssXml(limit = 50): Promise<string> {
  const posts = await listPostsForFeeds(limit);
  return buildRss({
    title: `Blog ${SITE_NAME}`,
    siteUrl: siteUrl(),
    feedUrl: absoluteUrl("/blog/rss.xml"),
    description: "Informática e TI para concursos, em linguagem simples.",
    items: posts.map((post) => ({
      title: post.title,
      url: absoluteUrl(`/blog/${post.slug}`),
      description: post.excerpt || truncateText(markdownToPlainText(post.body), 300),
      publishedAt: post.publishedAt ?? post.updatedAt,
    })),
  });
}
