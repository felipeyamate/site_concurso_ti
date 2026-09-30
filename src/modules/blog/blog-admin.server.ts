/**
 * blog-admin.server.ts — O blog no painel (PROFESSOR ou mais): listar, criar/editar e apagar posts.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /admin/conteudo/blog. Os testes chamam direto.
 *
 * Regras:
 *  - Slug único; vazio = gerado do título. Mudou o slug de um post → o endereço antigo redireciona
 *    para o novo (`recordSlugChange`).
 *  - A data de publicação é a da PRIMEIRA vez que o post foi publicado (despublicar e publicar de
 *    novo não muda a data — ela aparece no post e ordena o blog).
 */
import "server-only";

import { isUniqueViolation } from "@/lib/db-errors";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { findAvailableSlug } from "@/modules/catalog/admin/slug";
import { recordSlugChange } from "@/modules/seo/redirects.server";

import type { BlogPostFormData } from "./schemas";

export async function listPostsForAdmin() {
  return prisma.blogPost.findMany({
    orderBy: [{ isPublished: "asc" }, { updatedAt: "desc" }],
    select: { id: true, slug: true, title: true, isPublished: true, publishedAt: true, updatedAt: true, author: { select: { name: true } } },
  });
}

export async function getPostForAdmin(postId: string) {
  return prisma.blogPost.findUnique({ where: { id: postId } });
}

/** Assuntos (Fase 5) para o campo "assunto do post". */
export async function listSubjectOptions() {
  return prisma.subject.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}

/**
 * Cria ou edita um post.
 * Passos (numa transação): confere o assunto; gera o slug se vier vazio; grava; na edição,
 * registra o endereço antigo se o slug mudou; define a data de publicação na 1ª publicação.
 */
export async function savePost(data: BlogPostFormData, authorId: string, now: Date = new Date()): Promise<{ id: string; slug: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      if (data.subjectId && !(await tx.subject.findUnique({ where: { id: data.subjectId }, select: { id: true } }))) {
        throw new UserFacingError("Assunto não encontrado.", { field: "subjectId" });
      }
      const fields = { title: data.title, excerpt: data.excerpt, body: data.body, subjectId: data.subjectId, isPublished: data.isPublished };

      if (data.postId) {
        const current = await tx.blogPost.findUnique({ where: { id: data.postId }, select: { slug: true, publishedAt: true } });
        if (!current) throw new UserFacingError("Post não encontrado.");
        const slug = data.slug ?? current.slug;
        const post = await tx.blogPost.update({
          where: { id: data.postId },
          data: { ...fields, slug, publishedAt: current.publishedAt ?? (data.isPublished ? now : null) },
          select: { id: true, slug: true },
        });
        await recordSlugChange(tx, { kind: "BLOG_POST", oldSlug: current.slug, newSlug: slug, targetId: post.id });
        return post;
      }

      const slug =
        data.slug ??
        (await findAvailableSlug(data.title, async (candidate) => Boolean(await tx.blogPost.findUnique({ where: { slug: candidate }, select: { id: true } }))));
      return tx.blogPost.create({
        data: { ...fields, slug, authorId, publishedAt: data.isPublished ? now : null },
        select: { id: true, slug: true },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe um post com este endereço.", { field: "slug" });
    throw error;
  }
}

export async function setPostPublished(postId: string, isPublished: boolean, now: Date = new Date()): Promise<void> {
  const post = await prisma.blogPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
  if (!post) throw new UserFacingError("Post não encontrado.");
  await prisma.blogPost.update({ where: { id: postId }, data: { isPublished, publishedAt: post.publishedAt ?? (isPublished ? now : null) } });
}

/** Apaga o post (e os endereços antigos que levavam a ele). Post não guarda histórico de aluno. */
export async function deletePost(postId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.blogPost.deleteMany({ where: { id: postId } });
    if (count === 0) throw new UserFacingError("Post não encontrado.");
    await tx.slugRedirect.deleteMany({ where: { kind: "BLOG_POST", targetId: postId } });
  });
}
