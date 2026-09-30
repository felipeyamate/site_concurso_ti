/**
 * scrub.ts — Tira dados pessoais dos avisos de erro antes de irem para o Sentry.
 *
 * Quem chama: a configuração do Sentry (`sentry-options.ts`, no `beforeSend`), no servidor e no
 * navegador. Arquivo "puro", testado em `scrub.test.ts`.
 *
 * Por que: a Política de privacidade promete que os avisos de erro vão SEM nome, e-mail ou CPF.
 * Mensagens de erro às vezes carregam esses dados sem querer (ex.: "usuário maria@... não
 * encontrado"). Aqui trocamos e-mails e CPFs por marcadores e removemos o que a requisição traz de
 * pessoal (cookies, cabeçalhos de login, corpo do formulário, IP).
 * Paralelo em Python: é o `before_send` do `sentry_sdk.init(...)`.
 */

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// CPF com ou sem pontuação: 529.982.247-25 ou 52998224725 (11 dígitos soltos).
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;

/** "falhou para maria@x.com (CPF 529.982.247-25)" → "falhou para [e-mail] (CPF [cpf])". */
export function scrubText(text: string): string {
  return text.replace(EMAIL_PATTERN, "[e-mail]").replace(CPF_PATTERN, "[cpf]");
}

// Só os campos que usamos (o formato completo do evento do Sentry é bem maior).
export type ScrubbableEvent = {
  message?: string;
  user?: Record<string, unknown>;
  request?: { cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown; url?: string };
  exception?: { values?: Array<{ value?: string }> };
  breadcrumbs?: Array<{ message?: string; data?: Record<string, unknown> }>;
};

// Cabeçalhos que identificam a pessoa ou o login.
const SENSITIVE_HEADERS = ["cookie", "authorization", "x-forwarded-for", "x-real-ip", "asaas-access-token"];

/**
 * Limpa um evento do Sentry (devolve o mesmo objeto, alterado).
 * Passos: 1. tira o usuário e o IP; 2. tira cookies, corpo e parâmetros da requisição e os
 * cabeçalhos sensíveis; 3. troca e-mails/CPFs nas mensagens, nos erros e no "rastro" (breadcrumbs).
 */
export function scrubSentryEvent<T extends ScrubbableEvent>(event: T): T {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = event.request.url.split("?")[0];
    if (event.request.headers) {
      for (const name of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(name.toLowerCase())) delete event.request.headers[name];
      }
    }
  }
  if (event.message) event.message = scrubText(event.message);
  for (const value of event.exception?.values ?? []) {
    if (value.value) value.value = scrubText(value.value);
  }
  for (const crumb of event.breadcrumbs ?? []) {
    if (crumb.message) crumb.message = scrubText(crumb.message);
    // Dados do rastro (ex.: endereço de uma requisição com ?email=...) saem inteiros.
    delete crumb.data;
  }
  return event;
}
