/**
 * questions.test.ts — Testes de integração da Fase 5 (banco de questões), com PostgreSQL de verdade.
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 *
 * O que está coberto: responder (gabarito só depois, cota grátis diária, acesso completo com
 * matrícula, respostas simultâneas), filtros e situação "não respondidas"/"que errei", simulados
 * (sorteio, acesso, limite de abertos, prazo, dono, correção), desempenho, o mapa "o que mais cai",
 * o painel (histórico de aluno protegido, apagar, prova que troca de banca) e a importação por CSV.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { grantEnrollment, revokeEnrollment } from "@/modules/enrollment/grant";
import { FREE_DAILY_ANSWERS } from "@/modules/questions/access";
import {
  deleteBoard,
  deleteQuestion,
  deleteSubject,
  getQuestionBankOverview,
  getQuestionForAdmin,
  importQuestionsFromCsv,
  saveExam,
  saveQuestion,
} from "@/modules/questions/admin/questions-admin.server";
import { IMPORT_TEMPLATE_CSV } from "@/modules/questions/import-questions";
import { getIncidenceMap } from "@/modules/questions/incidence.server";
import {
  createMockExam,
  finishMockExam,
  getMockExamClock,
  getMockExamForOwner,
  listMyMockExams,
  saveMockExamAnswer,
} from "@/modules/questions/mock-exams.server";
import { getMyPerformance } from "@/modules/questions/performance.server";
import { answerQuestion, getQuestionBankStatus, listPracticeQuestions } from "@/modules/questions/questions.server";
import { parsePracticeFilters, questionSchema } from "@/modules/questions/schemas";
import { seedQuestionBank } from "../../prisma/seed-questions";

const T0 = new Date("2026-09-30T15:00:00.000Z"); // 12:00 em Brasília
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

async function resetQuestionBank() {
  await prisma.questionAttempt.deleteMany();
  await prisma.mockExam.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.board.deleteMany();
}

async function resetAll() {
  await resetQuestionBank();
  await prisma.user.deleteMany({ where: { id: { startsWith: "q-" } } });
  await prisma.course.deleteMany({ where: { slug: "teste-questoes" } });
}

async function createUser(id: string, role: "STUDENT" | "TEACHER" = "STUDENT") {
  await prisma.user.create({ data: { id, name: id, email: `${id}@exemplo.com`, role } });
  return { id, role };
}

/** Aluno com matrícula ativa (acesso completo). */
async function createEnrolledStudent(id: string) {
  const viewer = await createUser(id);
  const course = await prisma.course.upsert({
    where: { slug: "teste-questoes" },
    create: { slug: "teste-questoes", title: "Curso", description: "", isPublished: true },
    update: {},
  });
  await grantEnrollment(prisma, { userId: id, courseId: course.id, days: 30, now: at(-24) });
  return viewer;
}

type Setup = Awaited<ReturnType<typeof setupBank>>;

async function setupBank() {
  const cesgranrio = await prisma.board.create({ data: { slug: "cesgranrio", name: "Cesgranrio" } });
  const cebraspe = await prisma.board.create({ data: { slug: "cebraspe", name: "Cebraspe" } });
  const security = await prisma.subject.create({ data: { slug: "seguranca", name: "Segurança" } });
  const networks = await prisma.subject.create({ data: { slug: "redes", name: "Redes" } });
  const exam = await prisma.exam.create({ data: { slug: "bb-2024", name: "Banco", year: 2024, boardId: cesgranrio.id } });

  const mc = (code: string, subjectId: string, answer: string, extra: Record<string, unknown> = {}) =>
    prisma.question.create({
      data: {
        code,
        type: "MULTIPLE_CHOICE",
        statement: `Enunciado ${code}`,
        correctAnswer: answer,
        explanation: `SEGREDO-COMENTARIO-${code}`,
        subjectId,
        isPublished: true,
        options: { create: ["A", "B", "C", "D"].map((label) => ({ label, text: `Alternativa ${label}` })) },
        ...extra,
      },
    });
  const q1 = await mc("Q1", security.id, "B", { examId: exam.id, boardId: cesgranrio.id });
  const q2 = await mc("Q2", security.id, "C", { examId: exam.id, boardId: cesgranrio.id });
  const q3 = await mc("Q3", networks.id, "A", { examId: exam.id, boardId: cesgranrio.id });
  const tf = await prisma.question.create({
    data: {
      code: "TF1",
      type: "TRUE_FALSE",
      statement: "Afirmação",
      correctAnswer: "E",
      explanation: "SEGREDO-COMENTARIO-TF1",
      subjectId: networks.id,
      boardId: cebraspe.id,
      isPublished: true,
    },
  });
  const draft = await mc("DRAFT", security.id, "A", { isPublished: false });
  return { cesgranrio, cebraspe, security, networks, exam, q1, q2, q3, tf, draft };
}

