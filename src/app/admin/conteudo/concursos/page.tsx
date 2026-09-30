/**
 * page.tsx — Páginas de edital no painel: /admin/conteudo/concursos  (PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (Conteúdo do site → Concursos).
 * Lista as páginas (rascunhos primeiro) e o botão "Nova página".
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/modules/auth/session";
import { NOTICE_STATUS_LABELS } from "@/modules/notices/labels";
import { listNoticesForAdmin } from "@/modules/notices/notices-admin.server";
import { formatDateOnly } from "@/modules/payments/dates";

export const metadata: Metadata = {
  title: "Concursos · Painel admin",
  robots: { index: false },
};

export default async function AdminNoticesPage() {
  await requireRole("TEACHER", "/admin/conteudo/concursos");
  const notices = await listNoticesForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Concursos (páginas de edital)</h1>
          <p className="text-muted-foreground text-sm">
            Uma página por concurso: o que cai de TI, as datas, a banca e a oferta (com cupom). Atrai quem pesquisa o edital no Google.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/conteudo/concursos/nova">Nova página</Link>
        </Button>
      </div>
      {notices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma página ainda.</p>
      ) : (
        <div className="grid gap-3">
          {notices.map((notice) => (
            <div key={notice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{notice.title}</span>
                  <Badge variant={notice.isPublished ? "default" : "secondary"}>{notice.isPublished ? "Publicada" : "Rascunho"}</Badge>
                  <Badge variant="outline">{NOTICE_STATUS_LABELS[notice.status]}</Badge>
                </div>
                <p className="text-muted-foreground text-sm">
                  /concursos/{notice.slug}
                  {notice.board ? ` · ${notice.board.name}` : ""}
                  {notice.examDate ? ` · prova em ${formatDateOnly(notice.examDate)}` : ""}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/conteudo/concursos/${notice.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
