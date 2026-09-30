/**
 * notices-admin.server.ts — Páginas de edital no painel (PROFESSOR ou mais): listar, criar/editar, apagar.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /admin/conteudo/concursos. Os testes chamam direto.
 *
 * Regras:
 *  - Slug único; vazio = gerado do título. Mudou o slug → o endereço antigo redireciona.
 *  - A data de publicação é a da PRIMEIRA publicação.
 *  - Banca, assuntos, produto, plano e cupom escolhidos precisam existir. Um cupom que ainda não
 *    vale (ex.: começa amanhã) pode ser escolhido: a página só mostra o desconto quando ele valer.
 *  - O CUPOM da página só o ADMIN escolhe (`canChooseCoupon`): cupons são dados de venda, que o
 *    professor não vê. Quando o professor salva, o cupom que já estava na página é mantido — e o
 *    código digitado nem é conferido (senão dava para "adivinhar" cupons pela mensagem de erro).
 */
import "server-only";

import { isUniqueViolation } from "@/lib/db-errors";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { findAvailableSlug } from "@/modules/catalog/admin/slug";
import { dateOnlyToUtc } from "@/modules/payments/dates";
import { recordSlugChange } from "@/modules/seo/redirects.server";

import type { NoticeFormData } from "./schemas";

export async function listNoticesForAdmin() {
  return prisma.examNotice.findMany({
    orderBy: [{ isPublished: "asc" }, { updatedAt: "desc" }],
    select: { id: true, slug: true, title: true, status: true, isPublished: true, examDate: true, board: { select: { name: true } } },
  });
}

export async function getNoticeForAdmin(noticeId: string) {
  return prisma.examNotice.findUnique({ where: { id: noticeId }, include: { subjects: { select: { subjectId: true } } } });
}

/** O que o formulário oferece: bancas, assuntos, produtos e planos. */
export async function listNoticeFormOptions() {
  const [boards, subjects, products, plans] = await Promise.all([
    prisma.board.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.product.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
    prisma.plan.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true, isActive: true } }),
  ]);
  return { boards, subjects, products, plans };
}

/**
 * Cria ou edita uma página de edital (numa transação): confere o que foi escolhido; gera o slug
 * se vier vazio; grava; troca os assuntos; na edição, registra o endereço antigo se o slug mudou.
 * `canChooseCoupon`: só o ADMIN (ver o cabeçalho); sem ele, o cupom atual da página é mantido.
 */
export async function saveNotice(
  data: NoticeFormData,
  options: { canChooseCoupon: boolean; now?: Date },
): Promise<{ id: string; slug: string }> {
  const now = options.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const current = data.noticeId
        ? await tx.examNotice.findUnique({ where: { id: data.noticeId }, select: { slug: true, publishedAt: true, couponCode: true } })
        : null;
      if (data.noticeId && !current) throw new UserFacingError("Página não encontrada.");
      const couponCode = options.canChooseCoupon ? data.couponCode : (current?.couponCode ?? null);

      const [board, product, plan, coupon, subjects] = await Promise.all([
        data.boardId ? tx.board.count({ where: { id: data.boardId } }) : 1,
        data.productId ? tx.product.count({ where: { id: data.productId } }) : 1,
        data.planId ? tx.plan.count({ where: { id: data.planId } }) : 1,
        options.canChooseCoupon && couponCode ? tx.coupon.count({ where: { code: couponCode } }) : 1,
        tx.subject.count({ where: { id: { in: data.subjectIds } } }),
      ]);
      if (board === 0) throw new UserFacingError("Banca não encontrada.", { field: "boardId" });
      if (product === 0) throw new UserFacingError("Produto não encontrado.", { field: "productId" });
      if (plan === 0) throw new UserFacingError("Plano não encontrado.", { field: "planId" });
      if (coupon === 0) throw new UserFacingError("Não existe cupom com este código (crie em Vendas → Cupons).", { field: "couponCode" });
      if (subjects !== data.subjectIds.length) throw new UserFacingError("Algum assunto escolhido não existe mais. Recarregue a página.");

      const fields = {
        title: data.title,
        organization: data.organization,
        role: data.role,
        boardId: data.boardId,
        status: data.status,
        registrationEndsOn: data.registrationEndsOn ? dateOnlyToUtc(data.registrationEndsOn) : null,
        examDate: data.examDate ? dateOnlyToUtc(data.examDate) : null,
        vacancies: data.vacancies,
        salary: data.salary,
        summary: data.summary,
        body: data.body,
        officialUrl: data.officialUrl,
        productId: data.productId,
        planId: data.planId,
        couponCode,
        isPublished: data.isPublished,
      };

      let notice: { id: string; slug: string };
      if (data.noticeId && current) {
        const slug = data.slug ?? current.slug;
        notice = await tx.examNotice.update({
          where: { id: data.noticeId },
          data: { ...fields, slug, publishedAt: current.publishedAt ?? (data.isPublished ? now : null) },
          select: { id: true, slug: true },
        });
        await recordSlugChange(tx, { kind: "EXAM_NOTICE", oldSlug: current.slug, newSlug: slug, targetId: notice.id });
        await tx.examNoticeSubject.deleteMany({ where: { noticeId: notice.id } });
      } else {
        const slug =
          data.slug ??
          (await findAvailableSlug(data.title, async (candidate) => Boolean(await tx.examNotice.findUnique({ where: { slug: candidate }, select: { id: true } }))));
        notice = await tx.examNotice.create({ data: { ...fields, slug, publishedAt: data.isPublished ? now : null }, select: { id: true, slug: true } });
      }
      const noticeId = notice.id;
      await tx.examNoticeSubject.createMany({ data: data.subjectIds.map((subjectId) => ({ noticeId, subjectId })) });
      return notice;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe uma página com este endereço.", { field: "slug" });
    throw error;
  }
}

export async function setNoticePublished(noticeId: string, isPublished: boolean, now: Date = new Date()): Promise<void> {
  const notice = await prisma.examNotice.findUnique({ where: { id: noticeId }, select: { publishedAt: true } });
  if (!notice) throw new UserFacingError("Página não encontrada.");
  await prisma.examNotice.update({ where: { id: noticeId }, data: { isPublished, publishedAt: notice.publishedAt ?? (isPublished ? now : null) } });
}

/** Apaga a página (e os endereços antigos que levavam a ela). */
export async function deleteNotice(noticeId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.examNotice.deleteMany({ where: { id: noticeId } });
    if (count === 0) throw new UserFacingError("Página não encontrada.");
    await tx.slugRedirect.deleteMany({ where: { kind: "EXAM_NOTICE", targetId: noticeId } });
  });
}
