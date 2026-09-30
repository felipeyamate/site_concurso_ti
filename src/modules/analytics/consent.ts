/**
 * consent.ts — A escolha de cookies de análise (LGPD): lida e gravada num cookie do navegador.
 *
 * Quem chama: o aviso de cookies (`components/analytics-consent.tsx`). Arquivo "puro", testado em
 * `consent.test.ts`.
 *
 * Como funciona: o cookie `ct_cookies` guarda a escolha por 1 ano — "analytics" (aceitou os cookies
 * de análise) ou "essential" (só os essenciais). Sem o cookie, a pessoa ainda não escolheu e o
 * aviso aparece. A análise (PostHog) só roda com "analytics"; os cookies essenciais (login e
 * indicação de afiliado) não dependem de consentimento, porque sem eles o site não funciona.
 */

export const ANALYTICS_CONSENT_COOKIE = "ct_cookies";
export const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export type AnalyticsChoice = "analytics" | "essential";

/** Lê a escolha em `document.cookie` ("a=1; ct_cookies=analytics; b=2"). Nada escolhido → null. */
export function readAnalyticsChoice(cookieHeader: string): AnalyticsChoice | null {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== ANALYTICS_CONSENT_COOKIE) continue;
    const value = rest.join("=");
    return value === "analytics" || value === "essential" ? value : null;
  }
  return null;
}

/** O texto do cookie para gravar a escolha (`document.cookie = ...`). `secure` no site com HTTPS. */
export function analyticsChoiceCookie(choice: AnalyticsChoice, secure: boolean): string {
  return `${ANALYTICS_CONSENT_COOKIE}=${choice}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}

/** Evento que o link "Preferências de cookies" (rodapé) dispara para reabrir o aviso. */
export const OPEN_COOKIE_PREFERENCES_EVENT = "ct:abrir-preferencias-de-cookies";

/**
 * Tira de um endereço os parâmetros (`?token=...`) e o `#...`: "https://site/redefinir-senha?token=abc"
 * → "https://site/redefinir-senha". Textos que não são endereços http(s) voltam iguais.
 * Por que: alguns endereços do site carregam segredos (o link de redefinir a senha, o `?cupom=` de
 * um afiliado, o `?voltar=`...) e o PostHog guarda o endereço de cada página visitada.
 */
export function stripUrlQuery(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  const cut = value.search(/[?#]/);
  return cut === -1 ? value : value.slice(0, cut);
}

type AnalyticsEvent = { properties?: Record<string, unknown>; $set?: Record<string, unknown>; $set_once?: Record<string, unknown> };

function stripUrlsIn(properties: Record<string, unknown> | undefined): void {
  if (!properties) return;
  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string") properties[key] = stripUrlQuery(value);
  }
}

/**
 * Limpa um evento do PostHog antes do envio (`before_send`): todo endereço — a página atual, a
 * anterior, a de entrada, o "referrer" — vai sem os parâmetros. Devolve o mesmo evento, alterado.
 * Paralelo em Python: é uma função "antes de enviar" que passa por um dicionário trocando valores.
 */
export function sanitizeAnalyticsEvent<T extends AnalyticsEvent>(event: T | null): T | null {
  if (!event) return event;
  stripUrlsIn(event.properties);
  stripUrlsIn(event.$set);
  stripUrlsIn(event.$set_once);
  return event;
}
