/**
 * panda-provider.ts — Provedor de vídeo do Panda: monta o player de uma aula para um aluno.
 *
 * Quem chama: `../provider.ts`, para aulas com `videoProvider = PANDA` — SEMPRE depois de a
 * página conferir o acesso à aula (`checkLessonAccess`).
 * O que devolve: um `VideoPlayback` do tipo "panda" (link do player + ID do vídeo).
 *
 * Proteção ("vídeos só com links assinados e temporários", PROJECT.md seção 6):
 *  - o link do player leva a marca d'água (DRM) do aluno, num token assinado que vence em 6 h;
 *  - em PRODUÇÃO, sem o DRM configurado, a aula NÃO toca (mostra "vídeo indisponível");
 *  - em desenvolvimento, sem DRM, toca sem a marca d'água (com um aviso no terminal), para você
 *    poder testar a conta do Panda antes de configurar o DRM.
 * Configure também, no painel do Panda, os domínios autorizados a exibir os vídeos (README).
 */
import "server-only";

import { env } from "@/lib/env";

import type { VideoPlayback, Viewer } from "../types";
import { createPandaWatermarkToken } from "./drm";
import { parsePandaEmbedInput } from "./embed";

type PandaLessonVideo = { videoEmbedUrl: string | null };

let warnedAboutMissingDrm = false;

export function getPandaPlayback(lesson: PandaLessonVideo, viewer: Viewer): VideoPlayback {
  // Confere o link de novo (defesa extra: nunca montar um <iframe> com endereço fora do Panda).
  const parsed = parsePandaEmbedInput(lesson.videoEmbedUrl ?? "");
  if (!parsed.ok) {
    throw new Error(`Aula do Panda com link do player inválido: ${parsed.error}`);
  }

  const url = new URL(parsed.embedUrl);
  if (env.PANDA_DRM_GROUP_ID && env.PANDA_DRM_SECRET) {
    const token = createPandaWatermarkToken({
      groupId: env.PANDA_DRM_GROUP_ID,
      secret: env.PANDA_DRM_SECRET,
      viewer,
      nowSeconds: Math.floor(Date.now() / 1000),
    });
    url.searchParams.set("watermark", token);
  } else if (env.NODE_ENV === "production") {
    throw new Error(
      "DRM do Panda não configurado (PANDA_DRM_GROUP_ID e PANDA_DRM_SECRET). " +
        "Por segurança, as aulas do Panda não tocam em produção sem a marca d'água.",
    );
  } else if (!warnedAboutMissingDrm) {
    warnedAboutMissingDrm = true;
    console.warn("[panda] DRM não configurado: em desenvolvimento o vídeo toca SEM a marca d'água do Panda.");
  }

  return { kind: "panda", src: url.toString(), videoId: parsed.videoId };
}
