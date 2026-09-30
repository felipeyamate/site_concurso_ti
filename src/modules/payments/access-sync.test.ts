/**
 * access-sync.test.ts — Testes do recálculo das matrículas pagas (compra e assinatura).
 * Estas regras decidem quem tem acesso depois de cada pagamento, reembolso ou contestação.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  computePurchaseAccess,
  computeSubscriptionAccess,
  computeSubscriptionTargets,
  planAccessChanges,
  type ExistingAccessRow,
} from "./access-sync";

const DAY = 24 * 60 * 60 * 1000;
const JAN_1 = new Date("2026-01-01T12:00:00Z");
const at = (days: number) => new Date(JAN_1.getTime() + days * DAY);

describe("computePurchaseAccess (compras avulsas)", () => {
  it("uma compra: do pagamento até pagamento + dias; sem dias = sem data de fim", () => {
    const access = computePurchaseAccess([
      { paidAt: JAN_1, accessDays: 365, courseIds: ["base"] },
      { paidAt: JAN_1, accessDays: null, courseIds: ["bonus"] },
    ]);
    expect(access.get("base")).toEqual({ startsAt: JAN_1, expiresAt: at(365) });
    expect(access.get("bonus")).toEqual({ startsAt: JAN_1, expiresAt: null });
  });

  it("recomprar com o acesso ativo SOMA os dias (a ordem de chegada não importa)", () => {
    const orders = [
      { paidAt: at(100), accessDays: 365, courseIds: ["base"] },
      { paidAt: JAN_1, accessDays: 365, courseIds: ["base"] },
    ];
    expect(computePurchaseAccess(orders).get("base")).toEqual({ startsAt: JAN_1, expiresAt: at(730) });
  });

  it("recomprar depois de vencido recomeça do dia do pagamento", () => {
    const orders = [
      { paidAt: JAN_1, accessDays: 30, courseIds: ["base"] },
      { paidAt: at(60), accessDays: 30, courseIds: ["base"] },
    ];
    expect(computePurchaseAccess(orders).get("base")).toEqual({ startsAt: at(60), expiresAt: at(90) });
  });

  it("um pacote libera cada curso; o reembolso de UMA compra é só tirá-la da lista", () => {
    const pack = { paidAt: JAN_1, accessDays: 365, courseIds: ["base", "bb"] };
    const renewal = { paidAt: at(10), accessDays: 365, courseIds: ["base"] };
    expect(computePurchaseAccess([pack, renewal]).get("base")?.expiresAt).toEqual(at(730));
    // Renovação estornada: volta a valer só a 1ª compra.
    expect(computePurchaseAccess([pack]).get("base")?.expiresAt).toEqual(at(365));
    expect(computePurchaseAccess([]).size).toBe(0);
  });
});

describe("computeSubscriptionAccess (ciclos pagos)", () => {
  const dueDate = (date: string) => new Date(`${date}T00:00:00Z`);

  it("sem ciclo pago: nada", () => {
    expect(computeSubscriptionAccess([])).toBeNull();
  });

  it("do 1º pagamento até o fim do ciclo pago mais distante (+ tolerância)", () => {
    const period = computeSubscriptionAccess([
      { paidAt: new Date("2026-10-01T15:00:00Z"), dueDate: dueDate("2026-10-01"), cycle: "MONTHLY", canceled: false },
      { paidAt: new Date("2026-11-01T15:00:00Z"), dueDate: dueDate("2026-11-01"), cycle: "MONTHLY", canceled: false },
    ]);
    expect(period).toEqual({
      startsAt: new Date("2026-10-01T15:00:00Z"),
      expiresAt: new Date("2026-12-07T02:59:59.999Z"), // fim do dia 06/12 em Brasília
    });
  });

  it("pagar um ciclo atrasado não empurra o calendário (vale até o fim daquele ciclo)", () => {
    const period = computeSubscriptionAccess([
      { paidAt: new Date("2026-10-20T15:00:00Z"), dueDate: dueDate("2026-10-01"), cycle: "MONTHLY", canceled: false },
    ]);
    expect(period?.expiresAt).toEqual(new Date("2026-11-07T02:59:59.999Z"));
  });

  it("assinatura cancelada: o período pago continua, mas sem os 5 dias de tolerância", () => {
    const period = computeSubscriptionAccess([
      { paidAt: new Date("2026-10-01T15:00:00Z"), dueDate: dueDate("2026-10-01"), cycle: "MONTHLY", canceled: true },
    ]);
    expect(period?.expiresAt).toEqual(new Date("2026-11-01T02:59:59.999Z")); // fim do dia 31/10 em Brasília
  });
});

describe("computeSubscriptionTargets (quais cursos a assinatura libera)", () => {
  const period = { startsAt: JAN_1, expiresAt: at(35) };
  const row = (courseId: string, expiresAt: Date | null, revokedAt: Date | null = null): ExistingAccessRow => ({
    courseId,
    startsAt: JAN_1,
    expiresAt,
    revokedAt,
  });

  it("todos os cursos incluídos ganham o período da assinatura", () => {
    const targets = computeSubscriptionTargets({ period, includedCourseIds: ["a", "b"], existingRows: [] });
    expect([...targets.keys()]).toEqual(["a", "b"]);
    expect(targets.get("a")).toEqual(period);
  });

  it("curso que saiu da assinatura: fica até o fim do que já tinha, sem ganhar mais tempo", () => {
    const targets = computeSubscriptionTargets({
      period: { startsAt: JAN_1, expiresAt: at(65) }, // um novo ciclo foi pago
      includedCourseIds: ["a"],
      existingRows: [row("antigo", at(35)), row("revogado", at(35), at(1))],
    });
    expect(targets.get("antigo")).toEqual({ startsAt: JAN_1, expiresAt: at(35) });
    expect(targets.has("revogado")).toBe(false);
  });

  it("sem ciclo pago válido (estorno): nenhum curso", () => {
    expect(computeSubscriptionTargets({ period: null, includedCourseIds: ["a"], existingRows: [row("a", at(35))] }).size).toBe(0);
  });
});

describe("planAccessChanges (só grava o que mudou)", () => {
  const period = { startsAt: JAN_1, expiresAt: at(365) };

  it("cria o que falta, atualiza o que mudou e revoga o que não vale mais", () => {
    const existing: ExistingAccessRow[] = [
      { courseId: "igual", ...period, revokedAt: null },
      { courseId: "mudou", startsAt: JAN_1, expiresAt: at(30), revokedAt: null },
      { courseId: "estornado", ...period, revokedAt: null },
      { courseId: "ja-revogado", ...period, revokedAt: at(2) },
    ];
    const targets = new Map([
      ["igual", period],
      ["mudou", period],
      ["novo", period],
    ]);
    const changes = planAccessChanges(existing, targets);
    expect(changes.upserts.map((item) => item.courseId)).toEqual(["mudou", "novo"]);
    expect(changes.revokes).toEqual(["estornado"]);
  });

  it("volta a liberar uma matrícula revogada que voltou a valer (ex.: contestação revertida)", () => {
    const existing: ExistingAccessRow[] = [{ courseId: "a", ...period, revokedAt: at(5) }];
    expect(planAccessChanges(existing, new Map([["a", period]])).upserts).toHaveLength(1);
  });

  it("recalcular sem novidade não muda nada (idempotente)", () => {
    const existing: ExistingAccessRow[] = [{ courseId: "a", ...period, revokedAt: null }];
    expect(planAccessChanges(existing, new Map([["a", period]]))).toEqual({ upserts: [], revokes: [] });
  });
});
