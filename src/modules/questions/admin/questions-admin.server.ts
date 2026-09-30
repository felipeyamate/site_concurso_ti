/**
 * questions-admin.server.ts — O painel do banco de questões (PROFESSOR ou mais): bancas, assuntos,
 * provas, questões e a importação por planilha.
 *
 * Quem chama: as Server Actions de `actions.ts` e as páginas /admin/questoes/... Os testes de
 * integração chamam direto.
 *
 * Regras de histórico (PROJECT.md, "nunca apagar histórico de aluno"):
 *  - Questão já respondida (ou num simulado) NÃO se apaga: despublica.
 *  - Numa questão com histórico, dá para corrigir textos (enunciado, alternativas, comentário),
 *    mas NÃO o tipo, as letras das alternativas nem o gabarito — as respostas antigas foram
 *    corrigidas com eles. Para trocar o gabarito, despublique e cadastre a questão corrigida.
 *  - Banca, assunto ou prova com questões (ou banca com provas) não se apagam.
 * Toda conferência de histórico trava a linha da questão antes (`SELECT ... FOR UPDATE`): uma
 * resposta gravada no mesmo instante espera a nossa transação (ou nós a esperamos e a enxergamos).
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { isUniqueViolation } from "@/lib/db-errors";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";
import { findAvailableSlug } from "@/modules/catalog/admin/slug";

import { CsvError, parseCsv } from "../csv";
import { parseQuestionImport, type ImportError } from "../import-questions";
import type { QuestionFormData } from "../schemas";

type Tx = Prisma.TransactionClient;

export const QUESTIONS_ADMIN_PAGE_SIZE = 30;

const lockQuestion = (tx: Tx, questionId: string) => tx.$executeRaw`SELECT id FROM questions WHERE id = ${questionId} FOR UPDATE`;

/** A questão tem histórico de aluno (resposta ou simulado)? */
async function hasHistory(tx: Tx, questionId: string): Promise<boolean> {
  const [attempts, items] = await Promise.all([
    tx.questionAttempt.count({ where: { questionId } }),
    tx.mockExamQuestion.count({ where: { questionId } }),
  ]);
  return attempts + items > 0;
}

// =============================================================================================
// Classificação: bancas, assuntos, provas
// =============================================================================================

export async function listClassification() {
  const [boards, subjects, exams] = await Promise.all([
    prisma.board.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, _count: { select: { exams: true, questions: true } } },
    }),
    prisma.subject.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, position: true, _count: { select: { questions: true } } },
    }),
    prisma.exam.findMany({
      orderBy: [{ year: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        year: true,
        boardId: true,
        board: { select: { name: true } },
        _count: { select: { questions: true } },
      },
    }),
  ]);
  return { boards, subjects, exams };
}

/** Traduz "nome/identificador repetido" (chave única do banco) numa mensagem para o professor. */
function rethrowDuplicate(error: unknown, what: string): never {
  if (isUniqueViolation(error)) throw new UserFacingError(`Já existe ${what} com esse nome ou identificador.`);
  throw error;
}

export async function saveBoard(input: { boardId?: string | null; name: string; slug: string | null }): Promise<{ id: string }> {
  const slug = input.slug ?? (await findAvailableSlug(input.name, async (value) => Boolean(await prisma.board.findUnique({ where: { slug: value } }))));
  try {
    if (input.boardId) {
      return await prisma.board.update({ where: { id: input.boardId }, data: { name: input.name, slug }, select: { id: true } });
    }
    return await prisma.board.create({ data: { name: input.name, slug }, select: { id: true } });
  } catch (error) {
    rethrowDuplicate(error, "uma banca");
  }
}

export async function deleteBoard(boardId: string): Promise<void> {
  const board = await prisma.board.findUnique({ where: { id: boardId }, select: { _count: { select: { exams: true, questions: true } } } });
  if (!board) throw new UserFacingError("Banca não encontrada.");
  if (board._count.exams + board._count.questions > 0) {
    throw new UserFacingError("Esta banca tem provas ou questões cadastradas: não pode ser apagada.");
  }
  // Se uma questão/prova for ligada a ela no meio, a chave estrangeira (Restrict) impede o apagar.
  await prisma.board.delete({ where: { id: boardId } }).catch(() => {
    throw new UserFacingError("Esta banca passou a ter provas ou questões: não pode ser apagada.");
  });
}

export async function saveSubject(input: {
  subjectId?: string | null;
  name: string;
  slug: string | null;
  position: number;
}): Promise<{ id: string }> {
  const slug =
    input.slug ?? (await findAvailableSlug(input.name, async (value) => Boolean(await prisma.subject.findUnique({ where: { slug: value } }))));
  try {
    const data = { name: input.name, slug, position: input.position };
    if (input.subjectId) return await prisma.subject.update({ where: { id: input.subjectId }, data, select: { id: true } });
    return await prisma.subject.create({ data, select: { id: true } });
  } catch (error) {
    rethrowDuplicate(error, "um assunto");
  }
}

