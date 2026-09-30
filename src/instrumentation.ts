/**
 * instrumentation.ts — Roda UMA vez quando o servidor do Next.js inicia (e no "edge").
 *
 * Quem chama: o próprio Next.js, automaticamente (arquivo com nome reservado, em `src/`).
 * O que faz: liga o Sentry (avisos de erro) SE houver NEXT_PUBLIC_SENTRY_DSN — sem ele, nada.
 *  - `register`: inicia o Sentry com as nossas opções (sem dados pessoais — `sentry-options.ts`);
 *    no servidor Node, também transforma cada `console.error` do nosso código em aviso (os erros
 *    que já registrávamos no log: webhook que falhou, e-mail que não saiu, erro inesperado numa ação).
 *  - `onRequestError`: erro não tratado numa página/rota/ação → aviso no Sentry, com o endereço.
 * Paralelo em Python: é como chamar `sentry_sdk.init(...)` no início do app Django.
 */
import type { Instrumentation } from "next";

export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  const { sentryOptions } = await import("@/lib/observability/sentry-options");
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({ ...sentryOptions(dsn), integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })] });
  } else {
    Sentry.init(sentryOptions(dsn));
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
