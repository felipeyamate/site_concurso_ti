/**
 * progress-tracker.test.ts — Testes das regras de progresso do player do Panda, cena a cena.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import type { PandaPlayerEvent, PandaPlayerEventKind } from "./player-messages";
import { createPandaProgressTracker } from "./progress-tracker";

function event(kind: PandaPlayerEventKind, currentTime: number | null = null, duration: number | null = null): PandaPlayerEvent {
  return { kind, currentTime, duration, videoId: null };
}

// Relógio falso: o teste decide quanto tempo passou.
function setup(initialPositionSeconds: number) {
  let clock = 0;
  const tracker = createPandaProgressTracker({ initialPositionSeconds, now: () => clock });
  return { tracker, advance: (ms: number) => (clock += ms) };
}

const seek = (seconds: number) => ({ type: "seek", seconds });
const report = (positionSeconds: number, durationSeconds: number | null = null, ended = false) => ({
  type: "report",
  progress: { positionSeconds, durationSeconds, ended },
});

describe("começando do zero", () => {
  it("salva a cada 10 s de vídeo, ao pausar e ao terminar", () => {
    const { tracker } = setup(0);
    expect(tracker.mount()).toEqual([]);
    expect(tracker.handle(event("play", 0))).toEqual([]);
    for (const time of [0.3, 3, 6, 9]) expect(tracker.handle(event("timeupdate", time))).toEqual([]);
    expect(tracker.handle(event("timeupdate", 10.5))).toEqual([report(10.5)]);
    expect(tracker.handle(event("pause", 12, 600))).toEqual([report(12, 600)]);
    expect(tracker.handle(event("ended", 600))).toEqual([report(600, 600, true)]);
    expect(tracker.hidden()).toEqual([]); // terminou: nada mais a salvar
  });

  it("sem play nesta visita, trocar de aba ou sair NÃO salva (não apaga a posição salva)", () => {
    const { tracker } = setup(0);
    expect(tracker.hidden()).toEqual([]);
    expect(tracker.unmount()).toEqual([]);
  });

  it("um pulo com o vídeo parado não conta como assistir", () => {
    const { tracker } = setup(0);
    tracker.handle(event("seeked", 300));
    tracker.handle(event("timeupdate", 300));
    expect(tracker.hidden()).toEqual([]);
  });
});

describe("continuar de onde parou (posição salva: 20 min)", () => {
  const SAVED = 1200;

  it("pede o pulo ao abrir e quando o player fica pronto", () => {
    const { tracker } = setup(SAVED);
    expect(tracker.mount()).toEqual([seek(SAVED)]);
    expect(tracker.handle(event("ready"))).toEqual([seek(SAVED)]);
  });

  it("o pulo que NÓS pedimos (vídeo parado) não conta como assistir: trocar de aba não salva", () => {
    // Cena da revisão: aula desmarcada em 95%, o aluno abre e troca de aba sem dar play.
    const { tracker } = setup(SAVED);
    tracker.mount();
    tracker.handle(event("seeked", SAVED));
    tracker.handle(event("timeupdate", SAVED));
    expect(tracker.hidden()).toEqual([]);
    expect(tracker.unmount()).toEqual([]);
  });

  it("se o player já estava na posição no play, segue normalmente", () => {
    const { tracker } = setup(SAVED);
    tracker.mount();
    expect(tracker.handle(event("play", SAVED))).toEqual([]); // referência = 1200
    for (let time = SAVED + 1; time < SAVED + 10; time += 1) {
      expect(tracker.handle(event("timeupdate", time))).toEqual([]);
    }
    expect(tracker.handle(event("timeupdate", SAVED + 10))).toEqual([report(SAVED + 10)]);
  });

  it("se o player ignorar o pulo, insiste 1x por segundo e NÃO salva o começo do vídeo", () => {
    // Cena da revisão: o pulo enviado no play se perde; antes, 11 s depois salvaríamos "0:11".
    const { tracker, advance } = setup(SAVED);
    tracker.mount();
    expect(tracker.handle(event("play", 0))).toEqual([seek(SAVED)]);
    expect(tracker.handle(event("timeupdate", 0.3))).toEqual([]); // acabou de pedir
    advance(1000);
    expect(tracker.handle(event("timeupdate", 1.3))).toEqual([seek(SAVED)]); // insiste
    advance(500);
    expect(tracker.handle(event("timeupdate", SAVED + 0.1))).toEqual([]); // chegou
    for (let time = SAVED + 1; time < SAVED + 10; time += 1) {
      expect(tracker.handle(event("timeupdate", time))).toEqual([]);
    }
    expect(tracker.handle(event("timeupdate", SAVED + 10.2))).toEqual([report(SAVED + 10.2)]);
  });

  it("se o player nunca chegar, depois de 5 s segue com a posição real (e só salva após mais 10 s)", () => {
    const { tracker, advance } = setup(SAVED);
    tracker.mount();
    tracker.handle(event("play", 0));
    const actions = [];
    for (let time = 1; time <= 5; time += 1) {
      advance(1000);
      actions.push(...tracker.handle(event("timeupdate", time)));
    }
    expect(actions.filter((action) => action.type === "seek")).toHaveLength(4); // 1, 2, 3 e 4 s
    expect(actions.some((action) => action.type === "report")).toBe(false);
    // Aos 5 s desistimos: vale a posição real (5 s); só salva depois de mais 10 s assistidos.
    for (let time = 6; time < 15; time += 1) {
      advance(1000);
      expect(tracker.handle(event("timeupdate", time))).toEqual([]);
    }
    expect(tracker.handle(event("timeupdate", 15))).toEqual([report(15)]);
  });

  it("se o ALUNO escolher outra posição, não o puxamos de volta", () => {
    const { tracker } = setup(SAVED);
    tracker.mount();
    tracker.handle(event("seeked", 60)); // o aluno arrastou para 1:00 antes do play
    expect(tracker.handle(event("play", 60))).toEqual([]);
    expect(tracker.handle(event("timeupdate", 60.3))).toEqual([]);
    expect(tracker.handle(event("pause", 61))).toEqual([report(61)]);
  });
});

describe("duração", () => {
  it("só usa a duração informada pelo PLAYER (nunca uma digitada no painel)", () => {
    const { tracker } = setup(0);
    tracker.handle(event("play", 0));
    expect(tracker.handle(event("pause", 5))).toEqual([report(5, null)]);
    tracker.handle(event("play", 5));
    expect(tracker.handle(event("pause", 8, 3600))).toEqual([report(8, 3600)]);
  });

  it("ao terminar sem posição informada, usa a duração do player", () => {
    const { tracker } = setup(0);
    tracker.handle(event("play", 0, 300));
    expect(tracker.handle(event("ended"))).toEqual([report(300, 300, true)]);
  });
});
