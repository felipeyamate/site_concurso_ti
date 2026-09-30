/**
 * schemas.test.ts — Formulários de afiliado: código e comissão em %.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { createAffiliateSchema } from "./schemas";

describe("createAffiliateSchema", () => {
  const base = { email: " Maria@Exemplo.com ", code: " Maria-10 ", commissionBps: "20", payoutInfo: "Pix: maria@exemplo.com" };

  it("normaliza e-mail e código; % vira pontos-base", () => {
    expect(createAffiliateSchema.parse(base)).toEqual({ email: "maria@exemplo.com", code: "maria-10", commissionBps: 2000, payoutInfo: "Pix: maria@exemplo.com" });
    expect(createAffiliateSchema.parse({ ...base, commissionBps: "12,5" }).commissionBps).toBe(1250);
  });

  it("recusa comissão fora de 0–100 ou com mais de 2 casas, e código inválido", () => {
    expect(createAffiliateSchema.safeParse({ ...base, commissionBps: "101" }).success).toBe(false);
    expect(createAffiliateSchema.safeParse({ ...base, commissionBps: "10,125" }).success).toBe(false);
    expect(createAffiliateSchema.safeParse({ ...base, commissionBps: "" }).success).toBe(false);
    expect(createAffiliateSchema.safeParse({ ...base, code: "joão" }).success).toBe(false);
  });
});
