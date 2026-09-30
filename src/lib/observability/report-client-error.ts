/**
 * report-client-error.ts — Manda um erro capturado na tela (páginas de erro) para o Sentry.
 *
 * Quem chama: `src/app/error.tsx` e `src/app/global-error.tsx` (no navegador).
 * Sem NEXT_PUBLIC_SENTRY_DSN, não faz nada (o Sentry nem é carregado).
 */
export function reportClientError(error: Error & { digest?: string }): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {});
}
