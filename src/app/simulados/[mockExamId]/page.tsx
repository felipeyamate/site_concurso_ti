/**
 * page.tsx — Um simulado: /simulados/[id]  (exige login; só o dono vê)
 *
 * Quem chama: o Next.js (depois de criar o simulado, ou pela lista "Meus simulados").
 * Mostra: enquanto em andamento, a prova (sem gabarito); depois de finalizado, o resultado com
 * gabarito e comentários. Simulado de outra pessoa = "página não encontrada".
 * Simulado aberto de quem perdeu o acesso completo (reembolso, fim da assinatura): aviso no lugar
 * da prova — salvar e finalizar seriam recusados (ver `mock-exams.server.ts`).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requireSession } from "@/modules/auth/session";
import { canUseMockExams } from "@/modules/questions/access";
import { MockExamResult } from "@/modules/questions/components/mock-exam-result";
import { MockExamRunner } from "@/modules/questions/components/mock-exam-runner";
import { getMockExamForOwner } from "@/modules/questions/mock-exams.server";
import { getQuestionBankLevelFor } from "@/modules/questions/questions.server";

export const metadata: Metadata = {
  title: "Simulado",
  robots: { index: false },
};

export default async function MockExamPage({ params }: PageProps<"/simulados/[mockExamId]">) {
  const { mockExamId } = await params;
  const { user } = await requireSession(`/simulados/${mockExamId}`);
  const mockExam = await getMockExamForOwner({ userId: user.id, mockExamId });
  if (!mockExam) notFound();
  const canContinue = mockExam.finishedAt !== null || canUseMockExams(await getQuestionBankLevelFor({ id: user.id, role: user.role }));

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10">
      <div className="grid gap-1">
        <Link href="/simulados" className="text-muted-foreground text-sm hover:underline">
          ← Simulados
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{mockExam.title}</h1>
        <p className="text-muted-foreground text-sm">
          {mockExam.finishedAt
            ? "Simulado finalizado: veja a correção e os comentários abaixo."
            : "Suas respostas são salvas a cada clique. O gabarito aparece quando você finalizar."}
        </p>
      </div>

      {mockExam.finishedAt ? (
        <MockExamResult mockExam={mockExam} />
      ) : !canContinue ? (
        <Alert>
          <AlertTitle>Seu acesso aos simulados terminou</AlertTitle>
          <AlertDescription>
            Simulados são para quem tem um curso ou a assinatura. Com o acesso de volta, você continua este simulado de onde
            parou.{" "}
            <Link href="/planos" className="underline">
              Ver planos
            </Link>
          </AlertDescription>
        </Alert>
      ) : (
        <MockExamRunner
          mockExamId={mockExam.id}
          items={mockExam.items.map((item) => ({ position: item.position, answer: item.answer, question: item.question }))}
          remainingMs={mockExam.remainingMs}
          timeIsUp={mockExam.timeIsUp}
        />
      )}
    </div>
  );
}
