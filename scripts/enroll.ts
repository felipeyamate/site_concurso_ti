/**
 * enroll.ts — Matricula (ou desmatricula) um aluno em um curso pela linha de comando.
 *
 * Quem chama: você, no terminal. Uso:
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero          (sem data de fim)
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero 365      (acesso por 365 dias)
 *   npm run enroll -- aluno@exemplo.com informatica-e-ti-do-zero --revogar (cancela o acesso)
 *
 * Por que existe: até a Fase 4 (pagamentos), é assim que liberamos cursos (cortesia, testes).
 * Depois, o pagamento confirmado cria a matrícula sozinho.
 *
 * Regras: uma matrícula por aluno e curso. Rodar de novo RENOVA a mesma matrícula:
 *  - se ela está ativa, os dias novos são SOMADOS ao que faltava (ninguém perde dias);
 *  - se venceu ou foi revogada, recomeça agora;
 *  - a origem (MANUAL, compra, assinatura) de uma matrícula existente é mantida.
 * A regra fica em `src/modules/enrollment/renewal.ts` (a mesma que os pagamentos usarão na Fase 4).
 * Revogar não apaga a linha: marca `revokedAt`, para ficar o histórico.
 */
import { computeEnrollmentRenewal } from "../src/modules/enrollment/renewal";
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
      const { count } = await prisma.enrollment.updateMany({
        where: { userId: user.id, courseId: course.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      console.info(count ? `Acesso de ${email} a "${course.title}" revogado.` : "Não havia matrícula ativa.");
      return;
    }

    const where = { userId_courseId: { userId: user.id, courseId: course.id } };
    const existing = await prisma.enrollment.findUnique({
      where,
      select: { startsAt: true, expiresAt: true, revokedAt: true },
    });
    const period = computeEnrollmentRenewal(existing, { days, now: new Date() });

    // upsert = cria se não existe; se existe, renova (como o `update_or_create` do Django).
    // Na renovação, a origem (`source`) não é alterada.
    await prisma.enrollment.upsert({
      where,
      create: { userId: user.id, courseId: course.id, source: "MANUAL", ...period },
      update: { ...period, revokedAt: null },
    });
    const until = period.expiresAt ? `até ${period.expiresAt.toLocaleDateString("pt-BR")}` : "sem data de fim";
    const action = existing ? "Matrícula renovada" : "Matriculado";
    console.info(`Pronto: ${action} — ${email} em "${course.title}" (${until}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
