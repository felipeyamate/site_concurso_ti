/**
 * dates.test.ts — Testes das datas de cobrança (fuso de Brasília, meses, dias).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  dateOnlyToUtc,
  daysBetween,
  formatDateOnly,
  startOfDayInSaoPaulo,
  toSaoPauloDate,
  utcToDateOnly,
} from "./dates";

describe("toSaoPauloDate", () => {
  it("usa o dia de Brasília, não o de UTC", () => {
    // 01:30 UTC do dia 30 ainda é 22:30 do dia 29 em Brasília.
    expect(toSaoPauloDate(new Date("2026-09-30T01:30:00Z"))).toBe("2026-09-29");
    expect(toSaoPauloDate(new Date("2026-09-30T03:30:00Z"))).toBe("2026-09-30");
  });
});

describe("conversões", () => {
  it("coluna de data do banco ↔ AAAA-MM-DD", () => {
    expect(utcToDateOnly(dateOnlyToUtc("2026-02-28"))).toBe("2026-02-28");
  });

  it("mostra a data da coluna sem pular para o dia anterior", () => {
    expect(formatDateOnly(dateOnlyToUtc("2026-09-30"))).toBe("30/09/2026");
  });

  it("o dia começa às 03:00 UTC (00:00 em Brasília)", () => {
    expect(startOfDayInSaoPaulo("2026-11-04").toISOString()).toBe("2026-11-04T03:00:00.000Z");
  });
});

describe("addDays e addMonths", () => {
  it("soma dias atravessando meses e anos", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });

  it("soma meses sem pular para o mês seguinte (31/01 + 1 mês = fim de fevereiro)", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-10-15", 1)).toBe("2026-11-15");
    expect(addMonths("2026-12-10", 1)).toBe("2027-01-10");
    expect(addMonths("2026-09-29", 12)).toBe("2027-09-29");
  });

  it("daysBetween conta dias inteiros", () => {
    expect(daysBetween(new Date("2026-09-01T12:00:00Z"), new Date("2026-09-08T11:59:00Z"))).toBe(6);
    expect(daysBetween(new Date("2026-09-01T12:00:00Z"), new Date("2026-09-08T12:00:00Z"))).toBe(7);
  });
});
