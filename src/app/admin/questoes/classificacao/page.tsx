/**
 * page.tsx — Bancas, assuntos e provas: /admin/questoes/classificacao  (PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (atalho da seção de questões).
 * Mostra: as três listas, cada item editável, com "Apagar" quando não tem questões (ou provas).
 * Os assuntos são a base do mapa "o que mais cai" e do desempenho do aluno.
 */
import "server-only";

import type { Metadata } from "next";

import { ActionButton } from "@/components/admin/action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { deleteBoardAction, deleteExamAction, deleteSubjectAction } from "@/modules/questions/admin/actions";
import { BoardForm, ExamForm, SubjectForm } from "@/modules/questions/admin/components/classification-forms";
import { QuestionsSubnav } from "@/modules/questions/admin/components/questions-subnav";
import { listClassification } from "@/modules/questions/admin/questions-admin.server";

export const metadata: Metadata = {
  title: "Bancas, assuntos e provas · Painel admin",
  robots: { index: false },
};

export default async function ClassificationPage() {
  await requireRole("TEACHER", "/admin/questoes/classificacao");
  const { boards, subjects, exams } = await listClassification();

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bancas, assuntos e provas</h1>
        <QuestionsSubnav current="classification" />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Assuntos</CardTitle>
          <CardDescription>O que é cobrado (ex.: &quot;Segurança da Informação — malware&quot;). Ordem: menor primeiro nas listas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <SubjectForm />
          {subjects.map((subject) => (
            <div key={subject.id} className="grid gap-2 border-t pt-3">
              <SubjectForm subject={subject} />
              <p className="text-muted-foreground text-xs">{subject._count.questions} questão(ões)</p>
              {subject._count.questions === 0 ? (
                <ActionButton action={deleteSubjectAction} fields={{ id: subject.id }} size="sm" variant="ghost" confirmMessage={`Apagar "${subject.name}"?`}>
                  Apagar
                </ActionButton>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Bancas</CardTitle>
          <CardDescription>Quem organiza as provas (ex.: Cesgranrio, Cebraspe, FGV).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <BoardForm />
          {boards.map((board) => (
            <div key={board.id} className="grid gap-2 border-t pt-3">
              <BoardForm board={board} />
              <p className="text-muted-foreground text-xs">
                {board._count.exams} prova(s) · {board._count.questions} questão(ões)
              </p>
              {board._count.exams + board._count.questions === 0 ? (
                <ActionButton action={deleteBoardAction} fields={{ id: board.id }} size="sm" variant="ghost" confirmMessage={`Apagar "${board.name}"?`}>
                  Apagar
                </ActionButton>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Provas</CardTitle>
          <CardDescription>
            Provas já aplicadas. Questões ligadas a uma prova contam no mapa &quot;o que mais cai&quot; (e ganham a banca da prova).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {boards.length === 0 ? <p className="text-sm">Cadastre uma banca antes.</p> : <ExamForm boards={boards} />}
          {exams.map((exam) => (
            <div key={exam.id} className="grid gap-2 border-t pt-3">
              <ExamForm exam={exam} boards={boards} />
              <p className="text-muted-foreground text-xs">{exam._count.questions} questão(ões)</p>
              {exam._count.questions === 0 ? (
                <ActionButton action={deleteExamAction} fields={{ id: exam.id }} size="sm" variant="ghost" confirmMessage={`Apagar "${exam.name}"?`}>
                  Apagar
                </ActionButton>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
