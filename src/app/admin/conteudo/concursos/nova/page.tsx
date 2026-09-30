/**
 * page.tsx — Nova página de edital: /admin/conteudo/concursos/nova  (PROFESSOR ou mais)
 *
 * Quem chama: o botão "Nova página". Depois de criar, vai para a edição da página.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { hasMinimumRole } from "@/modules/auth/roles";
import { requireRole } from "@/modules/auth/session";
import { NoticeForm } from "@/modules/notices/components/notice-form";
import { listNoticeFormOptions } from "@/modules/notices/notices-admin.server";

export const metadata: Metadata = {
  title: "Nova página de concurso · Painel admin",
  robots: { index: false },
};

export default async function NewNoticePage() {
  const { user } = await requireRole("TEACHER", "/admin/conteudo/concursos/nova");
  const options = await listNoticeFormOptions();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/concursos" className="text-muted-foreground text-sm hover:underline">
          ← Concursos
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nova página de concurso</h1>
      </div>
      <NoticeForm
        notice={{
          id: null,
          title: "",
          slug: "",
          organization: "",
          role: "",
          boardId: "",
          status: "EXPECTED",
          registrationEndsOn: "",
          examDate: "",
          vacancies: "",
          salary: "",
          summary: "",
          body: "",
          officialUrl: "",
          productId: "",
          planId: "",
          couponCode: "",
          subjectIds: [],
          trackId: "",
          isPublished: false,
        }}
        options={options}
        canChooseCoupon={hasMinimumRole(user.role, "ADMIN")}
      />
    </div>
  );
}
