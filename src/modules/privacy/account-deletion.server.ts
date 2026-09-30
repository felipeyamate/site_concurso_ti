/**
 * account-deletion.server.ts — Exclusão de conta a pedido (LGPD, art. 18, VI).
 *
 * Quem chama: a ação "Excluir minha conta" (a própria pessoa, em "Minha conta e privacidade") e a
 * ação do painel (ADMIN, quando o pedido chega pelo suporte). Os testes de integração chamam direto.
 *
 * O que acontece (numa transação, com a MESMA trava do checkout — uma compra em andamento termina
 * antes, e a conferência já a enxerga):
 *  1. Confere o que impede excluir agora (`deletionBlockers`: perfil, assinatura ativa, pagamento
 *     aguardando).
 *  2. Apaga o que é só dela e não precisa ser guardado: logins (sessões), formas de entrar (senha,
 *     Google), progresso nas aulas, respostas de questões e simulados.
 *  3. Guarda, por obrigação legal, o que é financeiro/fiscal: pedidos, pagamentos, notas, matrículas
 *     que vieram deles e o CPF de quem comprou (a "foto" da venda). Quem nunca comprou perde também
 *     os dados de cobrança.
 *  4. Anonimiza a linha do usuário: nome "Conta excluída", e-mail inventado (o verdadeiro fica livre
 *     para um novo cadastro), sem foto, sem aceite — e marca `deletedAt`.
 *  5. Afiliado: desativado e sem a chave Pix (as vendas indicadas continuam no histórico).
 *
 * O registro dos aceites (`legal_consents`) fica: é a prova de que o consentimento existiu. O registro
 * de acesso (`access_logs`, Marco Civil) também fica, até completar os 6 meses da lei (a limpeza diária apaga).
 */
import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { withAdvisoryLock } from "@/lib/db-locks";
import { prisma } from "@/lib/db";
import { UserFacingError } from "@/lib/form-state";

import { DELETED_ACCOUNT_NAME, anonymizedEmail, deletionBlockers, isDeleteConfirmation, isFreshLogin } from "./rules";

type Tx = Prisma.TransactionClient;

/** Conta o que impede excluir (ver `deletionBlockers`) e devolve as frases para a tela. */
export async function findDeletionBlockers(db: Tx, userId: string): Promise<string[]> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  if (!user) return ["Conta não encontrada."];
  const [openSubscriptions, pendingPayments] = await Promise.all([
    db.subscription.count({ where: { userId, status: { in: ["PENDING", "ACTIVE"] }, failureReason: null } }),
    db.payment.count({
      where: { status: "PENDING", OR: [{ order: { userId } }, { subscription: { userId } }] },
    }),
  ]);
  return deletionBlockers({ role: user.role, deletedAt: user.deletedAt, openSubscriptions, pendingPayments });
}

/**
 * O núcleo da exclusão (passos 1 a 5 do cabeçalho). Usado pela pessoa e pelo admin — cada um confere
 * antes as próprias regras (frase/login recente, ou o e-mail digitado pelo admin).
 */
async function anonymizeAccount(userId: string, now: Date): Promise<void> {
  // A trava do checkout deste aluno: nenhuma compra/assinatura nova começa no meio da exclusão.
  await withAdvisoryLock(
    prisma,
    `checkout:${userId}`,
    async (tx) => {
      const blockers = await findDeletionBlockers(tx, userId);
      if (blockers.length > 0) throw new UserFacingError(blockers.join(" "));

      // 2. Dados que não precisam ser guardados.
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      await tx.lessonProgress.deleteMany({ where: { userId } });
      await tx.questionAttempt.deleteMany({ where: { userId } }); // inclui as respostas dos simulados
      await tx.mockExam.deleteMany({ where: { userId } }); // as questões do simulado vão junto (cascade)

      // 3. Dados de cobrança: ficam só se houve compra (a "foto" fiscal da venda); o celular sai sempre.
      const hasPurchases = (await tx.order.count({ where: { userId } })) + (await tx.subscription.count({ where: { userId } })) > 0;
      if (hasPurchases) {
        await tx.billingProfile.updateMany({ where: { userId }, data: { phone: null } });
      } else {
        await tx.billingProfile.deleteMany({ where: { userId } });
      }

      // 4. A linha do usuário, anonimizada.
      await tx.user.update({
        where: { id: userId },
        data: {
          name: DELETED_ACCOUNT_NAME,
          email: anonymizedEmail(userId),
          emailVerified: false,
          image: null,
          legalVersion: null,
          deletedAt: now,
        },
      });

      // 5. Afiliado: para de indicar vendas novas; a chave Pix sai.
      await tx.affiliate.updateMany({ where: { userId }, data: { isActive: false, payoutInfo: "" } });
    },
    { maxWait: 10_000, timeout: 30_000 },
  );
}

/**
 * A própria pessoa excluindo a conta. Além das regras gerais, exige:
 *  - a frase de confirmação digitada ("EXCLUIR MINHA CONTA");
 *  - login feito há pouco (15 min): quem pegou o celular destravado de outra pessoa não exclui a conta dela.
 */
export async function deleteOwnAccount(input: { userId: string; confirmation: string; sessionCreatedAt: Date; now?: Date }): Promise<void> {
  const now = input.now ?? new Date();
  if (!isDeleteConfirmation(input.confirmation)) {
    throw new UserFacingError('Para confirmar, digite exatamente: EXCLUIR MINHA CONTA', { field: "confirmation" });
  }
  if (!isFreshLogin(input.sessionCreatedAt, now)) {
    throw new UserFacingError("Por segurança, saia e entre de novo na sua conta (e-mail e senha ou link por e-mail) e volte aqui em até 15 minutos.");
  }
  await anonymizeAccount(input.userId, now);
}

/**
 * Admin excluindo a conta de alguém (pedido feito pelo suporte). O admin digita o e-mail da conta
 * para confirmar (evita excluir a pessoa errada) e não pode excluir a própria conta por aqui.
 */
export async function adminDeleteAccount(input: { actorId: string; userId: string; typedEmail: string; now?: Date }): Promise<void> {
  if (input.actorId === input.userId) throw new UserFacingError("Você não pode excluir a sua própria conta pelo painel.");
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
  if (!user) throw new UserFacingError("Usuário não encontrado.");
  if (input.typedEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new UserFacingError("O e-mail digitado não é o desta conta.", { field: "typedEmail" });
  }
  await anonymizeAccount(input.userId, input.now ?? new Date());
}
