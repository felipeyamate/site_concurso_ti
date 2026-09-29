/**
 * role-rules.test.ts — Testes das travas para mudar o perfil de alguém pelo painel.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { checkRoleChange } from "./role-rules";

describe("checkRoleChange", () => {
  const base = { actorId: "admin-1", targetId: "user-2", currentRole: "STUDENT", newRole: "TEACHER", otherAdminCount: 1 } as const;

  it("permite promover e rebaixar outras pessoas", () => {
    expect(checkRoleChange(base)).toBeNull();
    expect(checkRoleChange({ ...base, currentRole: "ADMIN", newRole: "STUDENT", otherAdminCount: 1 })).toBeNull();
  });

  it("não deixa mudar o próprio perfil", () => {
    expect(checkRoleChange({ ...base, targetId: "admin-1" })).toMatch(/próprio perfil/);
  });

  it("não deixa o site ficar sem administrador", () => {
    expect(checkRoleChange({ ...base, currentRole: "ADMIN", newRole: "TEACHER", otherAdminCount: 0 })).toMatch(
      /única conta de administrador/,
    );
  });
});
