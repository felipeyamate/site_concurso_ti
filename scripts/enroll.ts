/**
 * enroll.ts — Matricula (ou desmatricula) um aluno em um curso pela linha de comando.
 *
 * Quem chama: você, no terminal. Uso:
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero          (sem data de fim)
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero 365      (acesso por 365 dias)
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero --revogar (cancela o acesso)
 *
 * Por que existe: matrículas MANUAIS (cortesia, testes, suporte). O jeito mais fácil é o painel
 * (/admin/usuarios → aluno → "Matricular"); este script faz o mesmo pelo terminal. Compras e
 * assinaturas (Fase 4) liberam o acesso sozinhas, quando o pagamento é confirmado.
 *
 * Regras: uma matrícula MANUAL por aluno e curso. Rodar de novo RENOVA a mesma matrícula:
 *  - se ela está ativa, os dias novos são SOMADOS ao que faltava (ninguém perde dias);
 *  - se venceu ou foi revogada, recomeça agora.
 * `--revogar` cancela só o acesso manual (um acesso comprado sai pelo reembolso, no painel).
 * As regras ficam em `src/modules/enrollment/grant.ts` e `renewal.ts` — as mesmas do painel.
 * Revogar não apaga a linha: marca `revokedAt`, para ficar o histórico.
 */
import { grantEnrollment, revokeEnrollment } from "../src/modules/enrollment/grant";
import { createScriptPrismaClient } from "./script-db";

const USAGE = "Uso: npm run enroll -- <email> <slug-do-curso> [dias | --revogar]";

async function main(): Promise<void> {
  const [emailArg, courseSlug, option] = process.argv.slice(2);
  if (!emailArg || !courseSlug) {
    console.error(USAGE);
    process.exit(1);
  }

  const revoke = option === "--revogar";
  const days = option && !revoke ? Number(option) : null;
  if (days !== null && (!Number.isInteger(days) || days <= 0)) {
    console.error(`Número de dias inválido: "${option}". ${USAGE}`);
    process.exit(1);
  }

  const prisma = createScriptPrismaClient();
  try {
    const email = emailArg.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`Nenhum usuário com o e-mail ${email}. A pessoa já se cadastrou no site?`);
      process.exitCode = 1;
      return;
    }
    const course = await prisma.course.findUnique({ where: { slug: courseSlug } });
    if (!course) {
      console.error(`Curso "${courseSlug}" não encontrado. Rodou o "npm run db:seed"?`);
      process.exitCode = 1;
      return;
    }

    if (revoke) {
      const revoked = await revokeEnrollment(prisma, { userId: user.id, courseId: course.id, now: new Date() });
      console.info(revoked ? `Acesso manual de ${email} a "${course.title}" revogado.` : "Não havia matrícula manual ativa.");
      return;
    }

    const { renewed, period } = await grantEnrollment(prisma, {
      userId: user.id,
      courseId: course.id,
      days,
      now: new Date(),
    });
    const until = period.expiresAt ? `até ${period.expiresAt.toLocaleDateString("pt-BR")}` : "sem data de fim";
    const action = renewed ? "Matrícula renovada" : "Matriculado";
    console.info(`Pronto: ${action} — ${email} em "${course.title}" (${until}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
