/**
 * grant.ts — Matrícula MANUAL: matricular (criar/renovar) e revogar.
 *
 * Quem chama: o painel admin (/admin/usuarios/[id], só ADMIN) e o script `npm run enroll`.
 * Todos usam ESTAS funções — a regra é uma só.
 *
 * Fase 4: cada origem tem a sua linha de matrícula. Estas funções cuidam SÓ da linha MANUAL
 * (cortesias, testes, suporte). As linhas de COMPRA e ASSINATURA são recalculadas a partir dos
 * pagamentos (`src/modules/payments/access-sync.server.ts`); revogar aqui não mexe nelas —
 * para tirar um acesso pago, o caminho é o reembolso (painel → Vendas → Pedidos).
 *
 * Recebe o cliente do banco por parâmetro (em vez de importar `@/lib/db`) porque os scripts de
 * terminal têm a sua própria conexão (`scripts/script-db.ts`). Paralelo em Python: passar a
 * `session` do SQLAlchemy para a função, em vez de a função abrir uma.
 *
 * Regras (ver `renewal.ts`): renovar nunca tira dias; vencida/revogada recomeça agora;
 * revogar não apaga a linha (marca `revokedAt`, para ficar o histórico).
 *
 * Por que uma "trava" (lock) por aluno+curso: renovar é "ler a data atual → somar os dias →
 * gravar". Se dois pedidos chegassem juntos (dois cliques), os dois leriam a MESMA data e um dos
 * acréscimos se perderia (+30 e +30 = só +30). Com a trava, o segundo pedido espera o primeiro
 * terminar e lê a data já renovada.
 * Paralelo em Python: um `threading.Lock` por chave — só que guardado no banco, então vale
 * também entre servidores diferentes.
 */
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { advisoryLock } from "@/lib/db-locks";

import { computeEnrollmentRenewal, type EnrollmentPeriod } from "./renewal";

type Tx = Prisma.TransactionClient;

/**
 * Trava a matrícula manual deste aluno neste curso até o fim da transação (`src/lib/db-locks.ts`).
 * Ela vale mesmo quando a matrícula ainda não existe e se solta sozinha no fim.
 */
async function lockEnrollment(tx: Tx, userId: string, courseId: string): Promise<void> {
  await advisoryLock(tx, `enrollment:${userId}:${courseId}`);
}

export async function grantEnrollment(
  db: PrismaClient,
  params: {
    userId: string;
    courseId: string;
    days: number | null; // null = sem data de fim
    now: Date;
  },
): Promise<{ renewed: boolean; period: EnrollmentPeriod }> {
  const where = {
    userId_courseId_source: { userId: params.userId, courseId: params.courseId, source: "MANUAL" as const },
  };
  return db.$transaction(async (tx) => {
    await lockEnrollment(tx, params.userId, params.courseId);
    const existing = await tx.enrollment.findUnique({
      where,
      select: { startsAt: true, expiresAt: true, revokedAt: true },
    });
    const period = computeEnrollmentRenewal(existing, { days: params.days, now: params.now });

    // upsert = cria se não existe; se existe, renova (como o `update_or_create` do Django).
    await tx.enrollment.upsert({
      where,
      create: { userId: params.userId, courseId: params.courseId, source: "MANUAL", ...period },
      update: { ...period, revokedAt: null },
    });
    return { renewed: Boolean(existing), period };
  });
}

/**
 * Cancela o acesso MANUAL (se ainda não estava cancelado). Devolve `true` se havia o que cancelar.
 * Usa a mesma trava: uma renovação em andamento nunca "desfaz" um cancelamento feito ao mesmo tempo.
 */
export async function revokeEnrollment(
  db: PrismaClient,
  params: { userId: string; courseId: string; now: Date },
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    await lockEnrollment(tx, params.userId, params.courseId);
    const { count } = await tx.enrollment.updateMany({
      where: { userId: params.userId, courseId: params.courseId, source: "MANUAL", revokedAt: null },
      data: { revokedAt: params.now },
    });
    return count > 0;
  });
}
