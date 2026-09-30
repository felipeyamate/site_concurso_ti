/**
 * admin-actions.ts — Server Actions de matrícula manual no painel (só ADMIN): matricular/renovar e revogar.
 *
 * Quem chama: /admin/usuarios/[id] (formulário "Matricular" e botões "Revogar").
 * O que devolve: um `FormState`.
 *
 * Usa as MESMAS regras do script `npm run enroll` e dos pagamentos da Fase 4 (`grant.ts`):
 * renovar nunca tira dias; revogar não apaga (fica o histórico).
 * Matrícula manual serve para cortesias, testes e suporte (ex.: aluno que pagou por fora).
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import {
  errorState,
  formDataToObject,
  invalidState,
  stateFromError,
  successState,
  type FormState,
} from "@/lib/form-state";
import { PERMISSION_DENIED_MESSAGE, getSessionWithRole } from "@/modules/auth/action-guards";

import { grantEnrollment, revokeEnrollment } from "./grant";

const MAX_DAYS = 3650; // 10 anos

const grantSchema = z.object({
  userId: z.string().min(1).max(200),
  courseId: z.string().min(1, "Escolha um curso.").max(200),
  // Vazio = sem data de fim. Senão, número inteiro de dias.
  days: z.preprocess(
    (value) => (value === "" || value === undefined ? null : Number(value)),
    z
      .number({ error: "Digite o número de dias (ou deixe vazio para sem data de fim)." })
      .int("Use um número inteiro de dias.")
      .min(1, "No mínimo 1 dia.")
      .max(MAX_DAYS, `No máximo ${MAX_DAYS} dias.`)
      .nullable(),
  ),
});

const revokeSchema = z.object({
  userId: z.string().min(1).max(200),
  courseId: z.string().min(1).max(200),
});

function refreshScreens() {
  // Painel + telas do aluno (área do aluno, cursos, aulas).
  revalidatePath("/", "layout");
}

export async function grantEnrollmentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = grantSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    const [user, course] = await Promise.all([
      prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true } }),
      prisma.course.findUnique({ where: { id: parsed.data.courseId }, select: { id: true, title: true } }),
    ]);
    if (!user) return errorState("Usuário não encontrado.");
    if (!course) return errorState("Curso não encontrado.", { courseId: "Curso não encontrado." });

    const { renewed, period } = await grantEnrollment(prisma, {
      userId: user.id,
      courseId: course.id,
      days: parsed.data.days,
      now: new Date(),
    });
    refreshScreens();
    const until = period.expiresAt ? `até ${formatDate(period.expiresAt)}` : "sem data de fim";
    return successState(`${renewed ? "Matrícula renovada" : "Matriculado"} em "${course.title}" (${until}).`);
  } catch (error) {
    return stateFromError(error, "matricular");
  }
}

export async function revokeEnrollmentAction(_previous: FormState, formData: FormData): Promise<FormState> {
  if (!(await getSessionWithRole("ADMIN"))) return errorState(PERMISSION_DENIED_MESSAGE);
  const parsed = revokeSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return invalidState(parsed.error);

  try {
    const revoked = await revokeEnrollment(prisma, { ...parsed.data, now: new Date() });
    refreshScreens();
    return revoked ? successState("Acesso revogado.") : errorState("Não há matrícula manual ativa para revogar.");
  } catch (error) {
    return stateFromError(error, "revogar matrícula");
  }
}
