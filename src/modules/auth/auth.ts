/**
 * auth.ts — Configuração central da autenticação (Better Auth), no servidor.
 *
 * Quem chama:
 *  - a rota `src/app/api/auth/[...all]/route.ts`, que expõe os endpoints de login/cadastro
 *    (`/api/auth/sign-in/email`, `/api/auth/sign-up/email`, `/api/auth/callback/google` ...);
 *  - `src/modules/auth/session.ts`, que descobre "quem está logado" nas páginas do servidor.
 * O que devolve: o objeto `auth` (e o tipo `AuthSession`).
 *
 * O que está configurado aqui:
 *  1. Onde os dados ficam: no NOSSO PostgreSQL, via Prisma (tabelas users/sessions/accounts...).
 *  2. Formas de login: e-mail + senha, Google (se configurado) e link mágico por e-mail.
 *  3. E-mails: verificação de e-mail, redefinição de senha e link mágico.
 *  4. Perfil (`role`): campo extra no usuário; nasce STUDENT e o usuário não consegue mudá-lo.
 *  5. Limite de sessões: após cada login, remove os logins mais antigos acima do limite.
 *  6. Proteção contra força bruta (rate limit) guardada no banco.
 *
 * Paralelo em Python: é como o `settings.py` do django-allauth — um lugar só com todas as regras.
 */
import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail } from "@/modules/email/send-email";
import {
  magicLinkTemplate,
  resetPasswordTemplate,
  verifyEmailTemplate,
} from "@/modules/email/templates";

import { DEFAULT_ROLE, ROLES } from "./roles";
import { enforceSessionLimit } from "./session-limit.server";

// O login com Google só é ativado se as duas chaves estiverem no .env.
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

export const auth = betterAuth({
  appName: "Concurso TI",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,

  // 1. Banco de dados: o Better Auth lê/grava pelas tabelas definidas em prisma/schema.prisma.
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // 2a. Login com e-mail e senha.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Não exigimos e-mail verificado para entrar (menos atrito no cadastro).
    // Isso pode mudar antes do lançamento — decisão registrada no PROJECT.md.
    requireEmailVerification: false,
    // Ao trocar a senha, todos os outros dispositivos são deslogados (caso a senha tenha vazado).
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...resetPasswordTemplate({ name: user.name, url }) });
    },
  },

  // 3. Verificação de e-mail: enviada logo após o cadastro com senha.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, ...verifyEmailTemplate({ name: user.name, url }) });
    },
  },

  // 2b. Login com Google (só se configurado).
  socialProviders: isGoogleAuthEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID as string,
          clientSecret: env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},

  // 4. Campo extra `role` no usuário.
  user: {
    additionalFields: {
      role: {
        type: [...ROLES],
        required: false,
        defaultValue: DEFAULT_ROLE,
        // `input: false` = ninguém consegue definir o próprio perfil pelo formulário/API
        // (senão qualquer pessoa se cadastraria como ADMIN). Só o banco/script muda isso.
        input: false,
      },
    },
  },

  // Duração do login: 7 dias; renovado automaticamente (1x por dia) enquanto o aluno usa o site.
  session: {
    expiresIn: 7 * ONE_DAY_IN_SECONDS,
    updateAge: ONE_DAY_IN_SECONDS,
  },

  // 6. Limite de tentativas por IP. Fica no banco porque, na Vercel, cada requisição pode
  // cair num servidor diferente (memória não é compartilhada entre eles).
  // Obs.: por padrão o Better Auth só liga o rate limit em produção.
  rateLimit: {
    storage: "database",
    customRules: {
      // Regras mais rígidas nas rotas sensíveis (janela em segundos, máximo de tentativas).
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
    },
  },

  // 5. "Ganchos" do banco: código nosso que roda antes/depois de o Better Auth gravar algo.
  databaseHooks: {
    session: {
      create: {
        // Logo após cada novo login, aplica o limite de dispositivos simultâneos.
        after: async (session) => {
          await enforceSessionLimit(session.userId, session.id);
        },
      },
    },
  },

  plugins: [
    // 2c. Link mágico: o aluno digita o e-mail e recebe um link que faz o login sem senha.
    magicLink({
      expiresIn: 5 * 60,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({ to: email, ...magicLinkTemplate({ url }) });
      },
    }),
    // Permite que Server Actions do Next.js gravem os cookies de login.
    // Precisa ser o ÚLTIMO plugin da lista.
    nextCookies(),
  ],
});

// Tipo da sessão devolvida por `auth.api.getSession` (usuário + dados do login).
export type AuthSession = typeof auth.$Infer.Session;
