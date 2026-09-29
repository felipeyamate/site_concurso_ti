/**
 * player-messages.test.ts — Testes da tradução das mensagens do player do Panda.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { pandaSeekCommand, parsePandaPlayerMessage } from "./player-messages";

describe("parsePandaPlayerMessage", () => {
  it("entende o andamento do vídeo (objeto ou texto JSON)", () => {
    const expected = { kind: "timeupdate", currentTime: 42.5, duration: null, videoId: "abc" };
    expect(parsePandaPlayerMessage({ message: "panda_timeupdate", currentTime: 42.5, video: "abc" })).toEqual(expected);
    expect(parsePandaPlayerMessage(JSON.stringify({ message: "panda_timeupdate", currentTime: 42.5, video: "abc" }))).toEqual(
      expected,
    );
  });

  it("entende pausa, fim, play e 'pronto', com a duração quando vier", () => {
    expect(parsePandaPlayerMessage({ message: "panda_pause", currentTime: 10 })?.kind).toBe("pause");
    expect(parsePandaPlayerMessage({ message: "panda_ended", currentTime: 600, duration: 600 })).toMatchObject({
      kind: "ended",
      duration: 600,
    });
    expect(parsePandaPlayerMessage({ message: "panda_play" })?.kind).toBe("play");
    expect(parsePandaPlayerMessage({ message: "panda_ready" })?.kind).toBe("ready");
  });

  it("ignora mensagens desconhecidas, malformadas ou com números inválidos", () => {
    expect(parsePandaPlayerMessage({ message: "outra_coisa" })).toBeNull();
    expect(parsePandaPlayerMessage({ message: "constructor" })).toBeNull();
    expect(parsePandaPlayerMessage("texto qualquer")).toBeNull();
    expect(parsePandaPlayerMessage(null)).toBeNull();
    expect(parsePandaPlayerMessage({ message: "panda_timeupdate", currentTime: -5 })?.currentTime).toBeNull();
    expect(parsePandaPlayerMessage({ message: "panda_timeupdate", currentTime: "10" })?.currentTime).toBeNull();
    expect(parsePandaPlayerMessage({ message: "panda_ended", duration: 0 })?.duration).toBeNull();
  });
});

describe("pandaSeekCommand", () => {
  it("pede ao player para pular para o segundo inteiro", () => {
    expect(pandaSeekCommand(90.7)).toEqual({ type: "currentTime", parameter: 90 });
    expect(pandaSeekCommand(-3)).toEqual({ type: "currentTime", parameter: 0 });
  });
});
