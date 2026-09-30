/**
 * mock-exams.server.ts — Simulados: criar (sortear as questões), salvar as respostas, finalizar
 * (corrigir) e listar.
 *
 * Quem chama: as ações de `actions.ts` e as páginas /simulados. Os testes de integração chamam direto.
 *
 * Como funciona um simulado:
 *  1. O aluno escolhe banca, assuntos, quantidade e tempo; sorteamos as questões publicadas
 *     (primeiro as que ele ainda não respondeu).
 *  2. Ele marca as respostas (cada uma é salva na hora), SEM ver gabarito nem comentário.
 *  3. Ao finalizar (ou quando o tempo acaba), corrigimos: nota, gabarito e comentários aparecem, e
 *     cada resposta vira uma tentativa no desempenho do aluno.
 *
 * Travas: criar usa a trava do aluno (limite de simulados abertos); salvar resposta e finalizar
 * usam a trava do simulado — assim nenhuma resposta entra depois da correção.
 */
import "server-only";

import { randomInt } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { withAdvisoryLock } from "@/lib/db-locks";
import { UserFacingError } from "@/lib/form-state";

import { canUseMockExams } from "./access";
import { isValidAnswer } from "./answers";
import {
  DEADLINE_GRACE_SECONDS,
  MAX_OPEN_MOCK_EXAMS,
  buildMockExamTitle,
  drawMockExamQuestions,
  isPastDeadline,
  mockExamDeadline,
  scoreMockExam,
} from "./mock-exam";
import { getQuestionBankLevelFor, type QuestionViewer } from "./questions.server";

// Aleatório de qualidade criptográfica (o aluno não consegue prever o sorteio).
const cryptoRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

/**
 * Simulado é só para quem tem acesso completo (ver `access.ts`). Conferido ao criar, ao salvar e
 * ao finalizar: o acesso pode acabar no meio do caminho (reembolso, fim da assinatura).
 */
async function ensureMockExamAccess(tx: Prisma.TransactionClient, viewer: QuestionViewer, now: Date): Promise<void> {
  if (!canUseMockExams(await getQuestionBankLevelFor(viewer, now, tx))) {
    throw new UserFacingError("Simulados são para quem tem um curso ou a assinatura. Veja os planos.");
  }
}

/**
 * Cria um simulado.
 * Passos (com a trava do aluno):
 *  1. Acesso completo (simulado não é da conta gratuita) e menos de MAX_OPEN_MOCK_EXAMS abertos.
 *  2. Busca os IDs das questões publicadas com os filtros e as que o aluno já respondeu.
 *  3. Sorteia (`drawMockExamQuestions`) e grava o simulado com as questões na ordem sorteada.
 */
export async function createMockExam(input: {
  viewer: QuestionViewer;
  boardId: string | null;
  subjectIds: string[];
  count: number;
  timeLimitMinutes: number | null;
  now?: Date;
  random?: () => number;
}): Promise<{ mockExamId: string }> {
  const now = input.now ?? new Date();
  return withAdvisoryLock(prisma, `questions:${input.viewer.id}`, async (tx) => {
    await ensureMockExamAccess(tx, input.viewer, now);
    const open = await tx.mockExam.count({ where: { userId: input.viewer.id, finishedAt: null } });
    if (open >= MAX_OPEN_MOCK_EXAMS) {
      throw new UserFacingError(`Você já tem ${MAX_OPEN_MOCK_EXAMS} simulados em andamento. Finalize um deles antes de começar outro.`);
    }

    const [board, subjects] = await Promise.all([
      input.boardId ? tx.board.findUnique({ where: { id: input.boardId }, select: { id: true, name: true } }) : null,
      tx.subject.findMany({ where: { id: { in: input.subjectIds } }, select: { id: true, name: true } }),
    ]);
    if (input.boardId && !board) throw new UserFacingError("Banca não encontrada.");
    if (subjects.length !== new Set(input.subjectIds).size) throw new UserFacingError("Assunto não encontrado.");

    const candidates = await tx.question.findMany({
      where: {
        isPublished: true,
        ...(board ? { boardId: board.id } : {}),
        ...(subjects.length > 0 ? { subjectId: { in: subjects.map((subject) => subject.id) } } : {}),
      },
      select: { id: true },
    });
    if (candidates.length === 0) throw new UserFacingError("Nenhuma questão com esses filtros. Escolha outra banca ou mais assuntos.");
    const answered = await tx.questionAttempt.findMany({
      where: { userId: input.viewer.id, questionId: { in: candidates.map((question) => question.id) } },
      select: { questionId: true },
      distinct: ["questionId"],
    });

    const drawn = drawMockExamQuestions({
      candidateIds: candidates.map((question) => question.id),
      answeredIds: new Set(answered.map((row) => row.questionId)),
      count: input.count,
      random: input.random ?? cryptoRandom,
    });
    const mockExam = await tx.mockExam.create({
      data: {
        userId: input.viewer.id,
        title: buildMockExamTitle({ boardName: board?.name ?? null, subjectNames: subjects.map((subject) => subject.name), count: drawn.length }),
        questionCount: drawn.length,
        timeLimitMinutes: input.timeLimitMinutes,
        startedAt: now,
        items: { create: drawn.map((questionId, index) => ({ questionId, position: index + 1 })) },
      },
      select: { id: true },
    });
    return { mockExamId: mockExam.id };
  });
}

