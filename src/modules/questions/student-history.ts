/**
 * student-history.ts — Quem conta como ALUNO nas contas do banco de questões.
 *
 * Quem usa: o painel (proteção do histórico da questão e a visão geral) e a estatística
 * "X% dos alunos acertaram" (`questions.server.ts`, em SQL — a mesma regra escrita à mão).
 *
 * Regra (a mesma das aulas, Fase 3): é aluno hoje, OU tem (ou teve) alguma matrícula — um aluno
 * promovido a professor (ex.: monitor) continua contando. Professor/admin só testando não conta.
 */
import type { Prisma } from "@/generated/prisma/client";

export const STUDENT_USER: Prisma.UserWhereInput = { OR: [{ role: "STUDENT" }, { enrollments: { some: {} } }] };