let bank: Setup;

beforeEach(async () => {
  await resetAll();
  bank = await setupBank();
});

afterAll(async () => {
  await resetAll();
});

describe("responder questões", () => {
  it("o gabarito e o comentário só saem na resposta; a lista nunca os traz", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const list = await listPracticeQuestions({ userId: student.id, filters: parsePracticeFilters({}) });
    const serialized = JSON.stringify(list);
    expect(serialized).not.toContain("SEGREDO-COMENTARIO");
    expect(serialized).not.toContain("correctAnswer");
    // Rascunho não aparece para o aluno.
    expect(list.questions.map((question) => question.id)).not.toContain(bank.draft.id);

    const wrong = await answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "A", now: T0 });
    expect(wrong).toMatchObject({ isCorrect: false, correctAnswer: "B", correctLabel: "B", explanation: "SEGREDO-COMENTARIO-Q1" });
    const right = await answerQuestion({ viewer: student, questionId: bank.tf.id, answer: "E", now: T0 });
    expect(right).toMatchObject({ isCorrect: true, correctLabel: "Errado", remainingFree: null });
    expect(await prisma.questionAttempt.count({ where: { userId: student.id, source: "PRACTICE" } })).toBe(2);
  });

  it("recusa resposta inválida, questão em rascunho (aluno) e aceita rascunho para o professor", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const teacher = await createUser("q-prof", "TEACHER");
    await expect(answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "E", now: T0 })).rejects.toThrow(/inválida/);
    await expect(answerQuestion({ viewer: student, questionId: bank.tf.id, answer: "A", now: T0 })).rejects.toThrow(/inválida/);
    await expect(answerQuestion({ viewer: student, questionId: bank.draft.id, answer: "A", now: T0 })).rejects.toThrow(/não encontrada/);
    await expect(answerQuestion({ viewer: teacher, questionId: bank.draft.id, answer: "A", now: T0 })).resolves.toMatchObject({
      isCorrect: true,
    });
  });

  it(`conta gratuita: ${FREE_DAILY_ANSWERS} por dia (dia de Brasília); com matrícula, sem limite`, async () => {
    const free = await createUser("q-gratis");
    for (let index = 0; index < FREE_DAILY_ANSWERS; index += 1) {
      await answerQuestion({ viewer: free, questionId: bank.q1.id, answer: "B", now: T0 });
    }
    expect(await getQuestionBankStatus(free, T0)).toMatchObject({ level: "FREE", remainingFree: 0 });
    await expect(answerQuestion({ viewer: free, questionId: bank.q2.id, answer: "C", now: T0 })).rejects.toThrow(/grátis de hoje/);
    // 22:00 em Brasília (01:00 UTC do dia seguinte) ainda é o mesmo dia; 00:30 de Brasília já é outro.
    await expect(answerQuestion({ viewer: free, questionId: bank.q2.id, answer: "C", now: at(10) })).rejects.toThrow(/grátis/);
    await expect(answerQuestion({ viewer: free, questionId: bank.q2.id, answer: "C", now: at(12.5) })).resolves.toMatchObject({
      remainingFree: FREE_DAILY_ANSWERS - 1,
    });

    const enrolled = await createEnrolledStudent("q-aluno");
    for (let index = 0; index < FREE_DAILY_ANSWERS + 3; index += 1) {
      await answerQuestion({ viewer: enrolled, questionId: bank.q1.id, answer: "B", now: T0 });
    }
    expect(await getQuestionBankStatus(enrolled, T0)).toMatchObject({ level: "FULL", remainingFree: null });
  });

  it("respostas AO MESMO TEMPO na conta gratuita não passam do limite (trava por aluno)", async () => {
    const free = await createUser("q-gratis");
    const results = await Promise.allSettled(
      Array.from({ length: FREE_DAILY_ANSWERS + 5 }, () => answerQuestion({ viewer: free, questionId: bank.q1.id, answer: "B", now: T0 })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(FREE_DAILY_ANSWERS);
    expect(await prisma.questionAttempt.count({ where: { userId: free.id } })).toBe(FREE_DAILY_ANSWERS);
  });

  it("filtros e situação: não respondidas / que errei (e ainda não acertei)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const ids = async (params: Record<string, string>) =>
      (await listPracticeQuestions({ userId: student.id, filters: parsePracticeFilters(params) })).questions.map((question) => question.id).sort();

    expect(await ids({ assunto: "redes" })).toEqual([bank.q3.id, bank.tf.id].sort());
    expect(await ids({ banca: "cebraspe" })).toEqual([bank.tf.id]);
    expect(await ids({ prova: "bb-2024", tipo: "multipla-escolha" })).toEqual([bank.q1.id, bank.q2.id, bank.q3.id].sort());

    await answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "A", now: T0 }); // errou
    await answerQuestion({ viewer: student, questionId: bank.q2.id, answer: "A", now: T0 }); // errou
    await answerQuestion({ viewer: student, questionId: bank.q2.id, answer: "C", now: T0 }); // depois acertou
    expect(await ids({ situacao: "erradas" })).toEqual([bank.q1.id]);
    expect(await ids({ situacao: "nao-respondidas" })).toEqual([bank.q3.id, bank.tf.id].sort());

    const list = await listPracticeQuestions({ userId: student.id, filters: parsePracticeFilters({ assunto: "seguranca" }) });
    expect(Object.fromEntries(list.questions.map((question) => [question.id, question.history]))).toEqual({
      [bank.q1.id]: "WRONG",
      [bank.q2.id]: "CORRECT",
    });
  });

  it("questão de um simulado DELE em andamento: some da lista e não responde (o gabarito sairia antes da hora)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const other = await createEnrolledStudent("q-outro");
    const { mockExamId } = await createMockExam({
      viewer: student,
      boardId: bank.cesgranrio.id,
      subjectIds: [bank.security.id],
      count: 10,
      timeLimitMinutes: null,
      now: T0,
    }); // Q1 e Q2
    const ids = async (userId: string) =>
      (await listPracticeQuestions({ userId, filters: parsePracticeFilters({ assunto: "seguranca" }) })).questions.map((question) => question.id);
    expect(await ids(student.id)).toEqual([]);
    await expect(answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "B", now: T0 })).rejects.toThrow(/simulado seu em andamento/);
    // Outro aluno não é afetado; depois de finalizar, a questão volta.
    expect((await ids(other.id)).sort()).toEqual([bank.q1.id, bank.q2.id].sort());
    await finishMockExam({ viewer: student, mockExamId, now: at(1) });
    expect((await ids(student.id)).sort()).toEqual([bank.q1.id, bank.q2.id].sort());
    await expect(answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "B", now: at(1) })).resolves.toMatchObject({ isCorrect: true });
  });

  it("a cota grátis conta só 'Resolver questões': respostas de simulado (de quando tinha acesso) não gastam a cota", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const { mockExamId } = await createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 });
    for (const questionId of [bank.q1.id, bank.q2.id, bank.q3.id, bank.tf.id]) {
      await saveMockExamAnswer({ viewer: student, mockExamId, questionId, answer: questionId === bank.tf.id ? "C" : "A", now: T0 });
    }
    await finishMockExam({ viewer: student, mockExamId, now: T0 });
    const course = await prisma.course.findUniqueOrThrow({ where: { slug: "teste-questoes" } });
    await revokeEnrollment(prisma, { userId: student.id, courseId: course.id, now: at(1) });
    expect(await getQuestionBankStatus(student, at(2))).toMatchObject({ level: "FREE", remainingFree: FREE_DAILY_ANSWERS });
  });

  it("'% dos alunos acertam': a PRIMEIRA resposta de cada aluno; repetições e professor não contam", async () => {
    const teacher = await createUser("q-prof", "TEACHER");
    // Um aluno repetindo 12 vezes e o professor testando: ainda é 1 aluno → sem porcentagem.
    const repeater = await createEnrolledStudent("q-aluno-00");
    for (let index = 0; index < 12; index += 1) {
      await answerQuestion({ viewer: repeater, questionId: bank.q3.id, answer: index < 11 ? "B" : "A", now: T0 });
    }
    for (let index = 0; index < 5; index += 1) {
      await answerQuestion({ viewer: teacher, questionId: bank.q3.id, answer: "A", now: T0 });
    }
    expect(await answerQuestion({ viewer: teacher, questionId: bank.q3.id, answer: "A", now: T0 })).toMatchObject({ communityPercent: null });
    // Mais 9 alunos (10 no total): 3 acertam de primeira (o repetidor errou de primeira).
    for (let index = 1; index <= 9; index += 1) {
      const student = await createUser(`q-aluno-${String(index).padStart(2, "0")}`);
      await answerQuestion({ viewer: student, questionId: bank.q3.id, answer: index <= 3 ? "A" : "B", now: T0 });
    }
    expect(await answerQuestion({ viewer: teacher, questionId: bank.q3.id, answer: "A", now: T0 })).toMatchObject({ communityPercent: 30 });
  });
});

