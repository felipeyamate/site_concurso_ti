/**
 * questions.server.ts — "Resolver questões": acesso do aluno, lista com filtros e a resposta.
 *
 * Quem chama: a página /questoes e a ação de responder (`actions.ts`). Os testes de integração
 * chamam direto.
 *
 * REGRA DE SEGURANÇA: o gabarito (`correctAnswer`) e o comentário (`explanation`) NUNCA vão para
 * a página antes de o aluno responder. A lista busca só enunciado e alternativas; a resposta
 * certa sai daqui apenas em `answerQuestion`, depois de gravar a tentativa.
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { withAdvisoryLock } from "@/lib/db-locks";
import { UserFacingError } from "@/lib/form-state";
import { hasMinimumRole } from "@/modules/auth/roles";
import { hasAnyActiveEnrollment } from "@/modules/enrollment/enrollment.server";

import {
  FREE_DAILY_ANSWERS,
  checkAnswerPermission,
  getQuestionBankLevel,
  remainingFreeAnswers,
  startOfTodayInSaoPaulo,
  type QuestionBankLevel,
} from "./access";
import { answerLabel, isCorrectAnswer, isValidAnswer } from "./answers";
import type { PracticeFilters } from "./schemas";

export const PRACTICE_PAGE_SIZE = 10;
// Com pelo menos esta quantidade de respostas, mostramos "X% dos alunos acertaram".
const MIN_ATTEMPTS_FOR_COMMUNITY_STATS = 10;

export type QuestionViewer = { id: string; role: unknown };

type Db = Pick<Prisma.TransactionClient, "enrollment" | "questionAttempt">;

/** Quantas respostas a pessoa deu hoje (dia de Brasília) — a cota grátis conta todas. */
async function countAnsweredToday(db: Db, userId: string, now: Date): Promise<number> {
  return db.questionAttempt.count({ where: { userId, answeredAt: { gte: startOfTodayInSaoPaulo(now) } } });
}

/** Nível de acesso ao banco de questões (ver `access.ts`). */
export async function getQuestionBankLevelFor(viewer: QuestionViewer, now: Date = new Date(), db: Db = prisma): Promise<QuestionBankLevel> {
  if (hasMinimumRole(viewer.role, "TEACHER")) return "FULL";
  return getQuestionBankLevel({ role: viewer.role, hasActiveEnrollment: await hasAnyActiveEnrollment(viewer.id, now, db) });
}

/** O que a página mostra no topo: nível e quantas grátis restam hoje. */
export async function getQuestionBankStatus(viewer: QuestionViewer, now: Date = new Date()) {
  const level = await getQuestionBankLevelFor(viewer, now);
  const answeredToday = level === "FREE" ? await countAnsweredToday(prisma, viewer.id, now) : 0;
  return { level, remainingFree: remainingFreeAnswers(level, answeredToday), dailyFreeLimit: FREE_DAILY_ANSWERS };
}

