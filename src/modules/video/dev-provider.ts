/**
 * dev-provider.ts — Provedor de vídeo de DESENVOLVIMENTO: toca sempre o mesmo vídeo de exemplo.
 *
 * Quem chama: `provider.ts`, para aulas com `videoProvider = DEV` (o conteúdo do seed).
 * O que devolve: um `VideoPlayback` do tipo "html5" com o endereço de DEV_SAMPLE_VIDEO_URL.
 *
 * Por que é bloqueado em produção: este vídeo não tem link assinado nem proteção. A regra do
 * projeto é "vídeos só com links assinados e temporários" — isso vem com o Panda (Fase 3).
 * Bloqueia em QUALQUER execução de produção (Vercel ou não), menos nos deploys de teste
 * ("preview") da Vercel. Na sua máquina, use `npm run dev`.
 */
import "server-only";

import { env } from "@/lib/env";

import type { VideoPlayback } from "./types";

export function getDevPlayback(): VideoPlayback {
  const isProductionSite = env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview";
  if (isProductionSite) {
    throw new Error(
      "Aula com vídeo de exemplo (provedor DEV) no site de produção. Cadastre o vídeo no Panda Video.",
    );
  }
  return { kind: "html5", src: env.DEV_SAMPLE_VIDEO_URL };
}