export async function deleteSubject(subjectId: string): Promise<void> {
  const count = await prisma.question.count({ where: { subjectId } });
  if (count > 0) throw new UserFacingError("Este assunto tem questões: não pode ser apagado.");
  await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {
    throw new UserFacingError("Este assunto passou a ter questões (ou não existe mais): não pode ser apagado.");
  });
}

/**
 * Cria/edita uma prova. Se a BANCA da prova mudar, as questões dela passam para a nova banca
 * (a banca de uma questão de prova é sempre a da prova — é isso que o mapa "o que mais cai" conta).
 */
export async function saveExam(input: {
  examId?: string | null;
  name: string;
  slug: string | null;
  year: number;
  boardId: string;
}): Promise<{ id: string }> {
  const board = await prisma.board.findUnique({ where: { id: input.boardId }, select: { id: true } });
  if (!board) throw new UserFacingError("Banca não encontrada.");
  const slug =
    input.slug ??
    (await findAvailableSlug(`${input.name} ${input.year}`, async (value) => Boolean(await prisma.exam.findUnique({ where: { slug: value } }))));
  try {
    return await prisma.$transaction(async (tx) => {
      const data = { name: input.name, slug, year: input.year, boardId: input.boardId };
      if (!input.examId) return tx.exam.create({ data, select: { id: true } });
      const exam = await tx.exam.update({ where: { id: input.examId }, data, select: { id: true } });
      await tx.question.updateMany({ where: { examId: exam.id }, data: { boardId: input.boardId } });
      return exam;
    });
  } catch (error) {
    rethrowDuplicate(error, "uma prova");
  }
}

export async function deleteExam(examId: string): Promise<void> {
  const count = await prisma.question.count({ where: { examId } });
  if (count > 0) throw new UserFacingError("Esta prova tem questões: não pode ser apagada.");
  await prisma.exam.delete({ where: { id: examId } }).catch(() => {
    throw new UserFacingError("Esta prova passou a ter questões (ou não existe mais): não pode ser apagada.");
  });
}

// =============================================================================================
// Questões
// =============================================================================================

export type AdminQuestionFilters = {
  search: string;
  subjectId: string | null;
  boardId: string | null;
  status: "all" | "published" | "draft";
  page: number;
};

export async function listQuestionsForAdmin(filters: AdminQuestionFilters) {
  const where: Prisma.QuestionWhereInput = {
    ...(filters.search
      ? { OR: [{ statement: { contains: filters.search, mode: "insensitive" } }, { code: { contains: filters.search, mode: "insensitive" } }] }
      : {}),
    ...(filters.subjectId ? { subjectId: filters.subjectId } : {}),
    ...(filters.boardId ? { boardId: filters.boardId } : {}),
    ...(filters.status === "published" ? { isPublished: true } : filters.status === "draft" ? { isPublished: false } : {}),
  };
  const total = await prisma.question.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / QUESTIONS_ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const questions = await prisma.question.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * QUESTIONS_ADMIN_PAGE_SIZE,
    take: QUESTIONS_ADMIN_PAGE_SIZE,
    select: {
      id: true,
      code: true,
      type: true,
      statement: true,
      isPublished: true,
      subject: { select: { name: true } },
      board: { select: { name: true } },
      exam: { select: { name: true, year: true } },
      _count: { select: { attempts: true } },
    },
  });
  return { questions, total, page, pageCount };
}

export async function getQuestionForAdmin(questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { label: "asc" } }, _count: { select: { attempts: true, mockExamItems: true } } },
  });
  if (!question) return null;
  const correct = await prisma.questionAttempt.count({ where: { questionId, isCorrect: true } });
  return { ...question, correctAttempts: correct };
}

/** Confere assunto, banca e prova; a banca de uma questão de prova é a da prova. */
async function resolveClassification(tx: Tx, data: QuestionFormData) {
  const subject = await tx.subject.findUnique({ where: { id: data.subjectId }, select: { id: true } });
  if (!subject) throw new UserFacingError("Assunto não encontrado.", { field: "subjectId" });
  if (data.examId) {
    const exam = await tx.exam.findUnique({ where: { id: data.examId }, select: { id: true, boardId: true } });
    if (!exam) throw new UserFacingError("Prova não encontrada.", { field: "examId" });
    return { subjectId: subject.id, examId: exam.id, boardId: exam.boardId };
  }
  if (data.boardId) {
    const board = await tx.board.findUnique({ where: { id: data.boardId }, select: { id: true } });
    if (!board) throw new UserFacingError("Banca não encontrada.", { field: "boardId" });
    return { subjectId: subject.id, examId: null, boardId: board.id };
  }
  return { subjectId: subject.id, examId: null, boardId: null };
}

/**
 * Cria ou edita uma questão.
 * Passos (numa transação):
 *  1. Confere assunto/banca/prova.
 *  2. Edição: trava a questão; com histórico de aluno, recusa mudar tipo, letras ou gabarito.
 *  3. Grava a questão e troca as alternativas (apaga as antigas e cria as do formulário).
 */
