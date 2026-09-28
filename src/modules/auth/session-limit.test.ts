/**
 * session-limit.test.ts — Testes da regra de limite de dispositivos simultâneos.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { selectSessionsToRevoke, type SessionSummary } from "./session-limit";

const NOW = new Date("2026-09-28T12:00:00Z");
const FUTURE = new Date("2026-10-05T12:00:00Z");
const PAST = new Date("2026-09-27T12:00:00Z");

// Cria uma sessão de exemplo com "minutesAgo" minutos de idade.
function session(id: string, minutesAgo: number, expiresAt: Date = FUTURE): SessionSummary {
  return { id, createdAt: new Date(NOW.getTime() - minutesAgo * 60_000), expiresAt };
}

describe("selectSessionsToRevoke", () => {
  it("não remove nada quando está dentro do limite", () => {
    const sessions = [session("a", 30), session("new", 0)];
    expect(selectSessionsToRevoke(sessions, { maxActiveSessions: 2, now: NOW, keepSessionId: "new" })).toEqual([]);
  });

  it("remove a sessão mais antiga quando passa do limite", () => {
    const sessions = [session("oldest", 90), session("middle", 30), session("new", 0)];
    expect(selectSessionsToRevoke(sessions, { maxActiveSessions: 2, now: NOW, keepSessionId: "new" })).toEqual([
      "oldest",
    ]);
  });

  it("remove várias antigas de uma vez, se necessário", () => {
    const sessions = [session("s1", 300), session("s2", 200), session("s3", 100), session("new", 0)];
    const revoked = selectSessionsToRevoke(sessions, { maxActiveSessions: 2, now: NOW, keepSessionId: "new" });
    expect(revoked.sort()).toEqual(["s1", "s2"]);
  });

  it("nunca remove a sessão recém-criada, mesmo com horários empatados", () => {
    const sameTime = [session("x", 0), session("y", 0), session("new", 0)];
    const revoked = selectSessionsToRevoke(sameTime, { maxActiveSessions: 1, now: NOW, keepSessionId: "new" });
    expect(revoked).not.toContain("new");
    expect(revoked).toHaveLength(2);
  });

  it("sessões expiradas são removidas e não contam no limite", () => {
    const sessions = [session("expired", 10_000, PAST), session("active", 30), session("new", 0)];
    expect(selectSessionsToRevoke(sessions, { maxActiveSessions: 2, now: NOW, keepSessionId: "new" })).toEqual([
      "expired",
    ]);
  });

  it("com limite 1, só a sessão nova sobrevive", () => {
    const sessions = [session("a", 60), session("b", 30), session("new", 0)];
    const revoked = selectSessionsToRevoke(sessions, { maxActiveSessions: 1, now: NOW, keepSessionId: "new" });
    expect(revoked.sort()).toEqual(["a", "b"]);
  });
});
