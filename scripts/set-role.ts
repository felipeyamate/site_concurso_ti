/**
 * set-role.ts — Muda o perfil (role) de um usuário pela linha de comando.
 *
 * Quem chama: você, no terminal. Uso:
 *   npm run user:set-role -- email@exemplo.com ADMIN
 *   npm run user:set-role -- email@exemplo.com TEACHER
 *   npm run user:set-role -- email@exemplo.com STUDENT
 *
 * Por que um script: o perfil não pode ser escolhido no cadastro (senão qualquer pessoa
 * viraria ADMIN). O primeiro administrador é criado assim: cadastre-se normalmente no site
 * e depois rode este script com o seu e-mail.
 *
 * Qual banco ele altera: o da DATABASE_URL do `.env.local` (ou das variáveis do terminal).
 * Cuidado ao rodar apontando para o banco de produção.
 *
 * Paralelo em Python: é como um `manage.py` command do Django.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { ROLES, isRole } from "../src/modules/auth/roles";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

async function main(): Promise<void> {
  // process.argv é como o sys.argv do Python: [node, script, arg1, arg2, ...]
  const [emailArg, roleArg] = process.argv.slice(2);

  if (!emailArg || !roleArg) {
    console.error("Uso: npm run user:set-role -- <email> <perfil>");
    console.error(`Perfis válidos: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const role = roleArg.toUpperCase();
  if (!isRole(role)) {
    console.error(`Perfil inválido: "${roleArg}". Use um destes: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL não encontrada. Configure o arquivo .env.local.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const email = emailArg.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`Nenhum usuário com o e-mail ${email}. A pessoa já se cadastrou no site?`);
      process.exitCode = 1;
      return;
    }

    await prisma.user.update({ where: { id: user.id }, data: { role } });
    console.info(`Pronto: ${email} agora tem o perfil ${role} (antes: ${user.role}).`);
  } finally {
    // Fecha as conexões com o banco (senão o script fica "pendurado").
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
