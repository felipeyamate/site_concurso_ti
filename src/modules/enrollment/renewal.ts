/**
 * renewal.ts — Regra de criar/renovar uma matrícula: quando começa e até quando vale.
 *
 * Quem chama: a matrícula manual (`grant.ts`: painel e `npm run enroll`) e, na Fase 4, o recálculo
 * do acesso das compras (`payments/access-sync.ts`), que aplica esta regra compra a compra, na ordem
 * em que foram pagas ("pagamento confirmado → gera/renova um Enrollment", PROJECT.md seção 6).
 *
 * Função "pura" (sem banco), testada em `renewal.test.ts`.
 */
import { getEnrollmentStatus, type EnrollmentSnapshot } from "./access";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type EnrollmentPeriod = {
  startsAt: Date;
  expiresAt: Date | null; // null = sem data de fim
};

/**
 * Calcula o novo período da matrícula.
 *
 * Regras (pensadas para NUNCA tirar dias que o aluno já tinha):
 *  - `days: null` (sem data de fim): acesso sem data de fim.
 *  - Matrícula ATIVA com data de fim: os dias novos são SOMADOS à data de fim atual
 *    (quem renova com 30 dias sobrando fica com 30 + N).
 *  - Matrícula ATIVA sem data de fim: continua sem data de fim (renovar não encurta o acesso).
 *  - Sem matrícula, vencida, revogada ou ainda não iniciada: começa agora e vale por N dias.
 *  - Se a matrícula estava ativa, o início (`startsAt`) original é mantido.
 */
export function computeEnrollmentRenewal(
  existing: EnrollmentSnapshot | null,
  params: { days: number | null; now: Date },
): EnrollmentPeriod {
  const isActive = getEnrollmentStatus(existing, params.now) === "ACTIVE";
  const startsAt = isActive && existing ? existing.startsAt : params.now;

  if (params.days === null) {
    return { startsAt, expiresAt: null };
  }
  if (isActive && existing) {
    if (existing.expiresAt === null) {
      return { startsAt, expiresAt: null };
    }
    return { startsAt, expiresAt: new Date(existing.expiresAt.getTime() + params.days * DAY_IN_MS) };
  }
  return { startsAt, expiresAt: new Date(params.now.getTime() + params.days * DAY_IN_MS) };
}
