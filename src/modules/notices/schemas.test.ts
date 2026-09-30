/**
 * schemas.test.ts — Formulário de página de edital: datas, link oficial, cupom e assuntos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { noticeSchema } from "./schemas";

const base = {
  title: "Banco do Brasil 2026 — Escriturário",
  slug: "",
  organization: "Banco do Brasil",
  role: "Escriturário",
  boardId: "b1",
  status: "OPEN",
  registrationEndsOn: "2026-11-10",
  examDate: "",
  vacancies: "6.000",
  salary: "R$ 3.622,23",
  summary: "",
  body: "",
  officialUrl: "",
  productId: "",
  planId: "",
  couponCode: " bb10 ",
  subjectIds: ["s1", "s2"],
  isPublished: "on",
};

describe("noticeSchema", () => {
  it("normaliza cupom e vazios; datas como dias", () => {
    expect(noticeSchema.parse(base)).toMatchObject({
      slug: null,
      couponCode: "BB10",
      examDate: null,
      registrationEndsOn: "2026-11-10",
      officialUrl: null,
      productId: null,
      subjectIds: ["s1", "s2"],
      isPublished: true,
    });
  });

  it("link oficial só https e data válida", () => {
    expect(noticeSchema.safeParse({ ...base, officialUrl: "http://site.gov.br/edital" }).success).toBe(false);
    expect(noticeSchema.safeParse({ ...base, officialUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(noticeSchema.safeParse({ ...base, officialUrl: "https://site.gov.br/edital.pdf" }).success).toBe(true);
    expect(noticeSchema.safeParse({ ...base, examDate: "31/12/2026" }).success).toBe(false);
  });
});
