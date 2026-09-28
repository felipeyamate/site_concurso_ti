/**
 * display-name.ts — Gera um nome provisório a partir do e-mail.
 *
 * Quem chama: o gancho de criação de usuário em `auth.ts`.
 *
 * Por que existe: quem cria a conta pelo link mágico informa só o e-mail, e o Better Auth
 * gravaria o nome vazio (a área do aluno mostraria "Olá, !"). Nesse caso usamos a parte do
 * e-mail antes do "@": "maria.silva@gmail.com" → "Maria Silva".
 */

const FALLBACK_NAME = "Aluno";

export function nameFromEmail(email: string): string {
  // 1. Pega o que vem antes do "@" (como `email.split("@")[0]` no Python).
  const localPart = email.split("@")[0] ?? "";

  // 2. Troca separadores comuns (. _ - +) por espaço e junta espaços repetidos.
  const words = localPart.replace(/[._+-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return FALLBACK_NAME;
  }

  // 3. Primeira letra de cada palavra em maiúscula (como o `str.title()` do Python).
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}
