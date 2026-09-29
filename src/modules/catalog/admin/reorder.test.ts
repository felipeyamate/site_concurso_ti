/**
 * reorder.test.ts — Testes da troca de posição (botões ↑ e ↓ do painel).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { moveItem } from "./reorder";

describe("moveItem", () => {
  const items = ["a", "b", "c"];

  it("troca com o vizinho de cima ou de baixo", () => {
    expect(moveItem(items, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveItem(items, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("não faz nada no primeiro/último ou com item fora da lista", () => {
    expect(moveItem(items, "a", "up")).toBeNull();
    expect(moveItem(items, "c", "down")).toBeNull();
    expect(moveItem(items, "x", "up")).toBeNull();
  });

  it("não altera a lista original", () => {
    moveItem(items, "b", "up");
    expect(items).toEqual(["a", "b", "c"]);
  });
});