/**
 * O simulado para a tela: dono só (de outra pessoa = null → "não encontrado").
 * Antes de finalizar: enunciado, alternativas e a resposta marcada — SEM gabarito/comentário
 * (nem chegam a ser buscados no banco). Depois: também gabarito, comentário e se acertou.
 * `remainingMs` = quanto tempo falta, medido AQUI (relógio do servidor): o navegador conta a partir
 * disso, sem depender do relógio do aparelho do aluno (que pode estar adiantado ou atrasado).
 */
export async function getMockExamForOwner(input: { userId: string; mockExamId: string; now?: Date }) {
  const now = input.now ?? new Date();
  const mockExam = await prisma.mockExam.findUnique({
    where: { id: input.mockExamId },
    select: {
      id: true,
      userId: true,
      title: true,
      questionCount: true,
      timeLimitMinutes: true,
      startedAt: true,
      finishedAt: true,
      correctCount: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          answer: true,
          isCorrect: true,
          question: {
            select: {
              id: true,
              type: true,
              statement: true,
              options: { orderBy: { label: "asc" }, select: { label: true, text: true } },
              subject: { select: { id: true, name: true } },
              board: { select: { name: true } },
              exam: { select: { name: true, year: true } },
            },
          },
        },
      },
    },
  });
  if (!mockExam || mockExam.userId !== input.userId) return null;

  const finished = mockExam.finishedAt !== null;
  // Gabarito e comentário: só de simulado finalizado (numa segunda consulta).
  const answerKeys = finished
    ? new Map(
        (
          await prisma.question.findMany({
            where: { id: { in: mockExam.items.map((item) => item.question.id) } },
            select: { id: true, correctAnswer: true, explanation: true },
          })
        ).map((question) => [question.id, question]),
      )
    : null;
  const deadline = mockExamDeadline(mockExam.startedAt, mockExam.timeLimitMinutes);
  return {
    id: mockExam.id,
    title: mockExam.title,
    questionCount: mockExam.questionCount,
    timeLimitMinutes: mockExam.timeLimitMinutes,
    startedAt: mockExam.startedAt,
    finishedAt: mockExam.finishedAt,
    correctCount: mockExam.correctCount,
    deadline,
    remainingMs: deadline ? Math.max(0, deadline.getTime() - now.getTime()) : null,
    timeIsUp: !finished && isPastDeadline({ startedAt: mockExam.startedAt, timeLimitMinutes: mockExam.timeLimitMinutes, now }),
    items: mockExam.items.map((item) => {
      const key = answerKeys?.get(item.question.id);
      return {
        position: item.position,
        answer: item.answer,
        question: item.question,
        // Só depois de finalizado.
        result: key ? { isCorrect: item.isCorrect === true, correctAnswer: key.correctAnswer, explanation: key.explanation } : null,
      };
    }),
  };
}
export type MockExamView = NonNullable<Awaited<ReturnType<typeof getMockExamForOwner>>>;

