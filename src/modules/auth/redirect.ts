/**
 * redirect.ts — Decide para onde mandar o usuário depois do login, com segurança.
 *
 * Quem chama: a página de login (`/entrar`) e os formulários de autenticação.
 *
 * Problema que resolve: quando alguém tenta abrir `/area-do-aluno` sem estar logado, mandamos
 * para `/entrar?voltar=/area-do-aluno`, e depois do login voltamos para lá. Mas um golpista
 * poderia enviar um link `/entrar?voltar=https://site-falso.com` para roubar o aluno depois do
 * login ("open redirect"). Aqui só aceitamos caminhos INTERNOS do nosso próprio site.
 */

export const DEFAULT_AFTER_LOGIN_PATH = "/area-do-aluno";

// Nome do parâmetro na URL: /entrar?voltar=/caminho
export const RETURN_TO_PARAM = "voltar";

/**
 * Devolve o caminho recebido se for seguro; senão, o caminho padrão.
 *
 * Passos:
 *  1. Precisa ser texto e começar com "/" (caminho interno, ex.: "/admin").
 *  2. Não pode começar com "//" nem "/\" — navegadores tratam isso como OUTRO site.
 *  3. Não pode ter caracteres de controle (quebras de linha etc.), usados em truques.
 */
export function safeRedirectPath(value: unknown, fallback: string = DEFAULT_AFTER_LOGIN_PATH): string {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }
  if (!value.startsWith("/")) {
    return fallback;
  }
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (/[\u0000-\u001F\u007F]/.test(value)) {
    return fallback;
  }
  return value;
}
