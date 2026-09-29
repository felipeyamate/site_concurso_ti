/**
 * player-messages.ts — Traduz as mensagens que o player do Panda manda para a nossa página.
 *
 * Quem chama: o player do Panda no navegador (`components/panda-player.tsx`).
 *
 * Como funciona: o player do Panda roda dentro de um <iframe> (outro site). Ele avisa a nossa
 * página sobre o que acontece com o vídeo usando `window.postMessage` — mensagens como
 * `{ message: "panda_timeupdate", currentTime: 42.1, video: "<id>" }`.
 * Paralelo em Python: é como receber eventos numa fila e despachar por tipo (um `dict` de handlers).
 *
 * E para pedir algo ao player (ex.: "pule para 1:30"), mandamos uma mensagem de volta:
 * `{ type: "currentTime", parameter: 90 }` (API de eventos do player do Panda).
 *
 * Arquivo "puro", testado em `player-messages.test.ts`.
 */

export type PandaPlayerEventKind = "ready" | "play" | "pause" | "timeupdate" | "seeked" | "ended";

export type PandaPlayerEvent = {
  kind: PandaPlayerEventKind;
  currentTime: number | null; // segundos
  duration: number | null; // segundos, quando o player informa
  videoId: string | null;
};

// Nome da mensagem do Panda → nosso tipo de evento. Mensagens fora desta lista são ignoradas.
// (Um `Map`, e não um objeto comum, para que nomes como "constructor" nunca "existam" por acaso.)
const EVENT_KINDS = new Map<string, PandaPlayerEventKind>([
  ["panda_ready", "ready"],
  ["panda_allData", "ready"],
  ["panda_play", "play"],
  ["panda_pause", "pause"],
  ["panda_timeupdate", "timeupdate"],
  ["panda_seeked", "seeked"],
  ["panda_ended", "ended"],
]);

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const number = nonNegativeNumber(value);
  return number !== null && number > 0 ? number : null;
}

/**
 * Converte uma mensagem recebida num evento nosso, ou `null` se não for do player.
 * Aceita a mensagem como objeto ou como texto JSON (alguns players mandam texto).
 * Quem chama TAMBÉM precisa conferir de onde a mensagem veio (`isPandaPlayerOrigin`).
 */
export function parsePandaPlayerMessage(data: unknown): PandaPlayerEvent | null {
  let value: unknown = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const kind = typeof record.message === "string" ? EVENT_KINDS.get(record.message) : undefined;
  if (!kind) {
    return null;
  }
  return {
    kind,
    currentTime: nonNegativeNumber(record.currentTime),
    duration: positiveNumber(record.duration),
    videoId: typeof record.video === "string" ? record.video : null,
  };
}

/** Mensagem que pede ao player do Panda para pular para `seconds`. */
export function pandaSeekCommand(seconds: number): { type: "currentTime"; parameter: number } {
  return { type: "currentTime", parameter: Math.max(0, Math.floor(seconds)) };
}
