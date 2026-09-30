/**
 * rules.test.ts — Testes das regras puras da exclusão de conta (LGPD).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { needsLegalAcceptance, LEGAL_VERSION } from "@/modules/legal/version";

import { anonymizedEmail, deletionBlockers, isDeleteConfirmation, isFreshLogin } from "./rules";

const NOW = new Date("2026-10-01T15:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

describe("versão dos textos legais", () => {
  it("pede o aceite de quem nunca aceitou ou aceitou uma versão antiga", () => {
    expect(needsLegalAcceptance(null)).toBe(true);
    expect(needsLegalAcceptance(undefined)).toBe(true);
    expect(needsLegalAcceptance("2020-01-01")).toBe(true);
    expect(needsLegalAcceptance(LEGAL_VERSION)).toBe(false);
  });
});

describe("exclusão de conta", () => {
  it("frase de confirmação: aceita maiúsculas/minúsculas e espaços a mais; recusa outra frase", () => {
    expect(isDeleteConfirmation("EXCLUIR MINHA CONTA")).toBe(true);
    expect(isDeleteConfirmation("  excluir   minha conta ")).toBe(true);
    expect(isDeleteConfirmation("excluir")).toBe(false);
    expect(isDeleteConfirmation("")).toBe(false);
  });

  it("login recente = até 15 minutos atrás", () => {
    expect(isFreshLogin(minutesAgo(1), NOW)).toBe(true);
    expect(isFreshLogin(minutesAgo(15), NOW)).toBe(true);
    expect(isFreshLogin(minutesAgo(16), NOW)).toBe(false);
    expect(isFreshLogin(new Date(NOW.getTime() + 60_000), NOW)).toBe(false); // relógio no futuro: não confia
  });

  it("e-mail anonimizado: único por conta e num domínio que nunca recebe e-mail", () => {
    expect(anonymizedEmail("AbC123")).toBe("conta-excluida-abc123@excluida.invalid");
    expect(anonymizedEmail("a")).not.toBe(anonymizedEmail("b"));
  });

  it("o que impede excluir: perfil, assinatura ativa, pagamento aguardando; conta já excluída", () => {
    const ok = { role: "STUDENT", deletedAt: null, openSubscriptions: 0, pendingPayments: 0 };
    expect(deletionBlockers(ok)).toEqual([]);
    expect(deletionBlockers({ ...ok, role: "TEACHER" })[0]).toMatch(/professor ou administrador/);
    expect(deletionBlockers({ ...ok, openSubscriptions: 1 })[0]).toMatch(/assinatura ativa/);
    expect(deletionBlockers({ ...ok, pendingPayments: 2 })[0]).toMatch(/pagamento aguardando/);
    expect(deletionBlockers({ ...ok, role: "ADMIN", openSubscriptions: 1, pendingPayments: 1 })).toHaveLength(3);
    expect(deletionBlockers({ ...ok, deletedAt: NOW })).toEqual(["Esta conta já foi excluída."]);
  });
});
