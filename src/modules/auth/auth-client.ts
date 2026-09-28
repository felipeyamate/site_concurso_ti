/**
 * auth-client.ts — Cliente de autenticação para o NAVEGADOR (componentes "use client").
 *
 * Quem chama: os formulários de login/cadastro/senha em `src/modules/auth/components/`.
 * O que devolve: `authClient`, com funções prontas que chamam a nossa API `/api/auth/...`:
 *   authClient.signIn.email(...), authClient.signUp.email(...), authClient.signIn.magicLink(...),
 *   authClient.signIn.social(...), authClient.requestPasswordReset(...), authClient.signOut() etc.
 *
 * Não tem segredo nenhum aqui: tudo roda no navegador do aluno. As regras de verdade
 * (senha, limite de sessões, perfis) são aplicadas no servidor, em `auth.ts`.
 */
import { inferAdditionalFields, magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// `import type` traz só os TIPOS de `auth.ts` (nenhum código de servidor vai para o navegador).
import type { auth } from "./auth";

export const authClient = createAuthClient({
  // Sem `baseURL`: o cliente usa o mesmo endereço do site aberto no navegador.
  plugins: [
    // Faz o TypeScript saber que o usuário tem o campo extra `role`.
    inferAdditionalFields<typeof auth>(),
    magicLinkClient(),
  ],
});
