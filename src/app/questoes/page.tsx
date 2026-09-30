/**
 * page.tsx — Resolver questões: /questoes  (exige login)
 *
 * Quem chama: o Next.js (links da área do aluno, do mapa "o que mais cai" e do desempenho).
 * Mostra: filtros (assunto, banca, prova, tipo, situação), as questões da página (10 por vez) e
 * quantas questões grátis restam hoje para quem não tem curso nem assinatura.
 * O gabarito e o comentário NÃO estão nesta página: chegam só depois de responder.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Pager } from "@/components/admin/pager";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { requireSession } from "@/modules/auth/session";
import { listStudyLessonsBySubject } from "@/modules/catalog/lesson-subjects.server";
import { QuestionCard } from "@/modules/questions/components/question-card";
import { PRACTICE_STATUS_LABELS, questionsCountLabel } from "@/modules/questions/labels";
import { getQuestionBankStatus, listFilterOptions, listPracticeQuestions, PRACTICE_PAGE_SIZE } from "@/modules/questions/questions.server";
import { PRACTICE_STATUSES, parsePracticeFilters, practiceFiltersToQuery } from "@/modules/questions/schemas";

export const metadata: Metadata = {
  title: "Resolver questões",
  robots: { index: false },
};

export default async function QuestionsPage({ searchParams }: PageProps<"/questoes">) {
  const { user } = await requireSession("/questoes");
  const filters = parsePracticeFilters(await searchParams);
  const [status, options, result] = await Promise.all([
    getQuestionBankStatus({ id: user.id, role: user.role }),
    listFilterOptions(),
    listPracticeQuestions({ userId: user.id, filters }),
  ]);
  // Fase 8: "estude esta aula" — as aulas que ensinam o assunto de cada questão da página (uma consulta só).
  const studyLessons = await listStudyLessonsBySubject([...new Set(result.questions.map((question) => question.subject.id))]);
  const hrefFor = (page: number) => `/questoes${practiceFiltersToQuery(filters, page)}`;
  const firstNumber = (result.page - 1) * PRACTICE_PAGE_SIZE + 1;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Resolver questões</h1>
        <p className="text-muted-foreground text-sm">
          Escolha a alternativa e clique em &quot;Responder&quot;: o gabarito e o comentário do professor aparecem na hora.{" "}
          <Link href="/o-que-mais-cai" className="underline">
            Veja o que mais cai
          </Link>{" "}
          para começar pelo que dá mais pontos.
        </p>
      </div>

      {status.level === "FREE" ? (
        <Alert>
          <AlertTitle>
            {status.remainingFree === 0 ? "Suas questões grátis de hoje acabaram" : `Hoje você ainda tem ${questionsCountLabel(status.remainingFree ?? 0)} grátis`}
          </AlertTitle>
          <AlertDescription>
            Na conta gratuita são {status.dailyFreeLimit} por dia. Com um curso ou a assinatura, você resolve sem limite e faz simulados.{" "}
            <Link href="/planos" className="underline">
              Ver planos
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <form action="/questoes" className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2" role="search">
        <div className="grid gap-1">
          <Label htmlFor="filtro-assunto">Assunto</Label>
          <NativeSelect id="filtro-assunto" name="assunto" defaultValue={filters.subject ?? ""}>
            <option value="">Todos</option>
            {options.subjects.map((subject) => (
              <option key={subject.id} value={subject.slug}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filtro-banca">Banca</Label>
          <NativeSelect id="filtro-banca" name="banca" defaultValue={filters.board ?? ""}>
            <option value="">Todas</option>
            {options.boards.map((board) => (
              <option key={board.id} value={board.slug}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="filtro-prova">Prova</Label>
          <NativeSelect id="filtro-prova" name="prova" defaultValue={filters.exam ?? ""}>
            <option value="">Todas</option>
            {options.exams.map((exam) => (
              <option key={exam.id} value={exam.slug}>
                {exam.name} ({exam.year})
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <Label htmlFor="filtro-tipo">Tipo</Label>
            <NativeSelect
              id="filtro-tipo"
              name="tipo"
              defaultValue={filters.type === "MULTIPLE_CHOICE" ? "multipla-escolha" : filters.type === "TRUE_FALSE" ? "certo-errado" : ""}
            >
              <option value="">Todos</option>
              <option value="multipla-escolha">Múltipla escolha</option>
              <option value="certo-errado">Certo ou errado</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="filtro-situacao">Situação</Label>
            <NativeSelect id="filtro-situacao" name="situacao" defaultValue={filters.status}>
              {PRACTICE_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PRACTICE_STATUS_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" variant="outline">
            Filtrar
          </Button>
          <Button asChild variant="ghost">
            <Link href="/questoes">Limpar filtros</Link>
          </Button>
        </div>
      </form>

      <p className="text-muted-foreground text-sm">{questionsCountLabel(result.total)} encontradas.</p>

      {result.questions.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">
          Nenhuma questão com esses filtros.{" "}
          {filters.status !== "todas" ? "Tente a situação \"Todas\" ou outro assunto." : "Tente outro assunto ou outra banca."}
        </p>
      ) : (
        <div className="grid gap-4">
          {result.questions.map((question, index) => (
            <QuestionCard key={question.id} question={question} number={firstNumber + index} studyLessons={studyLessons.get(question.subject.id) ?? []} />
          ))}
        </div>
      )}

      <Pager page={result.page} pageCount={result.pageCount} hrefFor={hrefFor} />
    </div>
  );
}
