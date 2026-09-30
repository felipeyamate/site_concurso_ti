/**
 * page.tsx — Trilhas de estudo: /trilhas  (público)
 *
 * Quem chama: o Next.js (menu, página inicial, páginas de concurso, Google).
 * Lista as trilhas publicadas: um roteiro por concurso/banca, com aulas e treinos de questões na ordem
 * do que mais cai.
 * `await connection()`: consulta o banco sem ler cookies (regra do CLAUDE.md).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { listPublishedTracks } from "@/modules/tracks/tracks.server";

export const metadata: Metadata = {
  title: "Trilhas de estudo: TI para concursos, passo a passo",
  description: "Roteiros de estudo de Informática e TI por concurso e banca: aulas e questões na ordem do que mais cai.",
  alternates: { canonical: "/trilhas" },
};

export default async function TracksPage() {
  await connection();
  const tracks = await listPublishedTracks();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Trilhas de estudo</h1>
        <p className="text-muted-foreground">
          Um roteiro passo a passo para cada concurso ou banca: as aulas e os treinos de questões na ordem do que mais cai — você
          estuda primeiro o que dá mais pontos. Veja também{" "}
          <Link href="/o-que-mais-cai" className="underline">
            o que mais cai por banca
          </Link>
          .
        </p>
      </div>
      {tracks.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma trilha publicada ainda.</p>
      ) : (
        <div className="grid gap-4">
          {tracks.map((track) => (
            <article key={track.id} className="grid gap-2 rounded-lg border p-4">
              {track.board ? (
                <div>
                  <Badge variant="outline">{track.board.name}</Badge>
                </div>
              ) : null}
              <h2 className="text-lg leading-snug font-semibold">
                <Link href={`/trilhas/${track.slug}`} className="hover:underline">
                  {track.title}
                </Link>
              </h2>
              <p className="text-muted-foreground text-sm">
                {track.lessonCount} aula(s) · {track.practiceCount} treino(s) de questões
              </p>
              {track.summary ? <p className="text-sm leading-relaxed">{track.summary}</p> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
