/**
 * panda-api.test.ts — Testes da listagem da biblioteca do Panda (sem internet: o `fetch` é simulado).
 * Rodar: npm test
 */
import { describe, expect, it, vi } from "vitest";

import { listPandaVideos, mapPandaVideoList, PandaApiError } from "./panda-api";

const VIDEO_ID = "9988aabb-ccdd-eeff-1122-334455667788";

const apiResponse = {
  videos: [
    {
      id: VIDEO_ID,
      title: "  Aula 1 — Hardware  ",
      status: "CONVERTED",
      length: 754.4,
      video_player: `https://player-vz-abc.tv.pandavideo.com.br/embed/?v=${VIDEO_ID}`,
      thumbnail: "https://b-vz-abc.tv.pandavideo.com.br/thumb.jpg",
      campo_extra: 123,
    },
    { id: "processando-1", title: null, status: "UPLOADING", length: 0, video_player: null },
  ],
  pages: 1,
};

describe("mapPandaVideoList", () => {
  it("converte a resposta da API no nosso formato", () => {
    expect(mapPandaVideoList(apiResponse)).toEqual([
      {
        id: VIDEO_ID,
        title: "Aula 1 — Hardware",
        durationSeconds: 754,
        status: "CONVERTED",
        embedUrl: `https://player-vz-abc.tv.pandavideo.com.br/embed/?v=${VIDEO_ID}`,
        thumbnailUrl: "https://b-vz-abc.tv.pandavideo.com.br/thumb.jpg",
      },
      {
        id: "processando-1",
        title: "(sem título)",
        durationSeconds: null,
        status: "UPLOADING",
        embedUrl: null,
        thumbnailUrl: null,
      },
    ]);
  });

  it("descarta links de player fora do domínio do Panda", () => {
    const [video] = mapPandaVideoList({ videos: [{ id: "x", video_player: "https://evil.com/embed/?v=12345678" }] });
    expect(video.embedUrl).toBeNull();
  });
});

describe("listPandaVideos", () => {
  it("chama a API com a chave no cabeçalho e a busca pelo título", async () => {
    const fetchImpl = vi.fn(async () => Response.json(apiResponse));
    const videos = await listPandaVideos({ apiKey: "chave-123", search: " hardware ", fetchImpl });

    expect(videos).toHaveLength(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe("https://api-v2.pandavideo.com.br/videos?page=1&limit=25&title=hardware");
    expect(init.headers).toMatchObject({ Authorization: "chave-123" });
  });

  it("explica chave recusada e falhas do Panda em português", async () => {
    const unauthorized = vi.fn(async () => new Response("", { status: 401 }));
    await expect(listPandaVideos({ apiKey: "errada", fetchImpl: unauthorized })).rejects.toThrow(/PANDA_API_KEY/);

    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(listPandaVideos({ apiKey: "x", fetchImpl: offline })).rejects.toBeInstanceOf(PandaApiError);

    const weird = vi.fn(async () => Response.json({ outra: "coisa" }));
    await expect(listPandaVideos({ apiKey: "x", fetchImpl: weird })).rejects.toThrow(/formato inesperado/);
  });
});
