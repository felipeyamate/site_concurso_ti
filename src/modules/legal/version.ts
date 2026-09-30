/**
 * version.ts — A versão atual dos Termos de uso e da Política de privacidade.
 *
 * Quem chama: as páginas /termos e /privacidade (mostram a data), a checagem de login
 * (`requireSession`: quem aceitou uma versão antiga passa pela tela de aceite) e o registro do
 * consentimento (`privacy/consent.server.ts`, que grava a versão aceita).
 * Arquivo "puro" (sem banco), testado em `version.test.ts`.
 *
 * Como mudar os textos: edite as páginas e TROQUE a versão abaixo (a data da mudança). Na próxima
 * vez que cada pessoa entrar na área logada, ela verá os textos novos e precisará aceitar de novo —
 * e o novo aceite fica registrado (LGPD: o consentimento vale para a versão que a pessoa leu).
 */

/** Versão dos dois textos (Termos de uso + Política de privacidade), no formato AAAA-MM-DD. */
export const LEGAL_VERSION = "2026-10-01";

/** A mesma data, por extenso, para mostrar nas páginas. */
export const LEGAL_VERSION_LABEL = "1º de outubro de 2026";

/** A pessoa precisa (re)aceitar os textos? Sim se nunca aceitou ou se aceitou outra versão. */
export function needsLegalAcceptance(acceptedVersion: string | null | undefined): boolean {
  return acceptedVersion !== LEGAL_VERSION;
}

/** Tela onde a pessoa aceita a versão atual (a área logada manda para cá quem ainda não aceitou). */
export const LEGAL_ACCEPT_PATH = "/aceitar-termos";
