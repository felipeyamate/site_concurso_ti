/**
 * page.tsx — Nova questão: /admin/questoes/nova  (exige perfil PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (atalho "Nova questão").
 * Mostra: o formulário da questão; ao salvar, vai para a página da questão criada.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/auth/session";
import { QuestionForm } from "@/modules/questions/admin/components/question-form";
import { QuestionsSubnav } from "@/modules/questions/admin/components/questions-subnav";
import { listClassification } from "@/modules/questions/admin/questions-admin.server";

export const metadata: Metadata = {
  title: "Nova questão · Painel admin",
  robots: { index: false },
};

export default async function NewQuestionPage() {
  await requireRole("TEACHER", "/admin/questoes/nova");
  const { boards, subjects, exams } = await listClassification();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Nova questão</h1>
        <QuestionsSubnav current="new" />
      </div>
      {subjects.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">
          Cadastre pelo menos um assunto antes, em{" "}
          <Link href="/admin/questoes/classificacao" className="underline">
            Bancas, assuntos e provas
          </Link>
          .
        </p>
      ) : (
        <QuestionForm
          subjects={subjects}
          boards={boards}
          exams={exams.map((exam) => ({ id: exam.id, name: exam.name, year: exam.year, boardName: exam.board.name }))}
        />
      )}
    </div>
  );
}
