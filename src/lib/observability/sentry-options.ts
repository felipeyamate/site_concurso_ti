/**
 * sentry-options.ts — As opções do Sentry usadas no servidor, no "edge" e no navegador.
 *
 * Quem chama: `src/instrumentation.ts` (servidor/edge) e `src/instrumentation-client.ts` (navegador),
 * só quando NEXT_PUBLIC_SENTRY_DSN existe. Sem o DSN, o Sentry nem é carregado.
 *
 * Decisões:
 *  - `sendDefaultPii: false` + `scrubSentryEvent`: nada de IP, cookies, e-mail ou CPF (LGPD; é o que
 *    a Política de privacidade promete);
 *  - só ERROS (`tracesSampleRate: 0`): medição de desempenho custa e não é necessária agora;
 *  - `environment`: "production" no site oficial, "preview" nos deploys de teste, "development" local.
 */
import { scrubSentryEvent, type ScrubbableEvent } from "./scrub";

export function sentryOptions(dsn: string) {
  return {
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // O tipo do evento do Sentry é grande; usamos só os campos de `ScrubbableEvent`.
    beforeSend<T extends ScrubbableEvent>(event: T): T {
      return scrubSentryEvent(event);
    },
  };
}
