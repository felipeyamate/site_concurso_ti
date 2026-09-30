/**
 * redirects.server.ts — Endereços antigos: quando o slug de um curso, aula, post ou edital muda, o
 * endereço antigo continua funcionando e leva (redirecionamento permanente, 308) ao novo.
 *
 * Quem chama:
 *  - quem MUDA o slug (painel: cursos, aulas, blog, editais) → `recordSlugChange`, na mesma
 *    transação da mudança;
 *  - as páginas públicas, quando não acham o slug → `findRedirectTarget` antes do "não encontrado".
 *
 * Por que importa: links compartilhados (WhatsApp, afiliados) e o Google continuam válidos, e o
 * Google transfere a "reputação" da página antiga para a nova.
 * Guardamos o ID do item (não o slug novo): se o slug mudar de novo, o endereço mais antigo leva
 * direto ao atual, sem cadeia de redirecionamentos.
 */
import "server-only";

import { notFound, permanentRedirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import type { SlugRedirectKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

/**
 * Registra "o slug antigo agora leva a este item". Passos:
 *  1. Slug igual → nada a fazer.
 *  2. O slug NOVO deixa de ser "antigo" de qualquer item (agora ele é um endereço vivo).
 *  3. Grava (ou aponta de novo) o slug antigo para este item.
 */
export async function recordSlugChange(
  tx: Prisma.TransactionClient,
  input: { kind: SlugRedirectKind; scope?: string; oldSlug: string; newSlug: string; targetId: string },
): Promise<void> {
  if (input.oldSlug === input.newSlug) return;
  const scope = input.scope ?? "";
  await tx.slugRedirect.deleteMany({ where: { kind: input.kind, scope, oldSlug: input.newSlug } });
  await tx.slugRedirect.upsert({
    where: { kind_scope_oldSlug: { kind: input.kind, scope, oldSlug: input.oldSlug } },
    create: { kind: input.kind, scope, oldSlug: input.oldSlug, targetId: input.targetId },
    update: { targetId: input.targetId },
  });
}

/** O ID do item para onde um slug antigo leva (ou null). */
export async function findRedirectTarget(kind: SlugRedirectKind, slug: string, scope = ""): Promise<string | null> {
  const redirect = await prisma.slugRedirect.findUnique({
    where: { kind_scope_oldSlug: { kind, scope, oldSlug: slug } },
    select: { targetId: true },
  });
  return redirect?.targetId ?? null;
}

/**
 * Endereço ATUAL de um curso/aula a partir de slugs que podem ser antigos (páginas do catálogo).
 * Aula: o curso pode ter mudado de slug, a aula também, ou os dois. Devolve null se não achar.
 */
export async function currentCatalogPath(courseSlug: string, lessonSlug?: string): Promise<string | null> {
  const course =
    (await prisma.course.findUnique({ where: { slug: courseSlug }, select: { id: true, slug: true } })) ??
    (await (async () => {
      const id = await findRedirectTarget("COURSE", courseSlug);
      return id ? prisma.course.findUnique({ where: { id }, select: { id: true, slug: true } }) : null;
    })());
  if (!course) return null;
  if (lessonSlug === undefined) return `/cursos/${course.slug}`;

  const lesson =
    (await prisma.lesson.findUnique({ where: { courseId_slug: { courseId: course.id, slug: lessonSlug } }, select: { slug: true } })) ??
    (await (async () => {
      const id = await findRedirectTarget("LESSON", lessonSlug, course.id);
      return id ? prisma.lesson.findFirst({ where: { id, courseId: course.id }, select: { slug: true } }) : null;
    })());
  return lesson ? `/cursos/${course.slug}/aulas/${lesson.slug}` : null;
}

/**
 * Para as páginas do catálogo quando não acham o curso/aula: se o endereço é ANTIGO, redireciona
 * (308, permanente) para o atual; senão, "página não encontrada". Nunca volta (lança sempre).
 * Compara com o endereço pedido para não redirecionar para a mesma página (ex.: curso em rascunho).
 */
export async function redirectOldCatalogPathOrNotFound(courseSlug: string, lessonSlug?: string): Promise<never> {
  const requested = lessonSlug === undefined ? `/cursos/${courseSlug}` : `/cursos/${courseSlug}/aulas/${lessonSlug}`;
  const current = await currentCatalogPath(courseSlug, lessonSlug);
  if (current && current !== requested) permanentRedirect(current);
  notFound();
}