/** Bancas, assuntos e provas para os filtros (só os que têm questão publicada). */
export async function listFilterOptions() {
  const published = { questions: { some: { isPublished: true } } };
  const [boards, subjects, exams] = await Promise.all([
    prisma.board.findMany({ where: published, orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.subject.findMany({
      where: published,
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.exam.findMany({
      where: published,
      orderBy: [{ year: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, year: true, board: { select: { name: true } } },
    }),
  ]);
  return { boards, subjects, exams };
}

// O que a lista mostra de cada questão — sem gabarito e sem comentário.
const practiceQuestionSelect = {
  id: true,
  type: true,
  statement: true,
  options: { orderBy: { label: "asc" }, select: { label: true, text: true } },
  subject: { select: { name: true, slug: true } },
  board: { select: { name: true } },
  exam: { select: { name: true, year: true } },
} as const satisfies Prisma.QuestionSelect;

/**
 * Questões publicadas com os filtros, paginadas (mais novas primeiro).
 * Para cada uma, diz se o aluno já respondeu e se acertou alguma vez (o selo "já respondida").
 * Filtro "que errei" = errou alguma vez e ainda não acertou.
 */
export async function listPracticeQuestions(input: { userId: string; filters: PracticeFilters }) {
  const { filters, userId } = input;
  const where: Prisma.QuestionWhereInput = {
    isPublished: true,
    ...(filters.subject ? { subject: { slug: filters.subject } } : {}),
    ...(filters.board ? { board: { slug: filters.board } } : {}),
    ...(filters.exam ? { exam: { slug: filters.exam } } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status === "nao-respondidas" ? { attempts: { none: { userId } } } : {}),
    ...(filters.status === "erradas"
      ? { AND: [{ attempts: { some: { userId, isCorrect: false } } }, { attempts: { none: { userId, isCorrect: true } } }] }
      : {}),
  };
  const total = await prisma.question.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PRACTICE_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);
  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PRACTICE_PAGE_SIZE,
    take: PRACTICE_PAGE_SIZE,
    select: practiceQuestionSelect,
  });

  // Histórico do aluno só destas questões (uma consulta para a página toda).
  const history = await prisma.questionAttempt.groupBy({
    by: ["questionId", "isCorrect"],
    where: { userId, questionId: { in: questions.map((question) => question.id) } },
    _count: { _all: true },
  });
  const status = new Map<string, "CORRECT" | "WRONG">();
  for (const row of history) {
    if (row.isCorrect) status.set(row.questionId, "CORRECT");
    else if (!status.has(row.questionId)) status.set(row.questionId, "WRONG");
  }
  return {
    total,
    page,
    pageCount,
    questions: questions.map((question) => ({ ...question, history: status.get(question.id) ?? null })),
  };
}

export type AnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  correctLabel: string;
  explanation: string;
  remainingFree: number | null;
  communityPercent: number | null;
};

/**
 * Responde uma questão ("Resolver questões").
 *
 * Passos (com a trava do aluno — a cota grátis é "confere e grava": sem a trava, várias
 * respostas ao mesmo tempo passariam do limite):
 *  1. Trava a questão para leitura (`FOR SHARE`) e confere se existe e está publicada (professor/
 *     admin também respondem rascunhos, para testar). A trava espera um professor que esteja
 *     trocando o gabarito agora (`FOR UPDATE` no painel) e faz o painel esperar esta resposta —
 *     assim a correção nunca usa um gabarito que está sendo trocado. Vários alunos ao mesmo
 *     tempo não se bloqueiam (`FOR SHARE` só barra quem vai ALTERAR a linha).
 *  2. Nível de acesso e cota do dia (`checkAnswerPermission`).
 *  3. A resposta é uma letra válida para a questão.
 *  4. Grava a tentativa e devolve o gabarito + comentário (só agora eles saem do servidor).
 */
export async function answerQuestion(input: {
  viewer: QuestionViewer;
  questionId: string;
  answer: string;
  now?: Date;
}): Promise<AnswerResult> {
  const now = input.now ?? new Date();
  const isStaff = hasMinimumRole(input.viewer.role, "TEACHER");
  const result = await withAdvisoryLock(prisma, `questions:${input.viewer.id}`, async (tx) => {
    await tx.$executeRaw`SELECT id FROM questions WHERE id = ${input.questionId} FOR SHARE`;
    const question = await tx.question.findUnique({
      where: { id: input.questionId },
      select: { id: true, type: true, isPublished: true, correctAnswer: true, explanation: true, options: { select: { label: true } } },
    });
    if (!question || (!question.isPublished && !isStaff)) throw new UserFacingError("Questão não encontrada.");

    const level = await getQuestionBankLevelFor(input.viewer, now, tx);
    const answeredToday = level === "FREE" ? await countAnsweredToday(tx, input.viewer.id, now) : 0;
    const permission = checkAnswerPermission(level, answeredToday);
    if (!permission.allowed) {
      throw new UserFacingError(
        `Você já usou as ${FREE_DAILY_ANSWERS} questões grátis de hoje. Com um curso ou a assinatura, resolva sem limite — ou volte amanhã.`,
      );
    }
    if (!isValidAnswer(question.type, input.answer, question.options.map((option) => option.label))) {
      throw new UserFacingError("Resposta inválida para esta questão.");
    }

    const isCorrect = isCorrectAnswer(question.correctAnswer, input.answer);
    await tx.questionAttempt.create({
      data: { userId: input.viewer.id, questionId: question.id, answer: input.answer, isCorrect, source: "PRACTICE", answeredAt: now },
    });
    return { question, isCorrect, remainingFree: permission.remainingFree };
  });

  // "X% dos alunos acertaram" (fora da trava: é só uma estatística).
  const [total, correct] = await Promise.all([
    prisma.questionAttempt.count({ where: { questionId: result.question.id } }),
    prisma.questionAttempt.count({ where: { questionId: result.question.id, isCorrect: true } }),
  ]);
  return {
    isCorrect: result.isCorrect,
    correctAnswer: result.question.correctAnswer,
    correctLabel: answerLabel(result.question.type, result.question.correctAnswer),
    explanation: result.question.explanation,
    remainingFree: result.remainingFree,
    communityPercent: total >= MIN_ATTEMPTS_FOR_COMMUNITY_STATS ? Math.round((correct / total) * 100) : null,
  };
}