export async function saveQuestion(data: QuestionFormData): Promise<{ id: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const classification = await resolveClassification(tx, data);
      const fields = {
        code: data.code,
        type: data.type,
        statement: data.statement,
        correctAnswer: data.correctAnswer,
        explanation: data.explanation,
        isPublished: data.isPublished,
        ...classification,
      };

      if (!data.questionId) {
        return tx.question.create({ data: { ...fields, options: { create: data.options } }, select: { id: true } });
      }

      await lockQuestion(tx, data.questionId);
      const current = await tx.question.findUnique({
        where: { id: data.questionId },
        select: { id: true, type: true, correctAnswer: true, options: { select: { label: true } } },
      });
      if (!current) throw new UserFacingError("Questão não encontrada.");
      if (await hasHistory(tx, current.id)) {
        const sameLabels =
          current.options.map((option) => option.label).sort().join() === data.options.map((option) => option.label).join();
        if (current.type !== data.type || current.correctAnswer !== data.correctAnswer || !sameLabels) {
          throw new UserFacingError(
            "Esta questão já foi respondida por alunos: dá para corrigir os textos, mas não o tipo, as alternativas (letras) nem o gabarito. Despublique-a e cadastre a versão corrigida.",
            { field: "correctAnswer" },
          );
        }
      }
      await tx.questionOption.deleteMany({ where: { questionId: current.id } });
      return tx.question.update({
        where: { id: current.id },
        data: { ...fields, options: { create: data.options } },
        select: { id: true },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new UserFacingError("Já existe uma questão com esse código.", { field: "code" });
    throw error;
  }
}

/** Publica ou despublica (atalho da lista). */
export async function setQuestionPublished(questionId: string, isPublished: boolean): Promise<void> {
  const { count } = await prisma.question.updateMany({ where: { id: questionId }, data: { isPublished } });
  if (count === 0) throw new UserFacingError("Questão não encontrada.");
}

/** Apaga uma questão SEM histórico de aluno (com histórico: despublicar). */
export async function deleteQuestion(questionId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await lockQuestion(tx, questionId);
    const exists = await tx.question.findUnique({ where: { id: questionId }, select: { id: true } });
    if (!exists) throw new UserFacingError("Questão não encontrada.");
    if (await hasHistory(tx, questionId)) {
      throw new UserFacingError("Esta questão já foi respondida por alunos: despublique em vez de apagar (o histórico deles fica).");
    }
    await tx.question.delete({ where: { id: questionId } });
  });
}

// =============================================================================================
// Importação por planilha
// =============================================================================================

export type ImportOutcome = { ok: true; created: number } | { ok: false; errors: ImportError[] };

/**
 * Importa questões de um CSV (tudo ou nada; entram como RASCUNHO).
 * Passos:
 *  1. Lê o CSV (`parseCsv`) e busca bancas, assuntos, provas e os códigos já usados.
 *  2. Confere todas as linhas (`parseQuestionImport`). Algum erro → devolve os erros, nada gravado.
 *  3. Grava todas numa transação (se uma falhar, nenhuma fica).
 */
export async function importQuestionsFromCsv(csvText: string): Promise<ImportOutcome> {
  let parsed: ReturnType<typeof parseCsv>;
  try {
    parsed = parseCsv(csvText);
  } catch (error) {
    if (error instanceof CsvError) return { ok: false, errors: [{ line: error.line, message: error.message }] };
    throw error;
  }

  const codes = parsed.rows.slice(1).flatMap((row) => row.filter(Boolean));
  const [subjects, boards, exams, existing] = await Promise.all([
    prisma.subject.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.board.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.exam.findMany({ select: { id: true, slug: true, boardId: true } }),
    // Só os códigos que podem estar na planilha (qualquer célula) — não a tabela inteira.
    prisma.question.findMany({ where: { code: { in: codes.slice(0, 50_000) } }, select: { code: true } }),
  ]);
  const result = parseQuestionImport({
    rows: parsed.rows,
    lineNumbers: parsed.lineNumbers,
    subjects,
    boards,
    exams,
    existingCodes: new Set(existing.map((row) => row.code as string)),
  });
  if (!result.ok) return result;

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const question of result.questions) {
          await tx.question.create({
            data: {
              code: question.code,
              type: question.type,
              statement: question.statement,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              subjectId: question.subjectId,
              boardId: question.boardId,
              examId: question.examId,
              isPublished: false,
              options: { create: question.options },
            },
          });
        }
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, errors: [{ line: 1, message: "Algum código da planilha acabou de ser usado por outra questão. Importe de novo." }] };
    }
    throw error;
  }
  return { ok: true, created: result.questions.length };
}

/** Números para a visão geral do painel. */
export async function getQuestionBankOverview() {
  const [published, drafts, attempts] = await Promise.all([
    prisma.question.count({ where: { isPublished: true } }),
    prisma.question.count({ where: { isPublished: false } }),
    prisma.questionAttempt.count(),
  ]);
  return { published, drafts, attempts };
}
