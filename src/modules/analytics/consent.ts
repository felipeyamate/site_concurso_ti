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
