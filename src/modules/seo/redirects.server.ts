/**
 * redirects.server.ts — Endereços antigos: quando o slug de um curso, aula, post, edital ou trilha muda, o
 * endereço antigo continua funcionando e leva (redirecionamento permanente, 308) ao novo.
 *
 * Quem chama:
 *  - quem MUDA o slug (painel: cursos, aulas, blog, editais) → `recordSlugChange`, na mesma
 *    transação da mudança;
 *  - as páginas públicas, quando não acham o slug → `findRedirectTarget` antes do "não encontrado".
 *
 * Por que importa: links compartilhados (WhatsApp, afiliados) e o Google continuam válidos, e o
 * Google transfere a "reputação" da página antiga para a nova.
 * Rascunho: o endereço antigo de um item NÃO publicado só redireciona para quem vê rascunhos
 * (professor/admin); para o público é "não encontrado" — senão o 308 revelaria o endereço novo do
 * rascunho (regra "rascunhos não vazam").
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
 * Aula: o curso pode ter mudado de slug, a aula também, ou os dois. Devolve null se não achar — ou
 * se o curso/aula for rascunho e quem pede não vê rascunhos (`canSeeDrafts`).
 */
export async function currentCatalogPath(courseSlug: string, lessonSlug?: string, canSeeDrafts = false): Promise<string | null> {
  const courseSelect = { id: true, slug: true, isPublished: true } as const;
  const course =
    (await prisma.course.findUnique({ where: { slug: courseSlug }, select: courseSelect })) ??
    (await (async () => {
      const id = await findRedirectTarget("COURSE", courseSlug);
      return id ? prisma.course.findUnique({ where: { id }, select: courseSelect }) : null;
    })());
  if (!course || (!course.isPublished && !canSeeDrafts)) return null;
  if (lessonSlug === undefined) return `/cursos/${course.slug}`;

  const lessonSelect = { slug: true, isPublished: true } as const;
  const lesson =
    (await prisma.lesson.findUnique({ where: { courseId_slug: { courseId: course.id, slug: lessonSlug } }, select: lessonSelect })) ??
    (await (async () => {
      const id = await findRedirectTarget("LESSON", lessonSlug, course.id);
      return id ? prisma.lesson.findFirst({ where: { id, courseId: course.id }, select: lessonSelect }) : null;
    })());
  if (!lesson || (!lesson.isPublished && !canSeeDrafts)) return null;
  return `/cursos/${course.slug}/aulas/${lesson.slug}`;
}

/**
 * Para as páginas do catálogo quando não acham o curso/aula: se o endereço é ANTIGO, redireciona
 * (308, permanente) para o atual; senão, "página não encontrada". Nunca volta (lança sempre).
 * Compara com o endereço pedido para não redirecionar para a mesma página (ex.: curso em rascunho).
 */
export async function redirectOldCatalogPathOrNotFound(
  courseSlug: string,
  lessonSlug: string | undefined,
  options: { canSeeDrafts: boolean },
): Promise<never> {
  const requested = lessonSlug === undefined ? `/cursos/${courseSlug}` : `/cursos/${courseSlug}/aulas/${lessonSlug}`;
  const current = await currentCatalogPath(courseSlug, lessonSlug, options.canSeeDrafts);
  if (current && current !== requested) permanentRedirect(current);
  notFound();
}

// Onde fica a página pública de cada tipo (Fase 8: trilhas).
const BASE_PATHS = { BLOG_POST: "/blog", EXAM_NOTICE: "/concursos", TRACK: "/trilhas" } as const;

/** O slug atual e se está publicado, do item de destino (post, página de concurso ou trilha). */
async function findSlugTarget(kind: keyof typeof BASE_PATHS, id: string) {
  const select = { slug: true, isPublished: true } as const;
  if (kind === "BLOG_POST") return prisma.blogPost.findUnique({ where: { id }, select });
  if (kind === "EXAM_NOTICE") return prisma.examNotice.findUnique({ where: { id }, select });
  return prisma.track.findUnique({ where: { id }, select });
}

/**
 * O mesmo para posts do blog, páginas de concurso e trilhas: slug antigo → redireciona para o atual
 * (se o item estiver publicado, ou se quem pede vê rascunhos); senão, "não encontrado". Nunca volta.
 */
export async function redirectOldSlugOrNotFound(
  kind: keyof typeof BASE_PATHS,
  slug: string,
  options: { canSeeDrafts: boolean },
): Promise<never> {
  const targetId = await findRedirectTarget(kind, slug);
  const target = targetId ? await findSlugTarget(kind, targetId) : null;
  const basePath = BASE_PATHS[kind];
  if (target && target.slug !== slug && (target.isPublished || options.canSeeDrafts)) permanentRedirect(`${basePath}/${target.slug}`);
  notFound();
}
