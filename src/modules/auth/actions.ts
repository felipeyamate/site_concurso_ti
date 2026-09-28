/**
 * actions.ts — "Server Actions" da área de contas: funções do servidor chamadas por botões.
 *
 * Quem chama: o botão "Desconectar" da lista de dispositivos (`components/session-list.tsx`).
 * O que devolve: `{ ok: true }` ou `{ ok: false, error: "mensagem" }`.
 *
 * O que é uma Server Action: uma função marcada com "use server" que roda no servidor,
 * mas pode ser chamada direto de um componente do navegador (o Next.js cria a requisição
 * HTTP por baixo dos panos). Como qualquer pessoa pode chamá-la, SEMPRE:
 *   1. validamos a entrada;  2. conferimos quem está logado;  3. conferimos a permissão.
 */
"use server";

import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db";

import { getCurrentSession } from "./session";

type ActionResult = { ok: true } | { ok: false; error: string };

const revokeInputSchema = z.string().min(1).max(200);

/**
 * Desconecta um dos OUTROS dispositivos do usuário logado.
 *
 * Passos:
 *  1. Valida o ID recebido.
 *  2. Confere que há alguém logado.
 *  3. Não deixa remover a sessão atual por aqui (para isso existe o botão "Sair").
 *  4. Apaga a sessão SOMENTE se ela pertencer ao usuário logado (filtro por userId).
 *  5. Pede ao Next.js para recarregar a lista na tela.
 */
export async function revokeOtherSessionAction(sessionId: string): Promise<ActionResult> {
  const parsed = revokeInputSchema.safeParse(sessionId);
  if (!parsed.success) {
    return { ok: false, error: "Dispositivo inválido." };
  }

  const current = await getCurrentSession();
  if (!current) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };
  }

  if (parsed.data === current.session.id) {
    return { ok: false, error: "Para sair deste dispositivo, use o botão Sair." };
  }

  await prisma.session.deleteMany({
    where: { id: parsed.data, userId: current.user.id },
  });

  revalidatePath("/area-do-aluno");
  return { ok: true };
}
