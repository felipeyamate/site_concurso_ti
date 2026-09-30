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

/** Até quantos minutos depois de criar a conta o aceite vale como "no cadastro". */
export const SIGN_UP_CONSENT_MINUTES = 10;

/**
 * O aceite marcado no formulário de cadastro, gravado logo depois de a conta nascer.
 * Só vale para uma conta criada há até 10 minutos, com E-MAIL E SENHA (o único cadastro que tem a
 * caixa "Li e aceito"), que nunca aceitou nada: a ação pode ser chamada direto por HTTP, e o registro
 * "no cadastro" não pode aparecer para quem nunca viu a caixa. Quem entrou pelo Google, pelo link
 * mágico ou tem uma conta antiga passa pela tela /aceitar-termos. Devolve se gravou.
 */
export async function recordSignUpConsent(input: { userId: string; ipAddress: string | null; userAgent: string | null; now?: Date }): Promise<boolean> {
  const now = input.now ?? new Date();
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { createdAt: true, legalVersion: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
  });
  if (!user || user.legalVersion !== null || user.accounts.length === 0) return false;
  if (now.getTime() - user.createdAt.getTime() > SIGN_UP_CONSENT_MINUTES * 60 * 1000) return false;
  await recordLegalConsent({ ...input, source: "SIGN_UP", now });
  return true;
}

