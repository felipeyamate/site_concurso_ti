/**
 * page.tsx — Editar uma página de edital: /admin/conteudo/concursos/[id]  (PROFESSOR ou mais)
 *
 * Quem chama: a lista de páginas (Editar).
 * Mostra o formulário, publicar/despublicar, "ver no site" (o professor vê rascunhos) e apagar.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { requireRole } from "@/modules/auth/session";
import { deleteNoticeAction, setNoticePublishedAction } from "@/modules/notices/actions";
import { NoticeForm } from "@/modules/notices/components/notice-form";
import { getNoticeForAdmin, listNoticeFormOptions } from "@/modules/notices/notices-admin.server";
import { utcToDateOnly } from "@/modules/payments/dates";

export const metadata: Metadata = {
  title: "Página de concurso · Painel admin",
  robots: { index: false },
};

export default async function EditNoticePage({ params }: PageProps<"/admin/conteudo/concursos/[noticeId]">) {
  const { noticeId } = await params;
  await requireRole("TEACHER", `/admin/conteudo/concursos/${noticeId}`);
  const [notice, options] = await Promise.all([getNoticeForAdmin(noticeId), listNoticeFormOptions()]);
  if (!notice) notFound();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/concursos" className="text-muted-foreground text-sm hover:underline">
          ← Concursos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar página de concurso</h1>
        <p className="text-sm">
          <Link href={`/concursos/${notice.slug}`} className="underline" target="_blank">
            Ver no site{notice.isPublished ? "" : " (prévia do rascunho)"}
          </Link>
        </p>
      </div>
      <NoticeForm
        notice={{
          id: notice.id,
          title: notice.title,
          slug: notice.slug,
          organization: notice.organization,
          role: notice.role,
          boardId: notice.boardId ?? "",
          status: notice.status,
          registrationEndsOn: notice.registrationEndsOn ? utcToDateOnly(notice.registrationEndsOn) : "",
          examDate: notice.examDate ? utcToDateOnly(notice.examDate) : "",
          vacancies: notice.vacancies,
          salary: notice.salary,
          summary: notice.summary,
          body: notice.body,
          officialUrl: notice.officialUrl ?? "",
          productId: notice.productId ?? "",
          planId: notice.planId ?? "",
          couponCode: notice.couponCode ?? "",
          subjectIds: notice.subjects.map((item) => item.subjectId),
          isPublished: notice.isPublished,
        }}
        options={options}
      />
      <div className="flex flex-wrap gap-3 border-t pt-4">
        <ActionButton
          action={setNoticePublishedAction}
          fields={{ noticeId: notice.id, isPublished: notice.isPublished ? "false" : "true" }}
          variant="outline"
        >
          {notice.isPublished ? "Despublicar" : "Publicar"}
        </ActionButton>
        <ActionButton action={deleteNoticeAction} fields={{ noticeId: notice.id }} variant="destructive" confirmMessage="Apagar esta página? O endereço dela deixa de existir.">
          Apagar página
        </ActionButton>
      </div>
    </div>
  );
}
