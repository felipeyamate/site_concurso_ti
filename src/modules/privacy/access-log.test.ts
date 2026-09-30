/**
 * access-log.test.ts — Testes do prazo do registro de acesso (Marco Civil: 6 meses).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { ACCESS_LOG_RETENTION_DAYS, accessLogCutoff } from "./access-log";

describe("registro de acesso: prazo de guarda", () => {
  it("nunca apaga antes de 6 meses, começando em qualquer dia do ano (inclusive ano bissexto)", () => {
    // Para cada dia de 2027 e 2028: um acesso nesse dia só pode ser apagado depois de 6 meses completos.
    for (let day = 0; day < 731; day += 1) {
      const accessAt = new Date(Date.UTC(2027, 0, 1 + day, 12));
      const sixMonthsLater = new Date(accessAt);
      sixMonthsLater.setUTCMonth(sixMonthsLater.getUTCMonth() + 6);
      // No primeiro instante em que o acesso fica "antes do corte", já se passaram 6 meses.
      const firstDeletableAt = new Date(accessAt.getTime() + ACCESS_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000 + 1);
      expect(accessLogCutoff(firstDeletableAt).getTime()).toBeGreaterThan(accessAt.getTime());
      expect(firstDeletableAt.getTime()).toBeGreaterThanOrEqual(sixMonthsLater.getTime());
    }
  });

  it("não guarda muito além do prazo (no máximo uma semana a mais que 6 meses)", () => {
    expect(ACCESS_LOG_RETENTION_DAYS).toBeLessThanOrEqual(184 + 7);
  });
});
