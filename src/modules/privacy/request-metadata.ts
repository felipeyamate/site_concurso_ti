/**
 * request-metadata.ts — IP e navegador de quem fez a requisição, com tamanho limitado.
 *
 * Quem chama: o registro de aceite dos termos (`consent.server.ts`, via `actions.ts`) e o registro
 * de acesso do login (`access-log.server.ts`). Arquivo "puro", testado em `request-metadata.test.ts`.
 *
 * Por que um lugar só: as duas tabelas guardam IP e navegador como prova (LGPD e Marco Civil) e
 * precisam dos mesmos limites — um cabeçalho gigante nunca vai inteiro para o banco.
 */

export type RequestMetadata = { ipAddress: string | null; userAgent: string | null };

const MAX_IP_LENGTH = 100;
const MAX_USER_AGENT_LENGTH = 500;

/** Corta nos limites; texto vazio vira null. */
export function limitRequestMetadata(input: { ipAddress?: string | null; userAgent?: string | null }): RequestMetadata {
  return {
    ipAddress: input.ipAddress?.trim().slice(0, MAX_IP_LENGTH) || null,
    userAgent: input.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) || null,
  };
}

/**
 * Lê dos cabeçalhos. Na Vercel, o IP real do visitante vem em `x-forwarded-for` (o primeiro da
 * lista); o resto são os servidores do caminho.
 */
export function requestMetadata(headers: Headers): RequestMetadata {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return limitRequestMetadata({ ipAddress: forwarded || headers.get("x-real-ip"), userAgent: headers.get("user-agent") });
}
