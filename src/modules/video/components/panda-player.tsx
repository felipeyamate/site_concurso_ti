"use client";

/**
 * panda-player.tsx — O player do Panda Video (num <iframe>) ligado ao nosso progresso.
 *
 * Quem chama: `video-player.tsx`, quando a aula é do Panda.
 * O que faz (mesmas regras do player de arquivo, para o aluno não notar diferença):
 *  - começa de onde o aluno parou: ao abrir, quando o player avisa que está pronto e no primeiro
 *    play, pedimos a ele para pular para a posição salva (o player ignora pedidos repetidos);
 *  - avisa `onProgress` a cada 10 s de vídeo, ao pausar, ao terminar, ao trocar de aba e ao sair
 *    da página — os dois "ao sair" só se o aluno deu play nesta visita (senão apagariam a posição);
 *  - mostra a nossa marca d'água por cima (a do Panda, via DRM, fica DENTRO do vídeo).
 *
 * Segurança: só aceitamos mensagens que vêm (1) do <iframe> desta página e (2) de um endereço do
 * player do Panda. Qualquer outra mensagem é ignorada.
 */
import { useEffect, useRef, useState } from "react";

import { isPandaPlayerOrigin } from "../panda/embed";
import { pandaSeekCommand, parsePandaPlayerMessage } from "../panda/player-messages";
import type { PlaybackProgress } from "./video-player";
import { Watermark } from "./watermark";

type PandaPlayerProps = {
  src: string;
  videoId: string;
  title: string;
  watermarkText: string;
  initialPositionSeconds: number;
  // Duração cadastrada na aula (usada até o player informar a real).
  fallbackDurationSeconds: number | null;
  onProgress: (progress: PlaybackProgress) => void;
};

const REPORT_EVERY_SECONDS = 10;

export function PandaPlayer({ videoId, title, watermarkText, onProgress, ...initialProps }: PandaPlayerProps) {
  // "Congela" o link do player e a posição inicial da PRIMEIRA abertura. Quando a página se
  // atualiza sozinha (ex.: ao concluir a aula), o servidor manda um link novo (o token da marca
  // d'água tem a hora de emissão) e outra posição salva — se usássemos esses valores novos, o
  // <iframe> recarregaria e o vídeo voltaria no meio da aula. (`useState(valor)` guarda o valor
  // inicial e ignora os próximos, como uma variável definida só no `__init__` em Python.)
  const [{ src, initialPositionSeconds, fallbackDurationSeconds }] = useState(initialProps);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Guarda sempre a versão MAIS RECENTE de `onProgress` (os eventos são registrados uma vez só).
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const iframe = iframeRef.current;
    const playerOrigin = new URL(src).origin;
    // Estado do vídeo nesta visita (variáveis do efeito, como atributos de um objeto em Python).
    let position = initialPositionSeconds;
    let duration = fallbackDurationSeconds && fallbackDurationSeconds > 0 ? fallbackDurationSeconds : null;
    let lastReported = initialPositionSeconds;
    let hasPlayed = false;
    let ended = false;
    // "Continuar de onde parou" — o pulo para a posição salva:
    //  - `seekSettled`: já resolvido (enviado no play, ou o aluno escolheu outra posição, ou não havia
    //    posição salva). Antes disso, as posições que chegam são as do começo do vídeo: não salvamos.
    //  - `settling`: acabamos de pedir o pulo; o próximo aviso de posição só serve de referência.
    let seekSettled = initialPositionSeconds <= 0;
    let settling = false;

    function report(isEnded: boolean) {
      lastReported = position;
      onProgressRef.current({ positionSeconds: position, durationSeconds: duration, ended: isEnded });
    }

    function sendSeek() {
      if (initialPositionSeconds > 0 && iframe?.contentWindow) {
        iframe.contentWindow.postMessage(pandaSeekCommand(initialPositionSeconds), playerOrigin);
      }
    }

    // Pede o pulo pela última vez (no play) e passa a salvar o progresso normalmente.
    function settleSeek() {
      if (seekSettled) return;
      seekSettled = true;
      settling = true;
      sendSeek();
    }

    function handleMessage(event: MessageEvent) {
      // 1. Só mensagens do NOSSO iframe e do domínio do Panda.
      if (!iframe || event.source !== iframe.contentWindow || !isPandaPlayerOrigin(event.origin)) return;
      // 2. Só mensagens do player que entendemos, e deste vídeo.
      const message = parsePandaPlayerMessage(event.data);
      if (!message || (message.videoId && message.videoId !== videoId)) return;

      if (message.duration !== null) duration = message.duration;

      switch (message.kind) {
        case "ready":
          if (!seekSettled) sendSeek();
          break;
        case "play":
          hasPlayed = true;
          ended = false;
          settleSeek();
          break;
        case "timeupdate":
          if (message.currentTime === null) break;
          hasPlayed = true;
          if (!seekSettled) {
            settleSeek();
            break;
          }
          position = message.currentTime;
          // Primeiro aviso depois do pulo: vira a referência (se o player ainda não tinha pulado,
          // não sobrescrevemos a posição salva com o começo do vídeo).
          if (settling) {
            settling = false;
            lastReported = position;
            break;
          }
          if (Math.abs(position - lastReported) >= REPORT_EVERY_SECONDS) report(false);
          break;
        case "seeked":
          // O aluno escolheu outra posição antes do play: não "puxamos" de volta para a salva.
          seekSettled = true;
          if (message.currentTime !== null) position = message.currentTime;
          break;
        case "pause":
          if (message.currentTime !== null) position = message.currentTime;
          if (hasPlayed && !ended) report(false);
          break;
        case "ended":
          if (message.currentTime !== null) position = message.currentTime;
          else if (duration) position = duration;
          hasPlayed = true;
          ended = true;
          report(true);
          break;
      }
    }

    // Ao trocar de aba ou minimizar, salva onde parou (o aluno pode fechar a aba em seguida).
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden" && hasPlayed && !ended) report(false);
    }

    window.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    // O player pode ter ficado pronto ANTES de a página começar a ouvir (o aviso "pronto" se
    // perdeu): pedimos o pulo já agora também. Se o player ainda não carregou, o pedido é ignorado
    // e o aviso "pronto" (ou o play) pede de novo.
    sendSeek();
    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      // Saindo da página da aula (ex.: "Próxima"): salva se o aluno assistiu algo desde o último aviso.
      if (hasPlayed && !ended && Math.abs(position - lastReported) >= 1) report(false);
    };
  }, [src, videoId, initialPositionSeconds, fallbackDurationSeconds]);

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