/**
 * O relógio do simulado, "fresco" (medido agora): quanto falta e se já foi finalizado.
 * Por quê: a tela recebe o tempo restante quando a página é montada, mas o navegador pode mostrar
 * a página guardada ("Voltar", cache do Next) minutos depois — com um tempo restante velho.
 * A tela pergunta aqui ao abrir e ao voltar para a aba. Dono só (de outra pessoa = null).
 */
export async function getMockExamClock(input: {
  userId: string;
  mockExamId: string;
  now?: Date;
}): Promise<{ remainingMs: number | null; finished: boolean } | null> {
  const now = input.now ?? new Date();
  const mockExam = await prisma.mockExam.findUnique({
    where: { id: input.mockExamId },
    select: { userId: true, startedAt: true, timeLimitMinutes: true, finishedAt: true },
  });
  if (!mockExam || mockExam.userId !== input.userId) return null;
  const deadline = mockExamDeadline(mockExam.startedAt, mockExam.timeLimitMinutes);
  return {
    remainingMs: deadline ? Math.max(0, deadline.getTime() - now.getTime()) : null,
    finished: mockExam.finishedAt !== null,
  };
}

/**
 * Salva (ou apaga, com `answer = null`) a resposta de uma questão do simulado.
 * Recusa: simulado de outra pessoa, já finalizado, sem acesso completo (ex.: reembolso depois de
 * começar o simulado), tempo esgotado (com tolerância) ou letra inválida para a questão.
 */
