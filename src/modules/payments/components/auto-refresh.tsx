"use client";

/**
 * auto-refresh.tsx — Atualiza a página sozinha, de tempos em tempos (enquanto espera o pagamento).
 *
 * Quem chama: a página de pagamento, só enquanto a cobrança está "aguardando".
 * Como funciona: a cada `seconds`, pede ao Next.js para buscar a página de novo (`router.refresh`,
 * sem recarregar o navegador). Quando o aviso do provedor chega, o status muda e a página mostra
 * "pagamento confirmado". Para depois de `maxMinutes` (se o aluno deixar a aba aberta).
 */
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AutoRefresh({ seconds = 5, maxMinutes = 15 }: { seconds?: number; maxMinutes?: number }) {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > maxMinutes * 60 * 1000) {
        clearInterval(timer);
        return;
      }
      // Aba escondida: não gasta requisições à toa.
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds, maxMinutes]);

  return null;
}
