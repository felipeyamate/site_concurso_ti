/**
 * format.test.ts — Testes da formatação de datas.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime, formatDuration } from "./format";

describe("formatDateTime", () => {
  it("mostra no horário de Brasília, no formato brasileiro", () => {
    // 00:30 em UTC = 21:30 do dia anterior em Brasília (UTC-3).
    expect(formatDateTime(new Date("2026-09-29T00:30:00Z"))).toBe("28/09/2026, 21:30");
  });
});

describe("formatDate", () => {
  it("mostra só a data, no horário de Brasília", () => {
    expect(formatDate(new Date("2026-09-29T00:30:00Z"))).toBe("28/09/2026");
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 min"],
    [20, "1 min"],
    [540, "9 min"],
    [3600, "1 h"],
    [3900, "1 h 05 min"],
    [7260, "2 h 01 min"],
  ])("%i segundos → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});
