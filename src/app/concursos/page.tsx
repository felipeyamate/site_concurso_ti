/**
 * page.tsx — Concursos: /concursos  (público)
 *
 * Quem chama: o Next.js (rodapé, página inicial, Google).
 * Lista as páginas de edital publicadas: primeiro inscrições abertas, depois previstos, por data.
 * `await connection()`: consulta o banco sem ler cookies (regra do CLAUDE.md).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { NOTICE_STATUS_LABELS } from "@/modules/notices/labels";
import { listPublishedNotices } from "@/modules/notices/notices.server";
import { formatDateOnly } from "@/modules/payments/dates";

export const metadata: Metadata = {
  title: "Concursos: o que cai de TI em cada edital",
  description: "Concursos com Informática e TI no edital: datas, banca, o que mais cai e como se preparar do zero.",
  alternates: { canonical: "/concursos" },
};

export default async function NoticesPage() {
  await connection();
  const notices = await listPublishedNotices();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Concursos</h1>
        <p className="text-muted-foreground">
          O que cai de Informática e TI em cada edital, as datas e como se preparar. Veja também{" "}
          <Link href="/o-que-mais-cai" className="underline">
            o que mais cai por banca
          </Link>
          .
        </p>
      </div>
      {notices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum concurso publicado ainda.</p>
      ) : (
        <div className="grid gap-4">
          {notices.map((notice) => (
            <article key={notice.id} className="grid gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={notice.status === "OPEN" ? "default" : "secondary"}>{NOTICE_STATUS_LABELS[notice.status]}</Badge>
                {notice.board ? <Badge variant="outline">{notice.board.name}</Badge> : null}
              </div>
              <h2 className="text-lg leading-snug font-semibold">
                <Link href={`/concursos/${notice.slug}`} className="hover:underline">
                  {notice.title}
                </Link>
              </h2>
              <p className="text-muted-foreground text-sm">
                {notice.organization}
                {notice.role ? ` · ${notice.role}` : ""}
                {notice.registrationEndsOn ? ` · inscrições até ${formatDateOnly(notice.registrationEndsOn)}` : ""}
                {notice.examDate ? ` · prova em ${formatDateOnly(notice.examDate)}` : ""}
              </p>
              {notice.summary ? <p className="text-sm leading-relaxed">{notice.summary}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
