/**
 * page.tsx — O que mais cai: /o-que-mais-cai  (PÚBLICA)
 *
 * Quem chama: o Next.js (link no rodapé, na página inicial e em "Resolver questões").
 * Mostra: para cada banca (e para todas juntas), os assuntos de TI mais cobrados nas provas
 * cadastradas, do mais ao menos cobrado, com a porcentagem e um atalho para treinar o assunto.
 * `?banca=<slug>` escolhe a banca.
 *
 * Por que pública: é o diferencial do site ("estude primeiro o que dá mais pontos") e ajuda no
 * SEO. Não mostra questões — só as contagens.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getIncidenceMap } from "@/modules/questions/incidence.server";
import { questionsCountLabel } from "@/modules/questions/labels";

export const metadata: Metadata = {
  title: "O que mais cai de TI nos concursos, por banca",
  description:
    "Os assuntos de Informática e TI mais cobrados pela Cesgranrio, Cebraspe, FGV e outras bancas, calculados a partir das provas analisadas.",
};

// Quantos assuntos mostrar por banca (o resto aparece como "outros").
const TOP_SUBJECTS = 10;

export default async function IncidencePage({ searchParams }: PageProps<"/o-que-mais-cai">) {
  // Página que consulta o banco sem ler cookies: sem isto o `next build` tentaria gerá-la
  // antes (e o CI não tem banco no build).
  await connection();
  const params = await searchParams;
  const selectedSlug = typeof params.banca === "string" ? params.banca : null;
  const map = await getIncidenceMap();
  const selected = map.boards.find((board) => board.slug === selectedSlug) ?? map.overall;
  const top = selected.subjects.slice(0, TOP_SUBJECTS);
  const others = selected.subjects.slice(TOP_SUBJECTS).reduce((sum, subject) => sum + subject.count, 0);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">O que mais cai de TI nos concursos</h1>
        <p className="text-muted-foreground">
          Estude primeiro o que dá mais pontos. Os números vêm das questões de provas já aplicadas que analisamos
          {map.examCount > 0 ? ` (${map.examCount} ${map.examCount === 1 ? "prova" : "provas"}, ${questionsCountLabel(map.overall.total)})` : ""}.
        </p>
      </div>

      {map.overall.total === 0 ? (
        <p className="rounded-lg border p-6 text-sm">Ainda estamos cadastrando as provas. Volte em breve!</p>
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Bancas">
            <Button asChild size="sm" variant={selected.boardId === null ? "default" : "outline"}>
              <Link href="/o-que-mais-cai" aria-current={selected.boardId === null ? "page" : undefined}>
                Todas as bancas
              </Link>
            </Button>
            {map.boards.map((board) => (
              <Button key={board.boardId} asChild size="sm" variant={board.boardId === selected.boardId ? "default" : "outline"}>
                <Link
                  href={`/o-que-mais-cai?banca=${board.slug}`}
                  aria-current={board.boardId === selected.boardId ? "page" : undefined}
                >
                  {board.name}
                </Link>
              </Button>
            ))}
          </nav>

          <Card>
            <CardHeader>
              <CardTitle>{selected.name}</CardTitle>
              <CardDescription>{questionsCountLabel(selected.total)} de prova analisadas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                {top.map((subject, index) => (
                  <li key={subject.subjectId} className="grid gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <span>
                        <span className="text-muted-foreground mr-2">{index + 1}.</span>
                        <span className="font-medium">{subject.name}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {String(subject.percent).replace(".", ",")}% · {questionsCountLabel(subject.count)}{" "}
                        <Link
                          href={`/questoes?assunto=${subject.slug}${selected.slug ? `&banca=${selected.slug}` : ""}`}
                          className="text-foreground underline"
                        >
                          Treinar
                        </Link>
                      </span>
                    </div>
                    {/* A barra mostra a porcentagem; o número acima é o que o leitor de tela lê. */}
                    <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden="true">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, subject.percent)}%` }} />
                    </div>
                  </li>
                ))}
              </ol>
              {others > 0 ? <p className="text-muted-foreground mt-3 text-sm">Outros assuntos: {questionsCountLabel(others)}.</p> : null}
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-sm">
            Quer treinar?{" "}
            <Link href="/questoes" className="underline">
              Resolva questões comentadas
            </Link>{" "}
            (crie sua conta grátis para começar).
          </p>
        </>
      )}
    </div>
  );
}
