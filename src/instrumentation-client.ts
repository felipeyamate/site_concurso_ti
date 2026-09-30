/**
 * instrumentation-client.ts — Roda no NAVEGADOR antes de a página ficar interativa.
 *
 * Quem chama: o próprio Next.js, automaticamente (arquivo com nome reservado, em `src/`).
 * O que faz: liga o Sentry no navegador (erros de JavaScript da página) SE houver
 * NEXT_PUBLIC_SENTRY_DSN. O Sentry é carregado "sob demanda" (`import()`): sem o DSN, o código dele
 * nem vai para o navegador do aluno (página mais leve).
 * Mesmas opções do servidor: sem dados pessoais (`sentry-options.ts`).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  void Promise.all([import("@sentry/nextjs"), import("@/lib/observability/sentry-options")])
    .then(([Sentry, { sentryOptions }]) => {
      Sentry.init(sentryOptions(dsn));
    })
    .catch(() => {
      // Sem o Sentry (ex.: bloqueador de anúncios), o site funciona normalmente.
    });
}
