/**
 * access-log.server.ts — Grava o registro de acesso de cada login (Marco Civil da Internet, art. 15).
 *
 * Quem chama: o gancho "login criado" do Better Auth (`databaseHooks.session.create.after`, em
 * `auth/auth.ts`) — vale para e-mail e senha, link mágico e Google. Os testes de integração também.
 * O prazo e a limpeza: `access-log.ts` e `maintenance/cleanup.server.ts` (6 meses).
 *
 * Por que uma tabela própria: o login (sessão) já tem IP e navegador, mas ele some quando a pessoa sai,
 * quando o limite de 2 dispositivos derruba o mais antigo ou quando vence. O Marco Civil obriga quem
 * mantém um site com fins comerciais a guardar data, hora e IP de cada acesso por 6 meses (para
 * entregar à Justiça, só com ordem judicial). Então guardamos uma cópia com prazo certo para sumir.
 */
import "server-only";

import { prisma } from "@/lib/db";

import { limitRequestMetadata } from "./request-metadata";

/**
 * Grava um acesso. Uma falha aqui NÃO impede o login (o aluno entra do mesmo jeito): o erro vai
 * para o log (e para o Sentry, quando configurado) para alguém olhar.
 */
export async function recordAccessLog(input: { userId: string; ipAddress?: string | null; userAgent?: string | null; at?: Date }): Promise<void> {
  try {
    await prisma.accessLog.create({
      // Mesmos limites de tamanho do registro de aceite: um cabeçalho gigante não vai para o banco.
      data: { userId: input.userId, ...limitRequestMetadata(input), createdAt: input.at ?? new Date() },
    });
  } catch (error) {
    console.error("[registro de acesso] Falha ao gravar o acesso do usuário", input.userId, error);
  }
}
