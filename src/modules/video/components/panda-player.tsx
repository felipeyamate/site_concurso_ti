"use client";

/**
 * panda-player.tsx — O player do Panda Video (num <iframe>) ligado ao nosso progresso.
 *
 * Quem chama: `video-player.tsx`, quando a aula é do Panda.
 * O que faz: repassa cada acontecimento (abriu, mensagem do player, aba escondida, saiu da página)
 * para as regras de `../panda/progress-tracker.ts` e executa o que elas mandarem:
 *  - "seek": pede ao player para pular para a posição salva ("continuar de onde parou");
 *  - "report": avisa `onProgress` (quem chamou salva no banco).
 * E mostra a nossa marca d'água por cima (a do Panda, via DRM, fica DENTRO do vídeo).
 *
 * Segurança: só aceitamos mensagens que vêm (1) do <iframe> desta página e (2) de um endereço do
 * player do Panda. Qualquer outra mensagem é ignorada.
 */
import { useEffect, useRef, useState } from "react";

import { isPandaPlayerOrigin } from "../panda/embed";
import { pandaSeekCommand, parsePandaPlayerMessage } from "../panda/player-messages";
import { createPandaProgressTracker, type TrackerAction } from "../panda/progress-tracker";
import type { PlaybackProgress } from "./video-player";
import { Watermark } from "./watermark";

type PandaPlayerProps = {
  src: string;
  videoId: string;
  title: string;
  watermarkText: string;
  initialPositionSeconds: number;
  onProgress: (progress: PlaybackProgress) => void;
};

export function PandaPlayer({ videoId, title, watermarkText, onProgress, ...initialProps }: PandaPlayerProps) {
  // "Congela" o link do player e a posição inicial da PRIMEIRA abertura. Quando a página se
  // atualiza sozinha (ex.: ao concluir a aula), o servidor manda um link novo (o token da marca
  // d'água tem a hora de emissão) e outra posição salva — se usássemos esses valores novos, o
  // <iframe> recarregaria e o vídeo voltaria no meio da aula. (`useState(valor)` guarda o valor
  // inicial e ignora os próximos, como uma variável definida só no `__init__` em Python.)
  const [{ src, initialPositionSeconds }] = useState(initialProps);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Guarda sempre a versão MAIS RECENTE de `onProgress` (os eventos são registrados uma vez só).
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const playerOrigin = new URL(src).origin;
    const tracker = createPandaProgressTracker({ initialPositionSeconds });

    // Executa os comandos das regras: pular (mensagem para o player) ou salvar (onProgress).
    function run(actions: TrackerAction[]) {
      for (const action of actions) {
        if (action.type === "seek") {
          iframe?.contentWindow?.postMessage(pandaSeekCommand(action.seconds), playerOrigin);
        } else {
          onProgressRef.current(action.progress);
        }
      }
    }

    function handleMessage(event: MessageEvent) {
      // 1. Só mensagens do NOSSO iframe e do domínio do Panda.
      if (!iframe || event.source !== iframe.contentWindow || !isPandaPlayerOrigin(event.origin)) return;
      // 2. Só mensagens do player que entendemos, e deste vídeo.
      const message = parsePandaPlayerMessage(event.data);
      if (!message || (message.videoId && message.videoId !== videoId)) return;
      run(tracker.handle(message));
    }

    // Ao trocar de aba ou minimizar, salva onde parou (o aluno pode fechar a aba em seguida).
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") run(tracker.hidden());
    }

    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // O player pode ter ficado pronto ANTES de a página começar a ouvir (o aviso "pronto" se
    // perdeu): pedimos o pulo já agora também. Se o player ainda não carregou, o pedido é ignorado
    // e o aviso "pronto" (ou o play) pede de novo.
    run(tracker.mount());
    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      run(tracker.unmount());
    };
  }, [src, videoId, initialPositionSeconds]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        // Não envia o endereço da nossa página para o Panda além da origem (domínio).
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <Watermark text={watermarkText} />
    </div>
  );
}
