/**
 * reorder.ts — Troca um item de lugar com o vizinho (botões ↑ e ↓ do painel).
 *
 * Quem chama: `catalog-admin.server.ts`, ao reordenar cursos, módulos e aulas.
 * Arquivo "puro", testado em `reorder.test.ts`.
 */

/**
 * Devolve a nova ordem da lista, com `item` trocado de lugar com o vizinho de cima/baixo.
 * Devolve `null` quando não há o que fazer (item não está na lista, ou já é o primeiro/último).
 * Paralelo em Python: `lista[i], lista[j] = lista[j], lista[i]` numa cópia da lista.
 */
export function moveItem<T>(items: readonly T[], item: T, direction: "up" | "down"): T[] | null {
  const index = items.indexOf(item);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= items.length) return null;
  const reordered = [...items];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered;
}
