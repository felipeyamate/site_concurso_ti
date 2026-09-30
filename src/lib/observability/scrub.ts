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

/**
 * Limpa qualquer valor "de dentro para fora": textos têm e-mails/CPFs trocados; listas e objetos são
 * percorridos (até 8 níveis — o Sentry já corta os objetos mais fundos antes de enviar).
 * Serve para os `extra` (ex.: os argumentos de um `console.error(mensagem, erro)` capturado) e `contexts`.
 */
export function scrubDeep(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubText(value);
  if (depth >= 8 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) result[key] = scrubDeep(item, depth + 1);
  return result;
}

// Só os campos que usamos (o formato completo do evento do Sentry é bem maior).
export type ScrubbableEvent = {
  message?: string;
  logentry?: { message?: string; params?: unknown[] };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
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
 * cabeçalhos sensíveis; 3. troca e-mails/CPFs nas mensagens, nos erros, nos dados extras (ex.: os
 * argumentos de um `console.error` capturado), nos contextos e no "rastro" (breadcrumbs).
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
  if (event.logentry) {
    if (event.logentry.message) event.logentry.message = scrubText(event.logentry.message);
    if (event.logentry.params) event.logentry.params = scrubDeep(event.logentry.params) as unknown[];
  }
  if (event.extra) event.extra = scrubDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as Record<string, unknown>;
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
