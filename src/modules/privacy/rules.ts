/**
 * rules.ts — Regras puras da exclusão de conta (LGPD): confirmação, "login recente", o que impede
 * excluir agora e como fica a conta anonimizada.
 *
 * Quem chama: `account-deletion.server.ts` (que busca os dados no banco e aplica estas regras) e a
 * página "Minha conta e privacidade". Arquivo "puro", testado em `rules.test.ts`.
 *
 * Por que "anonimizar" e não apagar a linha do usuário: pedidos, pagamentos e notas fiscais
 * precisam ser guardados (lei fiscal, 5 anos) e apontam para o usuário. Então apagamos o que
 * identifica a pessoa (nome, e-mail, logins, estudo) e a linha fica como "Conta excluída".
 * Paralelo em Python/pandas: é como trocar as colunas pessoais por valores genéricos em vez de
 * apagar a linha, para os totais continuarem batendo.
 */

/** O que a pessoa digita para confirmar (evita excluir a conta por um clique sem querer). */
export const DELETE_CONFIRMATION_PHRASE = "EXCLUIR MINHA CONTA";

/** Por segurança, só exclui quem entrou há pouco (alguém com o celular destravado de outra pessoa não consegue). */
export const FRESH_LOGIN_MINUTES = 15;

/** Nome que fica na conta excluída (aparece no painel, nos pedidos antigos). */
export const DELETED_ACCOUNT_NAME = "Conta excluída";

/** A frase digitada confere? (ignora maiúsculas/minúsculas e espaços nas pontas) */
export function isDeleteConfirmation(typed: string): boolean {
  return typed.trim().replace(/\s+/g, " ").toUpperCase() === DELETE_CONFIRMATION_PHRASE;
}

/** O login desta sessão foi feito nos últimos 15 minutos? */
export function isFreshLogin(sessionCreatedAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - sessionCreatedAt.getTime();
  return ageMs >= 0 && ageMs <= FRESH_LOGIN_MINUTES * 60 * 1000;
}

/**
 * E-mail que substitui o verdadeiro. Único por conta (a coluna é única) e num domínio que nunca
 * recebe e-mail (".invalid" é reservado para isso). O e-mail verdadeiro fica livre para um novo cadastro.
 */
export function anonymizedEmail(userId: string): string {
  return `conta-excluida-${userId.toLowerCase()}@excluida.invalid`;
}

export type DeletionCheck = {
  role: string;
  deletedAt: Date | null;
  // Assinatura que ainda gera cobranças (aguardando o 1º pagamento ou ativa).
  openSubscriptions: number;
  // Pix/boleto gerado e ainda não pago nem vencido (se fosse pago depois, o dinheiro entraria numa conta que não existe mais).
  pendingPayments: number;
  // Cobrança (Pix, boleto ou cartão) vencida há menos de LATE_PAYMENT_DAYS: o site ainda mostra "Pagar" e
  // ela ainda pode ser paga com atraso (mesmo risco do de cima).
  latePayments: number;
  // Reembolso pedido e ainda não concluído (o de boleto é feito à mão e pode precisar do contato da pessoa).
  refundsInProgress: number;
};

/** Por quantos dias (de Brasília) depois do vencimento uma cobrança ainda impede a exclusão. */
export const LATE_PAYMENT_DAYS = 30;

/**
 * O que impede excluir a conta AGORA (lista vazia = pode excluir). Cada item é uma frase para a tela.
 * Professor/admin: pede a um admin para voltar a "aluno" antes (o site nunca pode ficar sem admin, e
 * o conteúdo que a pessoa criou continua no ar).
 */
export function deletionBlockers(check: DeletionCheck): string[] {
  if (check.deletedAt) return ["Esta conta já foi excluída."];
  const blockers: string[] = [];
  if (check.role !== "STUDENT") {
    blockers.push("Contas de professor ou administrador não são excluídas por aqui: peça a um administrador para mudar o seu perfil para aluno antes.");
  }
  if (check.openSubscriptions > 0) {
    blockers.push('Você tem uma assinatura ativa: cancele em "Minhas compras" antes de excluir a conta (senão ela continuaria gerando cobranças).');
  }
  if (check.pendingPayments > 0) {
    blockers.push('Você tem um pagamento aguardando (Pix ou boleto): pague ou espere vencer antes de excluir a conta. Veja em "Minhas compras".');
  }
  if (check.latePayments > 0) {
    blockers.push(
      `Você tem uma cobrança vencida há menos de ${LATE_PAYMENT_DAYS} dias, que ainda pode ser paga com atraso: pague ou espere ${LATE_PAYMENT_DAYS} dias do vencimento antes de excluir a conta. Veja em "Minhas compras".`,
    );
  }
  if (check.refundsInProgress > 0) {
    blockers.push('Você tem um reembolso em andamento: espere ele terminar antes de excluir a conta (podemos precisar falar com você para devolver o dinheiro). Veja em "Minhas compras".');
  }
  return blockers;
}
