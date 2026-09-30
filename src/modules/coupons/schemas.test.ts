/**
 * schemas.test.ts — Formulário de cupom do painel: desconto, onde vale, datas e limites.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { couponFormSchema } from "./schemas";

const base = {
  code: " bemvindo10 ",
  description: "",
  discountType: "PERCENT",
  percentOff: "10",
  amountOff: "",
  appliesToProducts: "on",
  productIds: ["p1"],
  planIds: ["m1"],
  startsOn: "",
  endsOn: "",
  maxRedemptions: "",
  maxPerUser: "1",
  isActive: "on",
};

describe("couponFormSchema", () => {
  it("normaliza o código, calcula o desconto e descarta a restrição de tipo desmarcado", () => {
    const data = couponFormSchema.parse(base);
    expect(data).toMatchObject({
      code: "BEMVINDO10",
      discountType: "PERCENT",
      discountValue: 10,
      appliesToPlans: false,
      productIds: ["p1"],
      planIds: [],
      maxRedemptions: null,
      startsOn: null,
      couponId: null,
    });
  });

  it("valor fixo em reais vira centavos", () => {
    expect(couponFormSchema.parse({ ...base, discountType: "AMOUNT", amountOff: "20,50" })).toMatchObject({ discountValue: 2050 });
  });

  it("erros no campo certo", () => {
    const issues = (input: Record<string, unknown>) =>
      couponFormSchema.safeParse(input).error?.issues.map((issue) => issue.path.join(".")) ?? [];
    expect(issues({ ...base, percentOff: "0" })).toEqual(["percentOff"]);
    expect(issues({ ...base, percentOff: "12,5" })).toEqual(["percentOff"]);
    expect(issues({ ...base, discountType: "AMOUNT", amountOff: "abc" })).toEqual(["amountOff"]);
    expect(issues({ ...base, appliesToProducts: undefined })).toEqual(["appliesToProducts"]);
    expect(issues({ ...base, startsOn: "2026-10-10", endsOn: "2026-10-01" })).toEqual(["endsOn"]);
    expect(issues({ ...base, code: "a!" })).toEqual(["code"]);
    expect(issues({ ...base, maxRedemptions: "0" })).toEqual(["maxRedemptions"]);
  });
});
