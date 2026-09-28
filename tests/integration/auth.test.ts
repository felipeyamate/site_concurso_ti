/**
 * auth.test.ts — Testes de integração da autenticação (com PostgreSQL de verdade).
 *
 * Rodar: npm run test:integration   (exige TEST_DATABASE_URL — ver README)
 *
 * Diferente dos testes unitários, aqui chamamos o Better Auth "de verdade"
 * (`auth.api.*` executa o mesmo código que roda quando o navegador chama /api/auth/*)
 * e conferimos o que ficou gravado no banco.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { auth } from "@/modules/auth/auth";
import { MAX_ACTIVE_SESSIONS } from "@/modules/auth/session-limit";
import { enforceSessionLimit } from "@/modules/auth/session-limit.server";

const PASSWORD = "senhaForte123";

// Começa cada teste com o banco de teste limpo (apagar usuários apaga sessões e contas junto).
beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.rateLimit.deleteMany();
});

function signUp(email: string) {
  return auth.api.signUpEmail({ body: { name: "Aluno Teste", email, password: PASSWORD } });
}

function signIn(email: string) {
  return auth.api.signInEmail({ body: { email, password: PASSWORD } });
}

describe("cadastro", () => {
  it("todo cadastro novo nasce com o perfil STUDENT", async () => {
    await signUp("novo@exemplo.com");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "novo@exemplo.com" } });
    expect(user.role).toBe("STUDENT");
    expect(user.emailVerified).toBe(false);
  });

  it("não deixa a pessoa escolher o próprio perfil no cadastro", async () => {
    // Simula alguém mandando "role: ADMIN" direto para a API (fora do formulário).
    // O Better Auth pode recusar o pedido ou ignorar o campo; o que importa é que
    // ninguém vire ADMIN. Por isso o `.catch` e a checagem no banco logo depois.
    await auth.api
      .signUpEmail({
        body: { name: "Espertinho", email: "hacker@exemplo.com", password: PASSWORD, role: "ADMIN" } as never,
      })
      .catch(() => null);

    const user = await prisma.user.findUnique({ where: { email: "hacker@exemplo.com" } });
    if (user) {
      expect(user.role).toBe("STUDENT");
    }
  });

  it("guarda a senha só como hash, nunca em texto puro", async () => {
    await signUp("hash@exemplo.com");
    const account = await prisma.account.findFirstOrThrow({
      where: { user: { email: "hash@exemplo.com" }, providerId: "credential" },
    });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toContain(PASSWORD);
  });
});

describe("login", () => {
  it("recusa senha errada", async () => {
    await signUp("login@exemplo.com");
    await expect(
      auth.api.signInEmail({ body: { email: "login@exemplo.com", password: "senhaErrada999" } }),
    ).rejects.toThrow();
  });
});

describe("limite de sessões", () => {
  it(`mantém no máximo ${MAX_ACTIVE_SESSIONS} dispositivos: o login mais antigo é derrubado`, async () => {
    const email = "limite@exemplo.com";
    const first = await signUp(email); // o cadastro já faz o 1º login
    const second = await signIn(email);
    const third = await signIn(email);

    const sessions = await prisma.session.findMany({ where: { user: { email } } });
    const tokens = sessions.map((item) => item.token);

    expect(sessions).toHaveLength(MAX_ACTIVE_SESSIONS);
    expect(tokens).not.toContain(first.token); // o mais antigo saiu
    expect(tokens).toContain(second.token);
    expect(tokens).toContain(third.token); // o mais novo sempre fica
  });

  it("apaga sessões vencidas e nunca mexe nas sessões de outra pessoa", async () => {
    await signUp("dono@exemplo.com");
    await signUp("outra@exemplo.com");
    const owner = await prisma.user.findUniqueOrThrow({ where: { email: "dono@exemplo.com" } });
    const newest = await prisma.session.findFirstOrThrow({ where: { userId: owner.id } });

    await prisma.session.create({
      data: {
        id: "sessao-vencida",
        token: "token-vencido",
        userId: owner.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const removed = await enforceSessionLimit(owner.id, newest.id);

    expect(removed).toBe(1);
    expect(await prisma.session.findUnique({ where: { id: "sessao-vencida" } })).toBeNull();
    expect(await prisma.session.count({ where: { user: { email: "outra@exemplo.com" } } })).toBe(1);
  });
});
