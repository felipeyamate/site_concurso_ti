/**
 * session-limit.ts — Regra do limite de sessões (dispositivos logados ao mesmo tempo).
 *
 * Por que existe: é uma medida antipirataria. Sem limite, um aluno poderia compartilhar a
 * senha com várias pessoas. Com o limite, ao entrar num dispositivo novo, o login MAIS ANTIGO
 * é encerrado automaticamente (parecido com serviços de streaming).
 *
 * Quem chama: o "gancho" (hook) de criação de sessão em `auth.ts` — ele roda logo depois
 * de cada login bem-sucedido (e-mail/senha, Google, link mágico).
 *
 * Este arquivo tem só a DECISÃO (função pura, fácil de testar). Quem apaga as sessões no banco
 * é `enforceSessionLimit`, em `session-limit.server.ts`.
 */

// Quantos dispositivos podem ficar logados ao mesmo tempo (ex.: computador + celular).
export const MAX_ACTIVE_SESSIONS = 2;

// O mínimo que precisamos saber de cada sessão para decidir.
export type SessionSummary = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
};

type SelectOptions = {
  maxActiveSessions: number;
  now: Date;
  // Sessão que acabou de ser criada: nunca pode ser removida.
  keepSessionId: string;
};

/**
 * Decide quais sessões devem ser removidas para respeitar o limite.
 *
 * Passos:
 *  1. Sessões já expiradas são sempre removidas (é só limpeza; não contam no limite).
 *  2. Entre as ativas, a sessão recém-criada vem primeiro; as demais, da mais nova para a mais antiga.
 *  3. Ficam as primeiras `maxActiveSessions`; as que sobrarem (as mais antigas) são removidas.
 *
 * Devolve a lista de IDs a remover (lista vazia = nada a fazer).
 */
export function selectSessionsToRevoke(
  sessions: SessionSummary[],
  { maxActiveSessions, now, keepSessionId }: SelectOptions,
): string[] {
  const expired = sessions.filter(
    (session) => session.expiresAt <= now && session.id !== keepSessionId,
  );

  const active = sessions.filter(
    (session) => session.expiresAt > now || session.id === keepSessionId,
  );

  // `sort` com uma função de comparação, como o `key=` do `sorted()` no Python.
  // Número negativo = "a" vem antes de "b".
  const newestFirst = [...active].sort((a, b) => {
    if (a.id === keepSessionId) return -1;
    if (b.id === keepSessionId) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const overLimit = newestFirst.slice(maxActiveSessions);

  return [...expired, ...overLimit].map((session) => session.id);
}
