/**
 * route.ts — "O site está de pé?": /api/health  (público)
 *
 * Quem chama: um serviço de monitoramento (ex.: UptimeRobot, Better Stack) a cada poucos minutos,
 * e você, depois de um deploy. Responde 200 {"status":"ok"} se o site E o banco respondem; 503 se o
 * banco não responde (o monitor avisa você). Não mostra nenhum detalhe interno.
 * `await connection()`: resposta montada a cada pedido (nunca guardada no build).
 */
import "server-only";

import { connection } from "next/server";

import { prisma } from "@/lib/db";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: NO_STORE });
  } catch (error) {
    console.error("[saúde] O banco de dados não respondeu:", error);
    return Response.json({ status: "erro", banco: "sem resposta" }, { status: 503, headers: NO_STORE });
  }
}