describe("simulados", () => {
  it("conta gratuita não cria; com matrícula, sorteia só dos filtros e primeiro as não respondidas", async () => {
    const free = await createUser("q-gratis");
    await expect(
      createMockExam({ viewer: free, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 }),
    ).rejects.toThrow(/Simulados são para/);

    const student = await createEnrolledStudent("q-aluno");
    await answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "B", now: T0 });
    const { mockExamId } = await createMockExam({
      viewer: student,
      boardId: bank.cesgranrio.id,
      subjectIds: [bank.security.id],
      count: 10,
      timeLimitMinutes: null,
      now: T0,
    });
    const mockExam = await prisma.mockExam.findUniqueOrThrow({ where: { id: mockExamId }, include: { items: { orderBy: { position: "asc" } } } });
    // Só Q1 e Q2 são Cesgranrio + Segurança (o rascunho não entra); Q2 (não respondida) vem primeiro.
    expect(mockExam.items.map((item) => item.questionId)).toEqual([bank.q2.id, bank.q1.id]);
    expect(mockExam).toMatchObject({ questionCount: 2, title: "Cesgranrio · Segurança · 2 questões" });
  });

  it("antes de finalizar não há gabarito; outro aluno não vê; finalizar corrige e vira desempenho", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const other = await createEnrolledStudent("q-outro");
    const { mockExamId } = await createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 });

    const before = await getMockExamForOwner({ userId: student.id, mockExamId, now: T0 });
    expect(JSON.stringify(before)).not.toContain("SEGREDO-COMENTARIO");
    expect(before?.items.every((item) => item.result === null)).toBe(true);
    expect(await getMockExamForOwner({ userId: other.id, mockExamId, now: T0 })).toBeNull();
    await expect(saveMockExamAnswer({ viewer: other, mockExamId, questionId: bank.q1.id, answer: "B", now: T0 })).rejects.toThrow(
      /não encontrado/,
    );

    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q1.id, answer: "B", now: T0 }); // certo
    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q2.id, answer: "A", now: T0 }); // errado
    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.tf.id, answer: "C", now: T0 });
    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.tf.id, answer: null, now: T0 }); // apagou
    await expect(saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.tf.id, answer: "A", now: T0 })).rejects.toThrow(
      /inválida/,
    );

    expect(await finishMockExam({ viewer: student, mockExamId, now: at(1) })).toEqual({ correctCount: 1 });
    // Finalizar de novo não muda nada nem duplica tentativas.
    expect(await finishMockExam({ viewer: student, mockExamId, now: at(2) })).toEqual({ correctCount: 1 });
    const attempts = await prisma.questionAttempt.findMany({ where: { mockExamId } });
    expect(attempts).toHaveLength(2); // só as respondidas
    expect(attempts.every((attempt) => attempt.source === "MOCK_EXAM")).toBe(true);

    const after = await getMockExamForOwner({ userId: student.id, mockExamId, now: at(2) });
    const q1Item = after?.items.find((item) => item.question.id === bank.q1.id);
    expect(q1Item?.result).toEqual({ isCorrect: true, correctAnswer: "B", explanation: "SEGREDO-COMENTARIO-Q1" });
    await expect(saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q3.id, answer: "A", now: at(2) })).rejects.toThrow(
      /já foi finalizado/,
    );

    const performance = await getMyPerformance(student.id, at(2));
    expect(performance.totals).toEqual({ attempts: 2, correct: 1, percent: 50 });
  });

  it("tempo esgotado: salva até a tolerância; depois recusa (e ainda dá para finalizar)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const { mockExamId } = await createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: 30, now: T0 });
    const justAfter = new Date(T0.getTime() + 30 * 60 * 1000 + 10 * 1000);
    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q1.id, answer: "B", now: justAfter });
    const late = new Date(T0.getTime() + 32 * 60 * 1000);
    await expect(saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q2.id, answer: "C", now: late })).rejects.toThrow(
      /tempo do simulado acabou/,
    );
    expect(await getMockExamForOwner({ userId: student.id, mockExamId, now: late })).toMatchObject({ timeIsUp: true });
    expect(await finishMockExam({ viewer: student, mockExamId, now: late })).toEqual({ correctCount: 1 });
  });

  it("quem perde o acesso (ex.: reembolso) não salva nem finaliza o simulado aberto (finalizar entregaria o gabarito)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const { mockExamId } = await createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 });
    await saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q1.id, answer: "B", now: T0 });
    const course = await prisma.course.findUniqueOrThrow({ where: { slug: "teste-questoes" } });
    await revokeEnrollment(prisma, { userId: student.id, courseId: course.id, now: at(1) });

    await expect(saveMockExamAnswer({ viewer: student, mockExamId, questionId: bank.q2.id, answer: "A", now: at(2) })).rejects.toThrow(
      /Simulados são para/,
    );
    await expect(finishMockExam({ viewer: student, mockExamId, now: at(2) })).rejects.toThrow(/Simulados são para/);
    const view = await getMockExamForOwner({ userId: student.id, mockExamId, now: at(2) });
    expect(view).toMatchObject({ finishedAt: null });
    expect(JSON.stringify(view)).not.toContain("SEGREDO-COMENTARIO");
  });

  it("relógio fresco (tempo restante medido agora) e a lista sempre mostra os em andamento", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const { mockExamId } = await createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: 30, now: T0 });
    expect(await getMockExamClock({ userId: student.id, mockExamId, now: at(0.25) })).toEqual({ remainingMs: 15 * 60 * 1000, finished: false });
    expect(await getMockExamClock({ userId: "q-outro", mockExamId, now: at(0.25) })).toBeNull();

    // 51 simulados finalizados DEPOIS do aberto: o aberto continua na lista (em primeiro).
    await prisma.mockExam.createMany({
      data: Array.from({ length: 51 }, (_, index) => ({
        userId: student.id,
        title: `Antigo ${index}`,
        questionCount: 10,
        startedAt: at(1 + index),
        finishedAt: at(1 + index),
        correctCount: 0,
      })),
    });
    const list = await listMyMockExams(student.id);
    expect(list[0]).toMatchObject({ id: mockExamId, finishedAt: null });
    expect(list).toHaveLength(51); // o aberto + os 50 finalizados mais recentes
  });

  it("no máximo 3 simulados em andamento", async () => {
    const student = await createEnrolledStudent("q-aluno");
    const create = () => createMockExam({ viewer: student, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 });
    await create();
    await create();
    const { mockExamId } = await create();
    await expect(create()).rejects.toThrow(/em andamento/);
    await finishMockExam({ viewer: student, mockExamId, now: T0 });
    await expect(create()).resolves.toHaveProperty("mockExamId");
  });
});

