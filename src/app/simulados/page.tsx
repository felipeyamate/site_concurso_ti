/**
 * page.tsx — Simulados: /simulados  (exige login)
 *
 * Quem chama: o Next.js (link na área do aluno e no desempenho).
 * Mostra: o formulário "Novo simulado" (para quem tem acesso completo; conta gratuita vê o convite
 * para os planos) e a lista dos simulados do aluno (em andamento e finalizados, com a nota).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { requireSession } from "@/modules/auth/session";
import { canUseMockExams } from "@/modules/questions/access";
import { MockExamForm } from "@/modules/questions/components/mock-exam-form";
import { MAX_OPEN_MOCK_EXAMS } from "@/modules/questions/mock-exam";
import { getMockExamFormOptions, listMyMockExams } from "@/modules/questions/mock-exams.server";
import { accuracyPercent } from "@/modules/questions/performance";
import { getQuestionBankLevelFor } from "@/modules/questions/questions.server";

export const metadata: Metadata = {
  title: "Simulados",
  robots: { index: false },
};

export default async function MockExamsPage() {
  const { user } = await requireSession("/simulados");
  const [level, mockExams, formOptions] = await Promise.all([
    getQuestionBankLevelFor({ id: user.id, role: user.role }),
    listMyMockExams(user.id),
    getMockExamFormOptions(),
  ]);
  const openCount = mockExams.filter((mockExam) => mockExam.finishedAt === null).length;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/area-do-aluno" className="text-muted-foreground text-sm hover:underline">
          ← Área do aluno
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Simulados</h1>
        <p className="text-muted-foreground text-sm">
          Questões sorteadas (primeiro as que você ainda não respondeu), com tempo de prova. O gabarito e os comentários aparecem no
          fim.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo simulado</CardTitle>
          {canUseMockExams(level) && openCount >= MAX_OPEN_MOCK_EXAMS ? (
            <CardDescription>
              Você já tem {MAX_OPEN_MOCK_EXAMS} simulados em andamento. Finalize um deles para começar outro.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>
          {!canUseMockExams(level) ? (
            <Alert>
              <AlertTitle>Simulados são para alunos</AlertTitle>
              <AlertDescription>
                Com um curso ou a assinatura você faz simulados e resolve questões sem limite.{" "}
                <Link href="/planos" className="underline">
                  Ver planos
                </Link>
              </AlertDescription>
            </Alert>
          ) : formOptions.subjects.length === 0 ? (
            <p className="text-sm">Ainda não há questões publicadas para montar um simulado.</p>
          ) : (
            <MockExamForm boards={formOptions.boards} subjects={formOptions.subjects} />
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Meus simulados</h2>
        {mockExams.length === 0 ? (
          <p className="text-muted-foreground text-sm">Você ainda não fez nenhum simulado.</p>
        ) : (
          mockExams.map((mockExam) => (
            <article key={mockExam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
              <div className="grid gap-1">
                <p className="font-medium">{mockExam.title}</p>
                <p className="text-muted-foreground text-xs">Começou em {formatDateTime(mockExam.startedAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                {mockExam.finishedAt ? (
                  <Badge variant="secondary">
                    {mockExam.correctCount}/{mockExam.questionCount} ({accuracyPercent(mockExam.correctCount ?? 0, mockExam.questionCount)}%)
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    Em andamento · {mockExam.answeredCount}/{mockExam.questionCount}
                  </Badge>
                )}
                <Button asChild size="sm" variant={mockExam.finishedAt ? "outline" : "default"}>
                  <Link href={`/simulados/${mockExam.id}`}>{mockExam.finishedAt ? "Ver resultado" : "Continuar"}</Link>
                </Button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
