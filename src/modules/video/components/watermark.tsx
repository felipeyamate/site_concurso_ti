"use client";

/**
 * watermark.tsx — Marca d'água com o e-mail do aluno, por cima do vídeo.
 *
 * Quem chama: `video-player.tsx`.
 * Por que existe: antipirataria. Se alguém gravar a tela e espalhar a aula, o e-mail de quem
 * gravou aparece no vídeo. Ela muda de lugar a cada 20 segundos para não dar para cortar.
 * (Na Fase 3, o Panda Video coloca também a marca d'água dele, dentro do próprio vídeo.)
 */
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

// Cantos e meio da tela, em ordem. Classes do Tailwind para posicionar o texto.
const POSITIONS = [
  "left-4 top-4",
  "right-4 top-1/3",
  "left-1/3 bottom-16",
  "right-6 bottom-24",
  "left-6 top-1/2",
];
const MOVE_EVERY_MS = 20_000;

export function Watermark({ text }: { text: string }) {
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    // setInterval = "repita a cada N milissegundos" (como um loop com time.sleep, sem travar a tela).
    const timer = setInterval(() => {
      setPositionIndex((current) => (current + 1) % POSITIONS.length);
    }, MOVE_EVERY_MS);
    return () => clearInterval(timer); // limpa o timer quando o componente sai da tela
  }, []);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-10 text-xs font-medium text-white/60 transition-all duration-1000 select-none sm:text-sm",
        "[text-shadow:0_1px_2px_rgb(0_0_0/0.8)]",
        POSITIONS[positionIndex],
      )}
    >
      {text}
    </span>
  );
}
