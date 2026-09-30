/**
 * page.tsx — Meu desempenho: /area-do-aluno/desempenho  (exige login)
 *
 * Quem chama: o Next.js (link na área do aluno e no resultado do simulado).
 * Mostra: total de respostas e taxa de acerto, a tabela por assunto (pontos fracos primeiro, com
 * "Treinar" levando às questões do assunto) e os últimos simulados.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireSession } from "@/modules/auth/session";
import { MIN_ATTEMPTS_FOR_RANKING, WEAK_ACCURACY_PERCENT, accuracyPercent } from "@/modules/questions/performance";
import { getMyPerformance } from "@/modules/questions/performance.server";

export const metadata: Metadata = {
  title: "Meu desempenho",
  robots: { index: false },
};

export default async function PerformancePage() {
  const { user } = await requireSession("/area-do-aluno/desempenho");
  const performance = await getMyPerformance(user.id);
  const weak = performance.subjects.filter((subject) => subject.isWeak);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Meu desempenho</h1>
        <p className="text-muted-foreground text-sm">Conta todas as suas respostas: em &quot;Resolver questões&quot; e nos simulados.</p>
      </div>

      {performance.totals.attempts === 0 ? (
        <Card>
          <CardContent className="grid gap-3 text-sm">
            <p>Você ainda não respondeu nenhuma questão.</p>
            <Button asChild className="w-fit">
              <Link href="/questoes">Resolver questões</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Respostas</CardDescription>
                <CardTitle className="text-3xl">{performance.totals.attempts}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Acertos</CardDescription>
                <CardTitle className="text-3xl">{performance.totals.percent}%</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Últimos 7 dias</CardDescription>
                <CardTitle className="text-3xl">{performance.lastWeek}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {weak.length > 0 ? (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle>Seus pontos fracos</CardTitle>
                <CardDescription>
                  Assuntos com menos de {WEAK_ACCURACY_PERCENT}% de acerto (com pelo menos {MIN_ATTEMPTS_FOR_RANKING} respostas). Treine
                  as questões que você errou.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {weak.map((subject) => (
                  <Button key={subject.subjectId} asChild size="sm" variant="outline">
                    <Link href={`/questoes?assunto=${subject.slug}&situacao=erradas`}>
                      {subject.name} ({subject.percent}%)
                    </Link>
                  </Button>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* `min-w-0`: sem isto, a tabela larga "estica" o card e a página rola para o lado no celular. */}
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Por assunto</CardTitle>
            </CardHeader>
            <CardContent>
              {/* `relative`: o texto "sr-only" do cabeçalho fica preso aqui dentro, sem alargar a página. */}
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-left">
                      <th className="py-2 pr-4 font-medium">Assunto</th>
                      <th className="py-2 pr-4 font-medium">Respostas</th>
                      <th className="py-2 pr-4 font-medium">Acertos</th>
                      <th className="py-2 font-medium">
                        <span className="sr-only">Ações</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.subjects.map((subject) => (
                      <tr key={subject.subjectId} className="border-b last:border-0">
                        <td className="py-2 pr-4">
                          {subject.name} {subject.isWeak ? <Badge variant="outline">ponto fraco</Badge> : null}
                        </td>
                        <td className="py-2 pr-4">{subject.attempts}</td>
                        <td className="py-2 pr-4">{subject.percent}%</td>
                        <td className="py-2">
                          <Link href={`/questoes?assunto=${subject.slug}`} className="underline">
                            Treinar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Últimos simulados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {performance.mockExams.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum simulado finalizado.{" "}
              <Link href="/simulados" className="underline">
                Fazer um simulado
              </Link>
            </p>
          ) : (
            performance.mockExams.map((mockExam) => (
              <p key={mockExam.id} className="flex flex-wrap justify-between gap-2">
                <Link href={`/simulados/${mockExam.id}`} className="underline">
                  {mockExam.title}
                </Link>
                <span className="text-muted-foreground">
                  {mockExam.correctCount}/{mockExam.questionCount} ({accuracyPercent(mockExam.correctCount ?? 0, mockExam.questionCount)}%) ·{" "}
                  {mockExam.finishedAt ? formatDateTime(mockExam.finishedAt) : ""}
                </span>
              </p>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
