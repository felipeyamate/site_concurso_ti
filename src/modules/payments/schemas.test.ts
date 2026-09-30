/**
 * schemas.test.ts — Validação dos formulários de venda (checkout e painel).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { checkoutSchema, formDataWithLists, updateProductSchema } from "./schemas";

const validCheckout = {
  productSlug: "curso-base",
  method: "PIX",
  installments: "1",
  cpf: "529.982.247-25",
  phone: "(11) 91234-5678",
  acceptTerms: "on",
};

describe("checkoutSchema", () => {
  it("limpa o CPF e o celular (só dígitos)", () => {
    const parsed = checkoutSchema.parse(validCheckout);
    expect(parsed).toMatchObject({ cpf: "52998224725", phone: "11912345678", installments: 1, method: "PIX" });
    expect(checkoutSchema.parse({ ...validCheckout, phone: "" }).phone).toBeNull();
  });

  it("recusa CPF inválido, celular incompleto, forma de pagamento desconhecida e termos não aceitos", () => {
    const fieldsWithError = (input: Record<string, unknown>) => {
      const result = checkoutSchema.safeParse(input);
      return result.success ? [] : result.error.issues.map((issue) => String(issue.path[0]));
    };
    expect(fieldsWithError({ ...validCheckout, cpf: "111.111.111-11" })).toEqual(["cpf"]);
    expect(fieldsWithError({ ...validCheckout, phone: "1234" })).toEqual(["phone"]);
    expect(fieldsWithError({ ...validCheckout, method: "DINHEIRO" })).toEqual(["method"]);
    const { acceptTerms, ...withoutTerms } = validCheckout;
    expect(acceptTerms).toBe("on");
    expect(fieldsWithError(withoutTerms)).toEqual(["acceptTerms"]);
  });

  it("parcelas fora do limite viram à vista (o servidor confere de novo contra o produto)", () => {
    expect(checkoutSchema.parse({ ...validCheckout, installments: "99" }).installments).toBe(1);
  });
});

describe("formulário de produto (painel)", () => {
  it("lê as caixas marcadas como lista, o preço em centavos e dias vazios como 'sem data de fim'", () => {
    const formData = new FormData();
    formData.set("productId", "p1");
    formData.set("title", "Curso Base — 12 meses");
    formData.set("slug", "curso-base-12-meses");
    formData.set("description", "");
    formData.set("price", "1.297,90");
    formData.set("accessDays", "");
    formData.set("maxInstallments", "12");
    formData.append("courseIds", "c1");
    formData.append("courseIds", "c2");

    const parsed = updateProductSchema.parse(formDataWithLists(formData, ["courseIds"]));
    expect(parsed).toMatchObject({ price: 129790, accessDays: null, maxInstallments: 12, isActive: false, courseIds: ["c1", "c2"] });
  });

  it("nenhuma caixa marcada = lista vazia; preço inválido é recusado", () => {
    const formData = new FormData();
    formData.set("price", "abc");
    expect(formDataWithLists(formData, ["courseIds"])).toEqual({ price: "abc", courseIds: [] });
    const result = updateProductSchema.safeParse({ ...formDataWithLists(formData, ["courseIds"]), productId: "p", title: "Nome", slug: "nome", description: "", maxInstallments: "1" });
    expect(result.success).toBe(false);
  });
});
