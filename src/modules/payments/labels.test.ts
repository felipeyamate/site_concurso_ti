/**
 * labels.test.ts — Textos de vendas mostrados ao aluno.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { accessDaysLabel } from "./labels";

describe("accessDaysLabel", () => {
  it("anos inteiros, dias e sem data de fim", () => {
    expect(accessDaysLabel(null)).toBe("sem data de fim");
    expect(accessDaysLabel(365)).toBe("1 ano");
    expect(accessDaysLabel(730)).toBe("2 anos");
    expect(accessDaysLabel(90)).toBe("90 dias");
    expect(accessDaysLabel(1)).toBe("1 dia");
  });
});
