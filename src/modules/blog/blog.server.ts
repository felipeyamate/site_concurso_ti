/**
 * blog.server.ts — O blog para o público: lista de posts, um post, relacionados, RSS e sitemap.
 *
 * Quem chama: /blog, /blog/[slug], /blog/rss.xml, o sitemap e a página inicial.
 * Só posts PUBLICADOS — exceto `getPostForViewer` com `canSeeDrafts` (professor/admin vendo a
 * prévia de um rascunho, com aviso na página).
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { markdownToPlainText, truncateText } from "@/lib/markdown/parse";

export const BLOG_PAGE_SIZE = 10;

const postCardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  publishedAt: true,
  author: { select: { name: true } },
  subject: { select: { name: true, slug: true } },
} as const satisfies Prisma.BlogPostSelect;

type PostCardRow = Prisma.BlogPostGetPayload<{ select: typeof postCardSelect }>;

/** Resumo do post: o escrito pelo autor, ou o começo do texto. */
export function postSummary(post: { excerpt: string; body: string }): string {
  return post.excerpt || truncateText(markdownToPlainText(post.body), 200);
}

// Para as listas: sem o texto inteiro (só o resumo pronto).
function toCard(post: PostCardRow) {
  const { body, ...rest } = post;
  return { ...rest, summary: postSummary({ excerpt: post.excerpt, body }) };
}
export type PostCard = ReturnType<typeof toCard>;

const published = { isPublished: true } satisfies Prisma.BlogPostWhereInput;
const newestFirst = [{ publishedAt: "desc" }, { id: "asc" }] satisfies Prisma.BlogPostOrderByWithRelationInput[];

/** Página `page` da lista (mais novos primeiro). */
export async function listPublishedPosts(page: number) {
  const total = await prisma.blogPost.count({ where: published });
  const pageCount = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const posts = await prisma.blogPost.findMany({
    where: published,
    orderBy: newestFirst,
    skip: (current - 1) * BLOG_PAGE_SIZE,
    take: BLOG_PAGE_SIZE,
    select: postCardSelect,
  });
  return { posts: posts.map(toCard), total, page: current, pageCount };
}

/** Os últimos posts (página inicial). */
export async function listLatestPosts(limit: number) {
  const posts = await prisma.blogPost.findMany({ where: published, orderBy: newestFirst, take: limit, select: postCardSelect });
  return posts.map(toCard);
}

/** Um post pelo slug. Rascunho só com `canSeeDrafts` (prévia do professor). */
export async function getPostForViewer(slug: string, canSeeDrafts: boolean) {
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: { ...postCardSelect, isPublished: true, updatedAt: true, subjectId: true },
  });
  if (!post || (!post.isPublished && !canSeeDrafts)) return null;
  return post;
}

/** Até `limit` posts relacionados: primeiro do mesmo assunto, depois os mais novos. */
export async function listRelatedPosts(post: { id: string; subjectId: string | null }, limit = 3) {
  const sameSubject = post.subjectId
    ? await prisma.blogPost.findMany({
        where: { ...published, subjectId: post.subjectId, id: { not: post.id } },
        orderBy: newestFirst,
        take: limit,
        select: postCardSelect,
      })
    : [];
  const others =
    sameSubject.length < limit
      ? await prisma.blogPost.findMany({
          where: { ...published, id: { notIn: [post.id, ...sameSubject.map((item) => item.id)] } },
          orderBy: newestFirst,
          take: limit - sameSubject.length,
          select: postCardSelect,
        })
      : [];
  return [...sameSubject, ...others].map(toCard);
}

/** Para o RSS e o sitemap: os publicados, mais novos primeiro. */
export async function listPostsForFeeds(limit = 1000) {
  return prisma.blogPost.findMany({
    where: published,
    orderBy: newestFirst,
    take: limit,
    select: { slug: true, title: true, excerpt: true, body: true, publishedAt: true, updatedAt: true },
  });
}
