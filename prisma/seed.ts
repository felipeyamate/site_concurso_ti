/**
 * seed.ts — Preenche o banco com dados de EXEMPLO para desenvolvimento.
 *
 * Quem chama: você, com `npm run db:seed`.
 * O que faz: grava o catálogo de exemplo (ver `seed-catalog.ts`). Pode rodar várias vezes.
 *
 * Não rode no banco de produção: o conteúdo real entra pelo painel admin (Fase 3).
 */
import { createScriptPrismaClient } from "../scripts/script-db";

import { seedCatalog } from "./seed-catalog";

async function main(): Promise<void> {
  // Trava de segurança: dados de exemplo nunca vão para o site de produção.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    console.error("O seed de exemplo não roda em produção (NODE_ENV/VERCEL_ENV = production).");
    process.exit(1);
  }
  const prisma = createScriptPrismaClient();
  try {
    const result = await seedCatalog(prisma);
    console.info(
      `Pronto: ${result.courses} curso(s), ${result.modules} módulo(s) e ${result.lessons} aula(s) gravados.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
