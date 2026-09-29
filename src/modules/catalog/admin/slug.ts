/**
 * slug.ts — Gera e confere "slugs": o pedaço do endereço que identifica um curso ou uma aula
 * (ex.: "Segurança da Informação" → /cursos/.../aulas/seguranca-da-informacao).
 *
 * Quem chama: o painel admin, ao criar/editar cursos e aulas.
 * Arquivo "puro", testado em `slug.test.ts`.
 *
 * Paralelo em Python: é o `django.utils.text.slugify`.
 */

export const SLUG_MAX_LENGTH = 80;

// Só letras minúsculas sem acento, números e hífens simples no meio (ex.: "aula-1-hardware").
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Converte um título em slug.
 * Passos: separa as letras dos acentos (NFD) e remove os acentos; minúsculas; tudo que não é
 * letra/número vira hífen; tira hífens repetidos e das pontas; limita o tamanho.
 */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, "");
  return slug || "item";
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(slug);
}

/**
 * Devolve um slug que ainda não está em uso, acrescentando -2, -3... se preciso.
 * `isTaken` pergunta ao banco (quem chama decide o escopo: cursos, ou aulas de um curso).
 */
export async function findAvailableSlug(base: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  const root = slugify(base);
  if (!(await isTaken(root))) return root;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const ending = `-${suffix}`;
    const candidate = `${root.slice(0, SLUG_MAX_LENGTH - ending.length).replace(/-+$/g, "")}${ending}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Não foi possível gerar um endereço livre para "${base}".`);
}
