/**
 * mock-exam-result.tsx — O resultado de um simulado finalizado: nota, acertos por assunto e cada
 * questão com a resposta do aluno, o gabarito e o comentário.
 *
 * Quem chama: /simulados/[id] depois de finalizado.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { answerLabel, choicesFor } from "../answers";
import type { MockExamView } from "../mock-exams.server";
import { accuracyPercent } from "../performance";
import { AnswerChoices } from "./answer-choices";
import { QuestionMeta } from "./question-meta";

export function MockExamResult({ mockExam }: { mockExam: MockExamView }) {
  const correct = mockExam.correctCount ?? 0;
  const percent = accuracyPercent(correct, mockExam.questionCount);
  const blank = mockExam.items.filter((item) => item.answer === null).length;

  // Acertos por assunto (na ordem em que aparecem).
  const bySubject = new Map<string, { name: string; total: number; correct: number }>();
  for (const item of mockExam.items) {
    const key = item.question.subject.id;
    const entry = bySubject.get(key) ?? { name: item.question.subject.name, total: 0, correct: 0 };
    entry.total += 1;
    if (item.result?.isCorrect) entry.correct += 1;
    bySubject.set(key, entry);
  }

  return (
    <div className="grid gap-6">
      {/* `min-w-0`: sem isto, a tabela larga "estica" o card e a página rola para o lado no celular. */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className="text-3xl">
            {correct} de {mockExam.questionCount} ({percent}%)
          </CardTitle>
          <CardDescription>
            {blank > 0 ? `${blank} em branco (contam como erro). ` : ""}
            As respostas entraram no seu desempenho.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {/* `relative`: o texto "sr-only" do cabeçalho fica preso aqui dentro, sem alargar a página. */}
          <div className="relative overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left">
                  <th className="py-2 pr-4 font-medium">Assunto</th>
                  <th className="py-2 pr-4 font-medium">Acertos</th>
                  <th className="py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {[...bySubject.values()].map((row) => (
                  <tr key={row.name} className="border-b last:border-0">
                    <td className="py-2 pr-4">{row.name}</td>
                    <td className="py-2 pr-4">
                      {row.correct}/{row.total}
                    </td>
                    <td className="py-2">{accuracyPercent(row.correct, row.total)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/simulados">Novo simulado</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/area-do-aluno/desempenho">Meu desempenho</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {mockExam.items.map((item) => (
        <Card key={item.question.id}>
          <CardContent className="grid gap-4">
            <QuestionMeta question={item.question} number={item.position} />
            <AnswerChoices
              name={`r-${item.question.id}`}
              legend={`Correção da questão ${item.position}`}
              choices={choicesFor(item.question.type, item.question.options)}
              selected={item.answer}
              disabled
              correctAnswer={item.result?.correctAnswer ?? null}
            />
            <p className={item.result?.isCorrect ? "text-sm font-semibold text-green-700 dark:text-green-400" : "text-sm font-semibold text-red-700 dark:text-red-400"}>
              {item.answer === null
                ? `Em branco. Gabarito: ${answerLabel(item.question.type, item.result?.correctAnswer ?? "")}.`
                : item.result?.isCorrect
                  ? "Você acertou."
                  : `Você marcou ${answerLabel(item.question.type, item.answer)}. Gabarito: ${answerLabel(item.question.type, item.result?.correctAnswer ?? "")}.`}
            </p>
            <div className="bg-muted/50 rounded-md p-3 text-sm">
              <p className="mb-1 font-medium">Comentário do professor</p>
              <p className="whitespace-pre-line">{item.result?.explanation}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
