/**
 * roles.ts — Perfis de usuário (STUDENT, TEACHER, ADMIN) e a regra de "quem pode o quê".
 *
 * Quem chama: as proteções de página (`session.ts`), a configuração do Better Auth (`auth.ts`),
 * o script `scripts/set-role.ts` e as telas que mostram o perfil.
 * O que devolve: a lista de perfis, rótulos em português e funções de checagem.
 *
 * Arquivo "puro": não acessa banco nem rede, então pode ser usado no servidor e no navegador,
 * e é fácil de testar (`roles.test.ts`).
 *
 * A lista abaixo precisa ser igual ao `enum Role` de `prisma/schema.prisma`.
 * Um teste automático confere isso, para as duas nunca ficarem diferentes.
 */

// `as const` congela a lista e faz o TypeScript entender os valores exatos
// (parecido com um `Literal["STUDENT", "TEACHER", "ADMIN"]` do Python).
export const ROLES = ["STUDENT", "TEACHER", "ADMIN"] as const;

export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "STUDENT";

// Nível de poder de cada perfil. Quem tem nível maior pode tudo o que os menores podem.
// Ex.: um ADMIN acessa o que um TEACHER acessa.
const ROLE_LEVEL: Record<Role, number> = {
  STUDENT: 1,
  TEACHER: 2,
  ADMIN: 3,
};

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Aluno",
  TEACHER: "Professor",
  ADMIN: "Administrador",
};

/**
 * Diz se um valor qualquer (ex.: vindo do banco ou da linha de comando) é um perfil válido.
 * Funciona como um "type guard": depois do `if (isRole(x))`, o TypeScript sabe que `x` é `Role`.
 */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Responde: "este usuário tem pelo menos o perfil exigido?".
 *
 * Por que "pelo menos": evita listas repetidas do tipo ["TEACHER", "ADMIN"] espalhadas
 * pelo código. Basta dizer o perfil mínimo.
 *
 * Passos:
 *  1. Se o perfil do usuário for desconhecido/vazio, nega (por segurança, na dúvida, não libera).
 *  2. Compara os níveis de poder.
 */
export function hasMinimumRole(userRole: unknown, requiredRole: Role): boolean {
  if (!isRole(userRole)) {
    return false;
  }
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[requiredRole];
}
