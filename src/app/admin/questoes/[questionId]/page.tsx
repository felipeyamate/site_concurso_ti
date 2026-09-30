/**
 * page.tsx — Editar questão: /admin/questoes/[id]  (exige perfil PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (botão "Editar" da lista, ou depois de criar a questão).
 * Mostra: o formulário preenchido, quantos alunos responderam (e a taxa de acerto) e "Apagar"
 * (só sem histórico de aluno — com histórico, tipo/letras/gabarito ficam travados).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionButton } from "@/components/admin/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { deleteQuestionAction } from "@/modules/questions/admin/actions";
import { QuestionForm } from "@/modules/questions/admin/components/question-form";
import { QuestionsSubnav } from "@/modules/questions/admin/components/questions-subnav";
import { getQuestionForAdmin, listClassification } from "@/modules/questions/admin/questions-admin.server";
import { accuracyPercent } from "@/modules/questions/performance";

export const metadata: Metadata = {
  title: "Questão · Painel admin",
  robots: { index: false },
};

export default async function EditQuestionPage({ params }: PageProps<"/admin/questoes/[questionId]">) {
  const { questionId } = await params;
  await requireRole("TEACHER", `/admin/questoes/${questionId}`);
  const [question, { boards, subjects, exams }] = await Promise.all([getQuestionForAdmin(questionId), listClassification()]);
  if (!question) notFound();
  const hasHistory = question._count.attempts + question._count.mockExamItems > 0;

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-3">
        <Link href="/admin/questoes" className="text-muted-foreground text-sm hover:underline">
          ← Questões
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Editar questão</h1>
        <QuestionsSubnav current={null} />
        <p className="text-muted-foreground text-sm">
          {question._count.attempts} resposta(s) de alunos
          {question._count.attempts > 0 ? ` · ${accuracyPercent(question.correctAttempts, question._count.attempts)}% de acerto` : ""}.
          {hasHistory ? " Como já foi respondida, dá para corrigir os textos, mas não o tipo, as letras nem o gabarito." : ""}
        </p>
      </div>

      <QuestionForm
        question={{
          id: question.id,
          code: question.code,
          type: question.type,
          statement: question.statement,
          options: question.options.map((option) => ({ label: option.label, text: option.text })),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          subjectId: question.subjectId,
          boardId: question.boardId,
          examId: question.examId,
          isPublished: question.isPublished,
        }}
        subjects={subjects}
        boards={boards}
        exams={exams.map((exam) => ({ id: exam.id, name: exam.name, year: exam.year, boardName: exam.board.name }))}
        hasHistory={hasHistory}
      />

      {!hasHistory ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Apagar questão</CardTitle>
            <CardDescription>Só enquanto nenhum aluno respondeu. Depois disso, despublique.</CardDescription>
          </CardHeader>
          <CardContent>
            <ActionButton
              action={deleteQuestionAction}
              fields={{ id: question.id }}
              variant="destructive"
              confirmMessage="Apagar esta questão? Não dá para desfazer."
            >
              Apagar questão
            </ActionButton>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
