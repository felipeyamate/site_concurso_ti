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

    // Esta verificação roda SEMPRE (mesmo se o cadastro tiver sido recusado):
    // o banco começou vazio, então não pode existir nenhum ADMIN.
    expect(await prisma.user.count({ where: { role: "ADMIN" } })).toBe(0);

    // Comportamento atual do Better Auth: ignora o campo e cria a conta como aluno.
    const user = await prisma.user.findUnique({ where: { email: "hacker@exemplo.com" } });
    expect(user?.role).toBe("STUDENT");
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

// Pede um link mágico e "clica" nele, pegando o token direto do banco (no lugar do e-mail).
async function signInWithMagicLink(email: string) {
  await auth.api.signInMagicLink({ body: { email }, headers: new Headers() });
  const verification = await prisma.verification.findFirstOrThrow({
    where: { NOT: { identifier: { startsWith: "reset-password:" } } },
    orderBy: { createdAt: "desc" },
  });
  return auth.api.magicLinkVerify({ query: { token: verification.identifier }, headers: new Headers() });
}

describe("link mágico", () => {
  it("quem se cadastra pelo link ganha um nome tirado do e-mail (nunca vazio)", async () => {
    await signInWithMagicLink("maria.silva@exemplo.com");
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "maria.silva@exemplo.com" } });
    expect(user.name).toBe("Maria Silva");
    expect(user.emailVerified).toBe(true); // clicar no link prova que o e-mail é da pessoa
  });

  it("em conta com e-mail NÃO confirmado, remove a senha antiga (proteção) e 'Esqueci minha senha' recupera", async () => {
    // Por que o Better Auth faz isso: alguém poderia se cadastrar com o e-mail de outra pessoa
    // antes dela. Quando o dono de verdade prova o e-mail (pelo link), a senha "não provada" some.
    const email = "nao.confirmado@exemplo.com";
    await signUp(email);
    await signInWithMagicLink(email);

    await expect(signIn(email)).rejects.toThrow(); // a senha antiga não vale mais
    expect(await prisma.account.count({ where: { user: { email }, providerId: "credential" } })).toBe(0);

    // Recuperação: pedir redefinição cria uma senha nova.
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/redefinir-senha" } });
    const reset = await prisma.verification.findFirstOrThrow({
      where: { identifier: { startsWith: "reset-password:" } },
    });
    const token = reset.identifier.replace("reset-password:", "");
    await auth.api.resetPassword({ body: { token, newPassword: "novaSenha456" } });

    await expect(
      auth.api.signInEmail({ body: { email, password: "novaSenha456" } }),
    ).resolves.toBeTruthy();
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
