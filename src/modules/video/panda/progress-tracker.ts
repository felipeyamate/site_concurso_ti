/**
 * progress-tracker.ts — As regras de progresso do player do Panda, separadas da tela.
 *
 * Quem chama: `components/panda-player.tsx`, que repassa para cá cada acontecimento (abriu a aula,
 * mensagem do player, aba escondida, saiu da página) e executa o que este arquivo devolve:
 *   { type: "seek" }   → pedir ao player para pular para a posição salva;
 *   { type: "report" } → salvar o progresso (quem salva é o `LessonPlayer`).
 *
 * Por que separado: o player do Panda roda noutro site (<iframe>) e só conversa por mensagens,
 * então as regras têm casos delicados. Aqui elas são uma função "pura" (sem tela, sem rede),
 * testada cena a cena em `progress-tracker.test.ts`.
 * Paralelo em Python: é uma pequena máquina de estados — uma classe com um método por evento
 * que devolve uma lista de "comandos" para quem chamou executar.
 *
 * Regras (as mesmas do player de arquivo da Fase 2):
 *  1. Só salvamos depois que o aluno REALMENTE assistiu (o vídeo avançou sozinho). Um pulo feito
 *     por nós com o vídeo parado não conta — senão, trocar de aba sem dar play salvaria a posição.
 *  2. "Continuar de onde parou": pedimos o pulo ao abrir, quando o player fica pronto e no play.
 *     Depois do play, repetimos o pedido (1x por segundo, por até 5 s) enquanto o player não chega
 *     lá; se ele nunca chegar, seguimos com a posição real (sem apagar a salva antes de 10 s de vídeo).
 *  3. Se o aluno escolheu outra posição por conta própria, não o "puxamos" de volta.
 *  4. A duração só vale se vier do PLAYER (uma duração digitada errada no painel concluiria a aula
 *     antes da hora). Sem duração, a aula conclui ao terminar o vídeo ou pelo botão.
 */
import type { PandaPlayerEvent } from "./player-messages";

export type TrackerProgress = { positionSeconds: number; durationSeconds: number | null; ended: boolean };

export type TrackerAction = { type: "seek"; seconds: number } | { type: "report"; progress: TrackerProgress };

// De quanto em quanto tempo de vídeo salvamos.
export const REPORT_EVERY_SECONDS = 10;
// Entre dois avisos de posição, um avanço de até 2 s é "tocando"; mais que isso é um pulo.
const NATURAL_STEP_MAX_SECONDS = 2;
// Diferença aceita entre a posição pedida e a real para considerar que o pulo aconteceu.
const SEEK_TOLERANCE_SECONDS = 3;
// Depois do play, por quanto tempo insistimos no pulo, e de quanto em quanto tempo.
const SETTLE_WINDOW_MS = 5_000;
const SEEK_RETRY_MS = 1_000;

export function createPandaProgressTracker(options: { initialPositionSeconds: number; now?: () => number }) {
  const now = options.now ?? Date.now;
  const initial = Math.max(0, options.initialPositionSeconds);

  let position = initial;
  let lastReported = initial;
  let duration: number | null = null;
  let hasPlayed = false;
  let ended = false;
  let lastTime: number | null = null;
  // Situação do "continuar de onde parou":
  //  pending  = ainda não houve play (pedimos o pulo, mas não sabemos se aconteceu);
  //  settling = houve play; esperando o player chegar à posição salva;
  //  done     = resolvido (chegou, o aluno escolheu outra posição, ou não havia posição salva).
  let resume: "pending" | "settling" | "done" = initial > 0 ? "pending" : "done";
  let settlingSince = 0;
  let lastSeekAt = Number.NEGATIVE_INFINITY;

  function seek(): TrackerAction[] {
    lastSeekAt = now();
    return [{ type: "seek", seconds: initial }];
  }

  function report(isEnded: boolean): TrackerAction[] {
    lastReported = position;
    return [{ type: "report", progress: { positionSeconds: position, durationSeconds: duration, ended: isEnded } }];
  }

  const isNearTarget = (time: number) => Math.abs(time - initial) <= SEEK_TOLERANCE_SECONDS;

  // Resolve o pulo: a partir daqui, `time` é a referência (nada é salvo só por isso).
  function finishResume(time: number): TrackerAction[] {
    resume = "done";
    position = time;
    lastReported = time;
    return [];
  }

  // Começou a tocar: se o player não está na posição salva, pede o pulo (de novo).
  function startSettling(time: number | null): TrackerAction[] {
    resume = "settling";
    settlingSince = now();
    if (time !== null && isNearTarget(time)) return finishResume(time);
    return seek();
  }

  // Enquanto espera o pulo: chegou? desistiu de esperar? insiste (1x por segundo)?
  function continueSettling(time: number): TrackerAction[] {
    if (isNearTarget(time) || now() - settlingSince >= SETTLE_WINDOW_MS) return finishResume(time);
    return now() - lastSeekAt >= SEEK_RETRY_MS ? seek() : [];
  }

  return {
    /** A aula abriu: o player pode já estar pronto (e o aviso "pronto" ter se perdido). */
    mount(): TrackerAction[] {
      return resume === "pending" ? seek() : [];
    },

    /** Uma mensagem do player (já conferida: é do nosso iframe e deste vídeo). */
    handle(event: PandaPlayerEvent): TrackerAction[] {
      if (event.duration !== null) duration = event.duration;
      const time = event.currentTime;

      switch (event.kind) {
        case "ready":
          return resume === "pending" ? seek() : [];

        case "play":
          hasPlayed = true;
          ended = false;
          return resume === "pending" ? startSettling(time) : [];

        case "seeked":
          if (time === null) return [];
          // Posição diferente da salva = foi o ALUNO que escolheu: não puxamos de volta.
          if (resume !== "done" && !isNearTarget(time)) return finishResume(time);
          if (resume === "done") position = time;
          return [];

        case "timeupdate": {
          if (time === null) return [];
          const previous = lastTime;
          lastTime = time;
          const advancing = previous !== null && time > previous && time - previous <= NATURAL_STEP_MAX_SECONDS;
          if (advancing) hasPlayed = true;

          if (resume === "pending") return advancing ? startSettling(time) : [];
          if (resume === "settling") return continueSettling(time);
          position = time;
          if (hasPlayed && Math.abs(position - lastReported) >= REPORT_EVERY_SECONDS) return report(false);
          return [];
        }

        case "pause":
          if (resume === "settling" && time !== null) return continueSettling(time);
          if (resume !== "done") return [];
          if (time !== null) position = time;
          return hasPlayed && !ended ? report(false) : [];

        case "ended":
          if (time !== null) position = time;
          else if (duration !== null) position = duration;
          hasPlayed = true;
          ended = true;
          resume = "done";
          return report(true);
      }
    },

    /** A aba foi escondida/minimizada: o aluno pode fechar em seguida. */
    hidden(): TrackerAction[] {
      return hasPlayed && !ended && resume === "done" ? report(false) : [];
    },

    /** Saiu da página da aula (ex.: "Próxima"): salva se assistiu algo desde o último aviso. */
    unmount(): TrackerAction[] {
      const moved = Math.abs(position - lastReported) >= 1;
      return hasPlayed && !ended && resume === "done" && moved ? report(false) : [];
    },
  };
}
