"use client";

/**
 * lesson-player.tsx — Liga o player de vídeo ao salvamento do progresso.
 *
 * Quem chama: a página da aula (`/cursos/[curso]/aulas/[aula]`).
 * O que faz: cada aviso do player vira uma chamada à Server Action `saveLessonProgressAction`.
 * Quando a aula é concluída pela primeira vez, recarrega os dados da página (para aparecer o
 * "Concluída" e o ✓ na lista de aulas) sem interromper o vídeo.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { VideoPlayer, type PlaybackProgress } from "@/modules/video/components/video-player";
import type { VideoPlayback } from "@/modules/video/types";

import { saveLessonProgressAction } from "../actions";

type LessonPlayerProps = {
  lessonId: string;
  lessonTitle: string;
  playback: VideoPlayback;
  watermarkText: string;
  initialPositionSeconds: number;
  initiallyCompleted: boolean;
};

export function LessonPlayer({
  lessonId,
  lessonTitle,
  playback,
  watermarkText,
  initialPositionSeconds,
  initiallyCompleted,
}: LessonPlayerProps) {
  const router = useRouter();
  const completedRef = useRef(initiallyCompleted);
  // Se a página mudar o estado (ex.: o aluno clicou em "desmarcar"), o player acompanha. Assim,
  // se a aula for concluída de novo, a tela é atualizada outra vez.
  useEffect(() => {
    completedRef.current = initiallyCompleted;
  }, [initiallyCompleted]);

  function handleProgress(progress: PlaybackProgress) {
    // "Dispara e esquece": salvar progresso nunca deve atrapalhar o vídeo. Se falhar
    // (ex.: internet caiu), a próxima tentativa, 10 s depois, salva a posição de novo.
    saveLessonProgressAction({ lessonId, ...progress })
      .then((result) => {
        if (result.ok && result.completed && !completedRef.current) {
          completedRef.current = true;
          router.refresh();
        }
      })
      .catch(() => {});
  }

  return (
    <VideoPlayer
      playback={playback}
      title={lessonTitle}
      watermarkText={watermarkText}
      initialPositionSeconds={initialPositionSeconds}
      onProgress={handleProgress}
    />
  );
}
