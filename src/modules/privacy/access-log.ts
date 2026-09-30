/**
 * access-log.ts — Regra pura do registro de acesso (Marco Civil da Internet, Lei 12.965/2014, art. 15):
 * por quanto tempo guardar e a partir de quando apagar.
 *
 * Quem chama: `access-log.server.ts` (grava a cada login) e a limpeza diária
 * (`maintenance/cleanup.server.ts`, apaga os mais velhos). Testado em `access-log.test.ts`.
 *
 * Por que 186 dias: a lei pede "6 meses". Um período de 6 meses tem no máximo 184 dias (ex.: de 1º de
 * julho a 1º de janeiro); com 186, nunca apagamos antes do prazo. E não guardamos muito além disso
 * (LGPD: dado pessoal só pelo tempo necessário).
 */

export const ACCESS_LOG_RETENTION_DAYS = 186;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Registros criados ANTES desta data já passaram do prazo e podem ser apagados. */
export function accessLogCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCESS_LOG_RETENTION_DAYS * DAY_MS);
}
