/**
 * cron-auth.test.ts — Testes da conferência das tarefas agendadas.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "./cron-auth";

describe("isAuthorizedCronRequest", () => {
  const SECRET = "segredo-das-tarefas-123";

  it("aceita só o cabeçalho exato", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
  });

  it("sem o segredo configurado, recusa tudo", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
  });
});
