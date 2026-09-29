/**
 * embed.test.ts — Testes da leitura/conferência do link do player do Panda.
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { isPandaPlayerOrigin, parsePandaEmbedInput } from "./embed";

const VIDEO_ID = "9988aabb-ccdd-eeff-1122-334455667788";
const PLAYER = "https://player-vz-7b6cf9e4-8bf.tv.pandavideo.com.br";

describe("parsePandaEmbedInput", () => {
  it("aceita o link do player e devolve o link limpo + o ID do vídeo", () => {
    expect(parsePandaEmbedInput(`  ${PLAYER}/embed/?v=${VIDEO_ID}&autoplay=true  `)).toEqual({
      ok: true,
      embedUrl: `${PLAYER}/embed/?v=${VIDEO_ID}`,
      videoId: VIDEO_ID,
    });
  });

  it("aceita o código <iframe> inteiro (com &amp;) e o domínio antigo do player", () => {
    const iframe = `<iframe id="panda-x" src="https://player.pandavideo.com.br/embed/?v=${VIDEO_ID}&amp;x=1" style="border:none;" allowfullscreen=true width="720" height="360"></iframe>`;
    const result = parsePandaEmbedInput(iframe);
    expect(result).toEqual({
      ok: true,
      embedUrl: `https://player.pandavideo.com.br/embed/?v=${VIDEO_ID}`,
      videoId: VIDEO_ID,
    });
  });

  it("recusa endereços que não são do player do Panda", () => {
    const cases = [
      `https://evil.com/embed/?v=${VIDEO_ID}`,
      `https://player.pandavideo.com.br.evil.com/embed/?v=${VIDEO_ID}`,
      `https://pandavideo.com.br/embed/?v=${VIDEO_ID}`,
      `http://player.pandavideo.com.br/embed/?v=${VIDEO_ID}`, // sem https
      `https://player.pandavideo.com.br:8443/embed/?v=${VIDEO_ID}`, // porta diferente
      `javascript:alert(1)`,
      "",
    ];
    for (const input of cases) {
      expect(parsePandaEmbedInput(input).ok, input).toBe(false);
    }
  });

  it("recusa link sem /embed ou sem o ID do vídeo", () => {
    expect(parsePandaEmbedInput(`${PLAYER}/outra-coisa/?v=${VIDEO_ID}`).ok).toBe(false);
    expect(parsePandaEmbedInput(`${PLAYER}/embed/`).ok).toBe(false);
    expect(parsePandaEmbedInput(`${PLAYER}/embed/?v=<script>`).ok).toBe(false);
  });

  it("explica o erro em português", () => {
    const result = parsePandaEmbedInput("não é link");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/link/);
  });
});

describe("isPandaPlayerOrigin", () => {
  it("aceita só o domínio do player do Panda em https", () => {
    expect(isPandaPlayerOrigin(PLAYER)).toBe(true);
    expect(isPandaPlayerOrigin("https://player.pandavideo.com.br")).toBe(true);
    expect(isPandaPlayerOrigin("https://localhost:3000")).toBe(false);
    expect(isPandaPlayerOrigin("https://api-v2.pandavideo.com.br")).toBe(false);
    expect(isPandaPlayerOrigin("null")).toBe(false);
  });
});