export async function saveMockExamAnswer(input: {
  viewer: QuestionViewer;
  mockExamId: string;
  questionId: string;
  answer: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await withAdvisoryLock(prisma, `mock-exam:${input.mockExamId}`, async (tx) => {
    const mockExam = await tx.mockExam.findUnique({
      where: { id: input.mockExamId },
      select: { userId: true, finishedAt: true, startedAt: true, timeLimitMinutes: true },
    });
    if (!mockExam || mockExam.userId !== input.viewer.id) throw new UserFacingError("Simulado não encontrado.");
    if (mockExam.finishedAt) throw new UserFacingError("Este simulado já foi finalizado.");
    await ensureMockExamAccess(tx, input.viewer, now);
    if (isPastDeadline({ ...mockExam, now, graceSeconds: DEADLINE_GRACE_SECONDS })) {
      throw new UserFacingError("O tempo do simulado acabou. Finalize para ver o resultado.");
    }
    const item = await tx.mockExamQuestion.findUnique({
      where: { mockExamId_questionId: { mockExamId: input.mockExamId, questionId: input.questionId } },
      select: { id: true, question: { select: { type: true, options: { select: { label: true } } } } },
    });
    if (!item) throw new UserFacingError("Questão não faz parte deste simulado.");
    if (
      input.answer !== null &&
      !isValidAnswer(item.question.type, input.answer, item.question.options.map((option) => option.label))
    ) {
      throw new UserFacingError("Resposta inválida para esta questão.");
    }
    await tx.mockExamQuestion.update({
      where: { id: item.id },
      data: { answer: input.answer, answeredAt: input.answer === null ? null : now },
    });
  });
}

/**
 * Finaliza (corrige) o simulado. Chamar de novo não muda nada (devolve o que já estava).
 * Passos (com a trava do simulado):
 *  1. Confere o dono; se já finalizado, termina aqui.
 *  2. Confere o acesso completo: finalizar ENTREGA o gabarito e os comentários — quem perdeu o
 *     acesso (reembolso, fim da assinatura) não finaliza os simulados que deixou abertos.
 *  3. Corrige as questões (duas gravações: as certas e as outras), grava a nota e a hora do fim.
 *  4. Cada questão RESPONDIDA vira uma tentativa (desempenho do aluno); em branco não.
 */
export async function finishMockExam(input: { viewer: QuestionViewer; mockExamId: string; now?: Date }): Promise<{ correctCount: number }> {
  const now = input.now ?? new Date();
  return withAdvisoryLock(prisma, `mock-exam:${input.mockExamId}`, async (tx) => {
    const mockExam = await tx.mockExam.findUnique({
      where: { id: input.mockExamId },
      select: {
        userId: true,
        finishedAt: true,
        correctCount: true,
        items: { select: { id: true, questionId: true, answer: true, answeredAt: true, question: { select: { correctAnswer: true } } } },
      },
    });
    if (!mockExam || mockExam.userId !== input.viewer.id) throw new UserFacingError("Simulado não encontrado.");
    if (mockExam.finishedAt) return { correctCount: mockExam.correctCount ?? 0 };
    await ensureMockExamAccess(tx, input.viewer, now);

    const score = scoreMockExam(mockExam.items.map((item) => ({ answer: item.answer, correctAnswer: item.question.correctAnswer })));
    const correctIds = mockExam.items
      .filter((item) => item.answer !== null && item.answer === item.question.correctAnswer)
      .map((item) => item.id);
    await tx.mockExamQuestion.updateMany({ where: { mockExamId: input.mockExamId, id: { in: correctIds } }, data: { isCorrect: true } });
    await tx.mockExamQuestion.updateMany({ where: { mockExamId: input.mockExamId, id: { notIn: correctIds } }, data: { isCorrect: false } });
    const answered = mockExam.items.filter((item) => item.answer !== null);
    if (answered.length > 0) {
      await tx.questionAttempt.createMany({
        data: answered.map((item) => ({
          userId: input.viewer.id,
          questionId: item.questionId,
          answer: item.answer as string,
          isCorrect: item.answer === item.question.correctAnswer,
          source: "MOCK_EXAM" as const,
          mockExamId: input.mockExamId,
          answeredAt: item.answeredAt ?? now,
        })),
      });
    }
    await tx.mockExam.update({ where: { id: input.mockExamId }, data: { finishedAt: now, correctCount: score.correct } });
    return { correctCount: score.correct };
  });
}

// Quantos simulados FINALIZADOS a lista mostra (os em andamento aparecem sempre).
const FINISHED_MOCK_EXAMS_LISTED = 50;

const mockExamListSelect = {
  id: true,
  title: true,
  questionCount: true,
  timeLimitMinutes: true,
  startedAt: true,
  finishedAt: true,
  correctCount: true,
  _count: { select: { items: { where: { answer: { not: null } } } } },
} as const satisfies Prisma.MockExamSelect;

/**
 * Os simulados do aluno: primeiro TODOS os em andamento (no máximo MAX_OPEN_MOCK_EXAMS), depois os
 * finalizados mais recentes, com quantas questões ele respondeu em cada um.
 * Por que duas consultas: um simulado aberto antigo não pode sumir da lista — ele ocupa uma das
 * vagas de "em andamento" e o aluno precisa achá-lo para finalizar.
 */
export async function listMyMockExams(userId: string) {
  const [open, finished] = await Promise.all([
    prisma.mockExam.findMany({ where: { userId, finishedAt: null }, orderBy: { startedAt: "desc" }, select: mockExamListSelect }),
    prisma.mockExam.findMany({
      where: { userId, finishedAt: { not: null } },
      orderBy: { startedAt: "desc" },
      take: FINISHED_MOCK_EXAMS_LISTED,
      select: mockExamListSelect,
    }),
  ]);
  return [...open, ...finished].map(({ _count, ...mockExam }) => ({ ...mockExam, answeredCount: _count.items }));
}

/** Opções do formulário de novo simulado: bancas e assuntos com questões publicadas (e quantas). */
export async function getMockExamFormOptions() {
  const [boards, subjects] = await Promise.all([
    prisma.board.findMany({
      where: { questions: { some: { isPublished: true } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { questions: { where: { isPublished: true } } } } },
    }),
    prisma.subject.findMany({
      where: { questions: { some: { isPublished: true } } },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { questions: { where: { isPublished: true } } } } },
    }),
  ]);
  return {
    boards: boards.map((board) => ({ id: board.id, name: board.name, count: board._count.questions })),
    subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name, count: subject._count.questions })),
  };
}
