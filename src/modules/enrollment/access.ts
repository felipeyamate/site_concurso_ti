/**
 * access.ts — A regra de "quem pode assistir a esta aula?".
 *
 * Quem chama: a página da aula, a lista de aulas (cadeados) e as ações que salvam progresso.
 * O que devolve: `{ allowed: true/false, reason }` — o motivo serve para a tela explicar ao aluno.
 *
 * REGRA QUE NÃO MUDA (PROJECT.md, seção 6): quem libera o conteúdo é SÓ a matrícula (Enrollment).
 * Pagamento nunca libera acesso direto: na Fase 4, pagamento confirmado cria/renova a matrícula.
 *
 * Arquivo "puro" (sem banco): recebe os dados já buscados e decide. Por isso é fácil de testar
 * todos os casos em `access.test.ts` — e este arquivo é exatamente onde um erro custaria caro.
 */
import { hasMinimumRole } from "@/modules/auth/roles";

// O mínimo que a regra precisa saber de uma matrícula.
export type EnrollmentSnapshot = {
  startsAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
};

export type LessonAccessInput = {
  role: unknown;
  isCoursePublished: boolean;
  isLessonPublished: boolean;
  isFreePreview: boolean;
  enrollment: EnrollmentSnapshot | null;
  now: Date;
};

export type LessonAccess =
  | { allowed: true; reason: "STAFF" | "ENROLLED" | "FREE_PREVIEW" }
  | {
      allowed: false;
      reason:
        | "NOT_PUBLISHED"
        | "NOT_ENROLLED"
        | "ENROLLMENT_NOT_STARTED"
        | "ENROLLMENT_EXPIRED"
        | "ENROLLMENT_REVOKED";
    };

// Situação da matrícula, para as telas explicarem ao aluno o que está acontecendo.
export type EnrollmentStatus = "NONE" | "ACTIVE" | "NOT_STARTED" | "EXPIRED" | "REVOKED";

/**
 * Em que situação a matrícula está AGORA.
 * Ordem: não existe → revogada → ainda não começou → vencida → ativa.
 */
export function getEnrollmentStatus(enrollment: EnrollmentSnapshot | null, now: Date): EnrollmentStatus {
  if (!enrollment) return "NONE";
  if (enrollment.revokedAt) return "REVOKED";
  if (enrollment.startsAt > now) return "NOT_STARTED";
  if (enrollment.expiresAt && enrollment.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

/**
 * Junta as matrículas de UM aluno em UM curso (uma por origem: manual, compra, assinatura — Fase 4)
 * numa só, a que vale para a regra de acesso e para as telas.
 *
 * Passos:
 *  1. Alguma ativa? Fica a que dura mais (sem data de fim ganha de qualquer data).
 *  2. Senão, alguma que ainda vai começar? Fica a que começa primeiro.
 *  3. Senão (todas vencidas/revogadas), fica a que terminou por último — é ela que explica ao
 *     aluno o que aconteceu ("terminou em ..." ou "foi cancelado").
 * Paralelo em Python: um `max(rows, key=...)` com a regra de desempate de cada caso.
 */
export function mergeEnrollments(rows: EnrollmentSnapshot[], now: Date): EnrollmentSnapshot | null {
  if (rows.length === 0) return null;

  const active = rows.filter((row) => getEnrollmentStatus(row, now) === "ACTIVE");
  if (active.length > 0) {
    return active.reduce((best, row) => {
      if (best.expiresAt === null) return best;
      if (row.expiresAt === null) return row;
      return row.expiresAt > best.expiresAt ? row : best;
    });
  }

  const upcoming = rows.filter((row) => getEnrollmentStatus(row, now) === "NOT_STARTED");
  if (upcoming.length > 0) {
    return upcoming.reduce((best, row) => (row.startsAt < best.startsAt ? row : best));
  }

  // Quando cada uma terminou: a data da revogação, ou a data de fim.
  const endedAt = (row: EnrollmentSnapshot) => (row.revokedAt ?? row.expiresAt ?? now).getTime();
  return rows.reduce((best, row) => (endedAt(row) > endedAt(best) ? row : best));
}

/**
 * A matrícula vale AGORA?
 * Vale se: não foi revogada, já começou e (não tem data de fim OU a data de fim ainda não chegou).
 */
export function isEnrollmentActive(enrollment: EnrollmentSnapshot | null, now: Date): boolean {
  return getEnrollmentStatus(enrollment, now) === "ACTIVE";
}

/**
 * Decide se a pessoa pode assistir a aula.
 *
 * Passos, nesta ordem:
 *  1. Professor/admin: sempre pode (inclusive rascunhos, para revisar o conteúdo).
 *  2. Curso ou aula não publicados: ninguém mais vê.
 *  3. Matrícula ativa: pode.
 *  4. Aula grátis: qualquer pessoa logada pode (quem chama já exigiu o login).
 *  5. Senão, não pode — e o motivo diz se a matrícula venceu, foi cancelada ou não existe.
 */
export function checkLessonAccess(input: LessonAccessInput): LessonAccess {
  if (hasMinimumRole(input.role, "TEACHER")) {
    return { allowed: true, reason: "STAFF" };
  }
  if (!input.isCoursePublished || !input.isLessonPublished) {
    return { allowed: false, reason: "NOT_PUBLISHED" };
  }
  if (isEnrollmentActive(input.enrollment, input.now)) {
    return { allowed: true, reason: "ENROLLED" };
  }
  if (input.isFreePreview) {
    return { allowed: true, reason: "FREE_PREVIEW" };
  }
  const status = getEnrollmentStatus(input.enrollment, input.now);
  if (status === "REVOKED") {
    return { allowed: false, reason: "ENROLLMENT_REVOKED" };
  }
  if (status === "EXPIRED") {
    return { allowed: false, reason: "ENROLLMENT_EXPIRED" };
  }
  if (status === "NOT_STARTED") {
    return { allowed: false, reason: "ENROLLMENT_NOT_STARTED" };
  }
  return { allowed: false, reason: "NOT_ENROLLED" };
}

/** Quem pode ver a PÁGINA de um curso: publicado para todos; rascunho só para professor/admin. */
export function canViewCourse(role: unknown, isCoursePublished: boolean): boolean {
  return isCoursePublished || hasMinimumRole(role, "TEACHER");
}

/** Texto para o aluno quando a aula está bloqueada. */
export const LOCKED_LESSON_MESSAGES: Record<Extract<LessonAccess, { allowed: false }>["reason"], string> = {
  NOT_PUBLISHED: "Esta aula ainda não está disponível.",
  NOT_ENROLLED: "Esta aula é exclusiva para alunos matriculados no curso.",
  ENROLLMENT_NOT_STARTED: "Sua matrícula neste curso ainda não começou. Volte na data de início.",
  ENROLLMENT_EXPIRED: "Seu acesso a este curso terminou. Renove para continuar assistindo.",
  ENROLLMENT_REVOKED: "Seu acesso a este curso foi cancelado. Em caso de dúvida, fale com o suporte.",
};
