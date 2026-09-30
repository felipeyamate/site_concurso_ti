/**
 * consent.server.ts — Grava o aceite dos Termos de uso e da Política de privacidade (LGPD).
 *
 * Quem chama: as ações de `actions.ts` — logo depois do cadastro (caixa marcada no formulário) e
 * na tela de aceite (/aceitar-termos). Os testes de integração chamam direto.
 * O que faz: numa transação, cria a linha do histórico (`legal_consents`, que nunca é apagada) e
 * marca no usuário a versão aceita (é o que a área logada confere a cada página).
 *
 * Por que guardar IP e navegador: a LGPD (art. 8º, § 2º) diz que cabe a quem coleta os dados
 * provar que houve consentimento. Data, versão do texto, IP e navegador são essa prova.
 */
import "server-only";

import type { ConsentSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { LEGAL_VERSION } from "@/modules/legal/version";

/**
 * IP e navegador de quem fez a requisição, lidos dos cabeçalhos.
 * Na Vercel, o IP real do visitante vem em `x-forwarded-for` (o primeiro da lista); o resto são
 * os servidores do caminho. Limitamos o tamanho para um cabeçalho gigante não ir para o banco.
 */
export function requestMetadata(headers: Headers): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = (forwarded || headers.get("x-real-ip") || "").slice(0, 100) || null;
  const userAgent = (headers.get("user-agent") ?? "").slice(0, 500) || null;
  return { ipAddress, userAgent };
}

/**
 * Registra que a pessoa aceitou a versão ATUAL dos textos.
 * Se ela já tinha aceitado esta mesma versão, não duplica (ex.: duplo clique no botão).
 */
export async function recordLegalConsent(input: {
  userId: string;
  source: ConsentSource;
  ipAddress: string | null;
  userAgent: string | null;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    // `updateMany` com a condição "ainda não aceitou esta versão": conferência e gravação num
    // comando só (dois cliques ao mesmo tempo gravam UM aceite; o segundo encontra 0 linhas).
    const { count } = await tx.user.updateMany({
      where: { id: input.userId, deletedAt: null, OR: [{ legalVersion: null }, { legalVersion: { not: LEGAL_VERSION } }] },
      data: { legalVersion: LEGAL_VERSION },
    });
    if (count === 0) return;
    await tx.legalConsent.create({
      data: {
        userId: input.userId,
        version: LEGAL_VERSION,
        source: input.source,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        acceptedAt: now,
      },
    });
  });
}

/** Os aceites da pessoa (mais recente primeiro) — a página "Minha conta e privacidade" mostra. */
export async function listLegalConsents(userId: string) {
  return prisma.legalConsent.findMany({
    where: { userId },
    orderBy: { acceptedAt: "desc" },
    select: { id: true, version: true, source: true, acceptedAt: true },
  });
}
