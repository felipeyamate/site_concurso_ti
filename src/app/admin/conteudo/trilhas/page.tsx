/**
 * page.tsx — Trilhas de estudo no painel: /admin/conteudo/trilhas  (PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (Conteúdo do site → Trilhas).
 * Lista as trilhas (rascunhos primeiro) e o botão "Nova trilha".
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/modules/auth/session";
import { listTracksForAdmin } from "@/modules/tracks/tracks-admin.server";

export const metadata: Metadata = {
  title: "Trilhas · Painel admin",
  robots: { index: false },
};

export default async function AdminTracksPage() {
  await requireRole("TEACHER", "/admin/conteudo/trilhas");
  const tracks = await listTracksForAdmin();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trilhas de estudo</h1>
          <p className="text-muted-foreground text-sm">
            Um roteiro por concurso ou banca: etapas com aulas (de qualquer curso) e treinos de questões, na ordem do que mais cai.
            A trilha não libera aulas — quem libera é a matrícula no curso de cada aula.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/conteudo/trilhas/nova">Nova trilha</Link>
        </Button>
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma trilha ainda.</p>
      ) : (
        <div className="grid gap-3">
          {tracks.map((track) => (
            <div key={track.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{track.title}</span>
                  <Badge variant={track.isPublished ? "default" : "secondary"}>{track.isPublished ? "Publicada" : "Rascunho"}</Badge>
                </div>
                <p className="text-muted-foreground text-sm break-all">
                  /trilhas/{track.slug}
                  {track.board ? ` · ${track.board.name}` : ""} · {track._count.sections} etapa(s)
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/conteudo/trilhas/${track.id}`}>Editar</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