describe("mapa 'o que mais cai'", () => {
  it("conta só questões publicadas DE PROVA, por banca e assunto", async () => {
    const map = await getIncidenceMap();
    // Q1, Q2 (Segurança) e Q3 (Redes) são da prova da Cesgranrio; TF1 é inédita; DRAFT não publicada.
    expect(map.examCount).toBe(1);
    expect(map.overall.total).toBe(3);
    expect(map.boards.map((board) => [board.name, board.total])).toEqual([["Cesgranrio", 3]]);
    expect(map.boards[0].subjects.map((subject) => [subject.name, subject.count, subject.percent])).toEqual([
      ["Segurança", 2, 66.7],
      ["Redes", 1, 33.3],
    ]);
  });
});

describe("painel de questões", () => {
  const formFor = (overrides: Record<string, string>) =>
    questionSchema.parse({
      code: "",
      type: "MULTIPLE_CHOICE",
      statement: "Nova questão",
      optionA: "x",
      optionB: "y",
      optionC: "",
      optionD: "",
      optionE: "",
      correctAnswer: "A",
      explanation: "Comentário",
      subjectId: bank.security.id,
      examId: "",
      boardId: "",
      isPublished: "on",
      ...overrides,
    });

  it("questão de prova ganha a banca da prova; código repetido é recusado", async () => {
    const { id } = await saveQuestion(formFor({ examId: bank.exam.id, boardId: bank.cebraspe.id, code: "NOVA-1" }));
    expect(await prisma.question.findUniqueOrThrow({ where: { id } })).toMatchObject({ boardId: bank.cesgranrio.id, examId: bank.exam.id });
    await expect(saveQuestion(formFor({ code: "NOVA-1" }))).rejects.toThrow(/código/);
  });

  it("com histórico de aluno: corrige texto, mas não o gabarito; não apaga (sem histórico, apaga)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    await answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "B", now: T0 });
    const base = {
      questionId: bank.q1.id,
      optionA: "Alternativa A",
      optionB: "Alternativa B",
      optionC: "Alternativa C",
      optionD: "Alternativa D",
      examId: bank.exam.id,
    };
    await expect(saveQuestion(formFor({ ...base, correctAnswer: "C" }))).rejects.toThrow(/já foi respondida/);
    await expect(saveQuestion(formFor({ ...base, optionD: "", correctAnswer: "B" }))).rejects.toThrow(/já foi respondida/);
    await saveQuestion(formFor({ ...base, correctAnswer: "B", statement: "Enunciado corrigido" }));
    expect(await prisma.question.findUniqueOrThrow({ where: { id: bank.q1.id } })).toMatchObject({ statement: "Enunciado corrigido" });

    await expect(deleteQuestion(bank.q1.id)).rejects.toThrow(/despublique/);
    await deleteQuestion(bank.q3.id);
    expect(await prisma.question.findUnique({ where: { id: bank.q3.id } })).toBeNull();
  });

  it("professor testando não trava a questão (troca o gabarito e apaga, levando os testes); aluno promovido continua protegido", async () => {
    const teacher = await createUser("q-prof", "TEACHER");
    await answerQuestion({ viewer: teacher, questionId: bank.q2.id, answer: "A", now: T0 });
    const { mockExamId } = await createMockExam({ viewer: teacher, boardId: null, subjectIds: [], count: 10, timeLimitMinutes: null, now: T0 });
    await finishMockExam({ viewer: teacher, mockExamId, now: T0 });
    const q2 = { questionId: bank.q2.id, optionA: "A", optionB: "B", optionC: "C", optionD: "D", examId: bank.exam.id };
    await saveQuestion(formFor({ ...q2, correctAnswer: "D" }));
    expect(await prisma.question.findUniqueOrThrow({ where: { id: bank.q2.id } })).toMatchObject({ correctAnswer: "D" });
    expect(await getQuestionForAdmin(bank.q2.id)).toMatchObject({ hasStudentHistory: false });

    await deleteQuestion(bank.q2.id);
    expect(await prisma.question.findUnique({ where: { id: bank.q2.id } })).toBeNull();
    expect(await prisma.mockExam.findUnique({ where: { id: mockExamId } })).toBeNull();

    // Monitor: era aluno (tem matrícula) e virou professor — as respostas dele contam como de aluno.
    const monitor = await createEnrolledStudent("q-monitor");
    await prisma.user.update({ where: { id: monitor.id }, data: { role: "TEACHER" } });
    await answerQuestion({ viewer: { id: monitor.id, role: "TEACHER" }, questionId: bank.q3.id, answer: "A", now: T0 });
    expect(await getQuestionForAdmin(bank.q3.id)).toMatchObject({ hasStudentHistory: true });
    await expect(deleteQuestion(bank.q3.id)).rejects.toThrow(/despublique/);
  });

  it("resposta no instante em que o professor troca o gabarito: corrige com o gabarito novo (trava da questão)", async () => {
    const student = await createEnrolledStudent("q-aluno");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    // O "professor" no meio do `saveQuestion`: linha travada (FOR UPDATE) e gabarito trocado, ainda sem confirmar.
    const teacherSave = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT id FROM questions WHERE id = ${bank.q2.id} FOR UPDATE`;
        await tx.question.update({ where: { id: bank.q2.id }, data: { correctAnswer: "D" } });
        signalLocked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await locked;
    const answering = answerQuestion({ viewer: student, questionId: bank.q2.id, answer: "D", now: T0 });
    await new Promise((resolve) => setTimeout(resolve, 300)); // a resposta chega e espera a trava
    release();
    await teacherSave;
    expect(await answering).toMatchObject({ isCorrect: true, correctAnswer: "D" });
  });

  it("questão salva no instante em que a prova troca de banca: fica com a banca NOVA (trava da prova)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    // O "outro professor" no meio do `saveExam`: prova e questões já com a banca nova, ainda sem confirmar.
    const examSave = prisma.$transaction(
      async (tx) => {
        await tx.exam.update({ where: { id: bank.exam.id }, data: { boardId: bank.cebraspe.id } });
        await tx.question.updateMany({ where: { examId: bank.exam.id }, data: { boardId: bank.cebraspe.id } });
        signalLocked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await locked;
    const saving = saveQuestion(formFor({ examId: bank.exam.id, code: "NO-MEIO" }));
    await new Promise((resolve) => setTimeout(resolve, 300)); // a gravação chega e espera a trava
    release();
    await examSave;
    const { id } = await saving;
    expect(await prisma.question.findUniqueOrThrow({ where: { id } })).toMatchObject({ boardId: bank.cebraspe.id });
  });

  it("visão geral: 'respostas de alunos' não conta os testes do professor", async () => {
    const teacher = await createUser("q-prof", "TEACHER");
    const student = await createEnrolledStudent("q-aluno");
    await answerQuestion({ viewer: teacher, questionId: bank.q1.id, answer: "B", now: T0 });
    await answerQuestion({ viewer: student, questionId: bank.q1.id, answer: "B", now: T0 });
    expect(await getQuestionBankOverview()).toMatchObject({ attempts: 1 });
  });

  it("banca/assunto com questões não se apagam; prova que troca de banca leva as questões junto", async () => {
    await expect(deleteBoard(bank.cesgranrio.id)).rejects.toThrow(/não pode ser apagada/);
    await expect(deleteSubject(bank.security.id)).rejects.toThrow(/não pode ser apagado/);
    await saveExam({ examId: bank.exam.id, name: "Banco", slug: "bb-2024", year: 2024, boardId: bank.cebraspe.id });
    expect(await prisma.question.findUniqueOrThrow({ where: { id: bank.q1.id } })).toMatchObject({ boardId: bank.cebraspe.id });
  });

  it("importação por CSV: tudo ou nada; entram como rascunho", async () => {
    const header = "codigo;tipo;enunciado;a;b;c;d;e;gabarito;comentario;assunto;banca;prova";
    const bad = await importQuestionsFromCsv([header, "IMP-1;ME;Ok;x;y;;;;A;c;seguranca;;", "IMP-2;ME;Sem assunto;x;y;;;;A;c;nada;;"].join("\n"));
    expect(bad).toMatchObject({ ok: false, errors: [{ line: 3 }] });
    expect(await prisma.question.count({ where: { code: { startsWith: "IMP-" } } })).toBe(0);

    const good = await importQuestionsFromCsv(
      [header, "IMP-1;ME;Ok;x;y;;;;A;c;seguranca;;bb-2024", "IMP-2;CE;Afirmação;;;;;;Certo;c;Redes;cebraspe;"].join("\r\n"),
    );
    expect(good).toEqual({ ok: true, created: 2 });
    const imported = await prisma.question.findMany({ where: { code: { startsWith: "IMP-" } }, orderBy: { code: "asc" }, include: { options: true } });
    expect(imported.map((question) => [question.code, question.isPublished, question.boardId, question.options.length])).toEqual([
      ["IMP-1", false, bank.cesgranrio.id, 2],
      ["IMP-2", false, bank.cebraspe.id, 0],
    ]);
    // Importar de novo: os códigos já existem (mesmo com espaços em volta, a linha certa é apontada).
    expect(await importQuestionsFromCsv([header, '" IMP-1 ";ME;Ok;x;y;;;;A;c;seguranca;;'].join("\n"))).toEqual({
      ok: false,
      errors: [{ line: 2, message: 'Já existe uma questão com o código "IMP-1".' }],
    });
  });
});

describe("seed de exemplo", () => {
  it("cria o banco de exemplo uma vez só (rodar de novo não duplica nem altera)", async () => {
    await resetQuestionBank();
    const first = await seedQuestionBank(prisma);
    expect(first.created).toBe(30);
    expect(await seedQuestionBank(prisma)).toMatchObject({ created: 0 });
    expect(await prisma.question.count()).toBe(30);
    const map = await getIncidenceMap();
    expect(map.examCount).toBe(3);
  });

  it("o modelo de planilha do painel importa sem erro no banco de exemplo", async () => {
    await resetQuestionBank();
    await seedQuestionBank(prisma);
    expect(await importQuestionsFromCsv(IMPORT_TEMPLATE_CSV)).toEqual({ ok: true, created: 2 });
  });
});
