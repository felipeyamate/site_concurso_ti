"use client";

/**
 * video-player.tsx — O player de vídeo das aulas.
 *
 * Quem chama: `src/modules/progress/components/lesson-player.tsx`.
 * O que faz:
 *  - toca o vídeo (arquivo direto pelo navegador, ou o player do Panda num <iframe> — este fica
 *    em `panda-player.tsx`, com as mesmas regras);
 *  - começa de onde o aluno parou (`initialPositionSeconds`);
 *  - avisa quem chamou sobre o andamento (`onProgress`) a cada 10 s, ao pausar, ao sair da aba
 *    e ao terminar — quem chamou decide o que fazer (salvar no banco);
 *  - mostra a marca d'água com o e-mail do aluno.
 *
 * Os `on...` do <video> são "eventos" do navegador (como callbacks em Python): o navegador chama
 * a nossa função quando o vídeo carrega, avança, pausa ou termina.
 */
import { useEffect, useRef, type SyntheticEvent } from "react";

import { REPORT_EVERY_SECONDS } from "@/modules/progress/rules";

import type { VideoPlayback } from "../types";
import { PandaPlayer } from "./panda-player";
import { Watermark } from "./watermark";

export type PlaybackProgress = {
  positionSeconds: number;
  durationSeconds: number | null;
  ended: boolean;
};

type VideoPlayerProps = {
  playback: VideoPlayback;
  title: string;
  watermarkText: string;
  initialPositionSeconds: number;
  onProgress: (progress: PlaybackProgress) => void;
};

/** Escolhe o player certo para o tipo de vídeo. */
export function VideoPlayer(props: VideoPlayerProps) {
  const { playback } = props;
  if (playback.kind === "panda") {
    return (
      <PandaPlayer
        src={playback.src}
        videoId={playback.videoId}
        title={props.title}
        watermarkText={props.watermarkText}
        initialPositionSeconds={props.initialPositionSeconds}
        onProgress={props.onProgress}
      />
    );
  }
  return (
    <Html5Player
      src={playback.src}
      title={props.title}
      watermarkText={props.watermarkText}
      initialPositionSeconds={props.initialPositionSeconds}
      onProgress={props.onProgress}
    />
  );
}

type Html5PlayerProps = {
  src: string;
  title: string;
  watermarkText: string;
  initialPositionSeconds: number;
  onProgress: (progress: PlaybackProgress) => void;
};

/** Player de arquivo de vídeo, tocado pelo próprio navegador (tag <video>). */
function Html5Player({ src, title, watermarkText, initialPositionSeconds, onProgress }: Html5PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportedRef = useRef(initialPositionSeconds);
  // O aluno apertou "play" nesta visita? Só então salvamos ao sair/trocar de aba. Sem isso,
  // sair antes de o vídeo carregar (posição ainda 0) APAGARIA a posição salva — e no modo de
  // desenvolvimento o React monta/desmonta o player uma vez ao abrir, o que disparava isso sempre.
  const hasPlayedRef = useRef(false);
  // Guarda sempre a versão MAIS RECENTE de `onProgress`. O evento de "trocar de aba" é registrado
  // uma vez só; sem isto, ele continuaria chamando uma versão antiga (ex.: de outra aula).
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // "Continuar de onde parou". O HTML do vídeo chega pronto do servidor e o navegador pode
  // carregar os dados do vídeo ANTES de o React ligar o `onLoadedMetadata` — aí o evento passa
  // sem ninguém ouvindo. Por isso, ao montar, conferimos: se já carregou, aplicamos agora.
  useEffect(() => {
    const video = videoRef.current;
    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applyInitialPosition(video);
    }
    // Só na montagem: a posição inicial vale para a abertura da aula.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao trocar de aba ou minimizar, salva onde parou (o aluno pode fechar a aba em seguida).
  // E ao SAIR da página da aula (ex.: clicar em "Próxima"), salva também: nesse caso o navegador
  // não dispara "pause" nem "visibilitychange", e perderíamos até 10 s de posição.
  useEffect(() => {
    const video = videoRef.current; // guardado agora: na "limpeza" o ref já pode estar vazio
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && video && hasPlayedRef.current) {
        reportFrom(video, false);
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // "Limpeza" do efeito = o componente está saindo da tela.
      const moved = video ? Math.abs(video.currentTime - lastReportedRef.current) : 0;
      if (video && hasPlayedRef.current && !video.ended && moved >= 1) {
        reportFrom(video, false);
      }
    };
    // Só na montagem/desmontagem; `reportFrom` usa refs (sempre atualizados).
  }, []);

  // Lê a posição atual do <video> e avisa quem chamou.
  function reportFrom(video: HTMLVideoElement, ended: boolean) {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
    lastReportedRef.current = video.currentTime;
    onProgressRef.current({ positionSeconds: video.currentTime, durationSeconds: duration, ended });
  }

  // Pula para a posição salva, uma única vez (o evento pode chegar depois do efeito acima).
  const appliedInitialRef = useRef(false);
  function applyInitialPosition(video: HTMLVideoElement) {
    if (appliedInitialRef.current) return;
    appliedInitialRef.current = true;
    if (initialPositionSeconds > 0 && initialPositionSeconds < video.duration) {
      video.currentTime = initialPositionSeconds;
    }
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    applyInitialPosition(event.currentTarget);
  }

  function handleTimeUpdate(event: SyntheticEvent<HTMLVideoElement>) {
    const moved = Math.abs(event.currentTarget.currentTime - lastReportedRef.current);
    if (moved >= REPORT_EVERY_SECONDS) {
      reportFrom(event.currentTarget, false);
    }
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        controls
        preload="metadata"
        playsInline
        // Dificulta baixar o arquivo pelo menu do player (não impede um usuário avançado).
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(event) => event.preventDefault()}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => {
          hasPlayedRef.current = true;
        }}
        onTimeUpdate={handleTimeUpdate}
        onPause={(event) => {
          // O navegador também dispara "pause" logo antes de "ended"; o "ended" cuida desse caso.
          if (!event.currentTarget.ended) reportFrom(event.currentTarget, false);
        }}
        onEnded={(event) => reportFrom(event.currentTarget, true)}
      />
      <Watermark text={watermarkText} />
    </div>
  );
}
