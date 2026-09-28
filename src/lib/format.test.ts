/**
 * format.test.ts — Testes da formatação de datas.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { formatDateTime } from "./format";

describe("formatDateTime", () => {
  it("mostra no horário de Brasília, no formato brasileiro", () => {
    // 00:30 em UTC = 21:30 do dia anterior em Brasília (UTC-3).
    expect(formatDateTime(new Date("2026-09-29T00:30:00Z"))).toBe("28/09/2026, 21:30");
  });
});
