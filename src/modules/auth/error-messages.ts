/**
 * error-messages.ts — Traduz os erros do Better Auth para mensagens em português.
 *
 * Quem chama: os formulários de login/cadastro/senha, quando a API devolve um erro.
 * O que devolve: um texto simples para mostrar ao aluno.
 *
 * O Better Auth devolve erros com um `code` em inglês (ex.: "INVALID_EMAIL_OR_PASSWORD").
 * Mapeamos os mais comuns; qualquer outro vira uma mensagem genérica (nunca mostramos
 * detalhes técnicos para o aluno).
 */

const MESSAGES_BY_CODE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_PASSWORD: "Senha incorreta.",
  USER_ALREADY_EXISTS: "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.",
  PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
  PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
  INVALID_TOKEN: "Este link é inválido ou já foi usado. Peça um novo.",
  TOKEN_EXPIRED: "Este link expirou. Peça um novo.",
  EMAIL_NOT_VERIFIED: "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.",
  USER_NOT_FOUND: "Não encontramos uma conta com este e-mail.",
  CREDENTIAL_ACCOUNT_NOT_FOUND:
    "Esta conta não tem senha cadastrada. Entre com o Google ou com o link por e-mail.",
};

const GENERIC_MESSAGE = "Não foi possível concluir agora. Tente novamente em instantes.";
const TOO_MANY_REQUESTS_MESSAGE = "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";

// Formato do erro que o `authClient` devolve (só os campos que usamos).
export type AuthClientError = {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
};

/**
 * Converte um erro da API de autenticação numa mensagem amigável.
 *
 * Passos:
 *  1. Se for "muitas tentativas" (HTTP 429), avisa para esperar.
 *  2. Se o `code` for conhecido, usa a tradução.
 *  3. Senão, mensagem genérica.
 */
export function getAuthErrorMessage(error: AuthClientError | null | undefined): string {
  if (!error) {
    return GENERIC_MESSAGE;
  }
  if (error.status === 429) {
    return TOO_MANY_REQUESTS_MESSAGE;
  }
  if (error.code && error.code in MESSAGES_BY_CODE) {
    return MESSAGES_BY_CODE[error.code];
  }
  return GENERIC_MESSAGE;
}
