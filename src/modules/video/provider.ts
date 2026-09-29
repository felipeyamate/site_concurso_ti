/**
 * provider.ts — Ponto único de entrada para obter o vídeo de uma aula, qualquer que seja o fornecedor.
 *
 * Quem chama: a página da aula, DEPOIS de conferir que a pessoa tem acesso (matrícula/aula grátis).
 * O que devolve: um `VideoPlayback` (ver `types.ts`) ou `null` se a aula não tem vídeo.
 *
 * Paralelo em Python: é uma pequena "fábrica" — um `if/elif` que escolhe a implementação certa,
 * como escolher entre dois backends de storage num `settings.py`.
 */
import "server-only";

import type { VideoProvider as VideoProviderName } from "@/generated/prisma/enums";

import { getDevPlayback } from "./dev-provider";
import { getPandaPlayback } from "./panda/panda-provider";
import type { VideoPlayback, Viewer } from "./types";

type LessonVideo = {
  videoProvider: VideoProviderName;
  videoId: string | null;
  videoEmbedUrl: string | null;
};

export async function getLessonPlayback(lesson: LessonVideo, viewer: Viewer): Promise<VideoPlayback | null> {
  if (!lesson.videoId) {
    return null;
  }
  switch (lesson.videoProvider) {
    case "DEV":
      return getDevPlayback();
    case "PANDA":
      return getPandaPlayback(lesson, viewer);
  }
}
