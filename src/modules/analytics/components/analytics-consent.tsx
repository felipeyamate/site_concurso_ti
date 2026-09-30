"use client";

/**
 * analytics-consent.tsx — Aviso de cookies + análise de uso (PostHog), só com consentimento (LGPD).
 *
 * Quem chama: o layout raiz (`src/app/layout.tsx`), em todas as páginas.
 * O que faz:
 *  - Sem NEXT_PUBLIC_POSTHOG_KEY: nada (não há cookies de análise, então não há o que perguntar).
 *  - Com a chave: se a pessoa ainda não escolheu, mostra o aviso ("Aceitar análise" / "Só os
 *    essenciais"). Aceitou → carrega o PostHog e conta as visitas de cada página. Recusou → nada é
 *    carregado. A escolha fica 1 ano no cookie `ct_cookies` e pode mudar pelo rodapé
 *    ("Preferências de cookies"), que reabre este aviso.
 *
 * Privacidade do PostHog: sem gravação de tela, sem captura automática de cliques e textos, sem
 * identificar a pessoa (nada de nome ou e-mail) — só as páginas visitadas, e sem os ?parâmetros do
 * endereço (`sanitizeAnalyticsEvent`: o link de redefinir a senha, por exemplo, leva um token secreto).
 * O PostHog é carregado "sob demanda" (`import()`): quem recusa nem baixa o código dele.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PostHog } from "posthog-js";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

import { OPEN_COOKIE_PREFERENCES_EVENT, analyticsChoiceCookie, readAnalyticsChoice, sanitizeAnalyticsEvent, type AnalyticsChoice } from "../consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// A escolha guardada no cookie, lida como uma "fonte externa" (useSyncExternalStore): o React relê
// quando avisamos que ela mudou. "none" = ainda não escolheu; "unknown" = no servidor (sem cookie ainda).
const CONSENT_CHANGED_EVENT = "ct:escolha-de-cookies-mudou";
function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_CHANGED_EVENT, callback);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, callback);
}
function readStoredChoice(): AnalyticsChoice | "none" {
  return readAnalyticsChoice(document.cookie) ?? "none";
}
function serverChoice(): "unknown" {
  return "unknown";
}

export function AnalyticsConsent() {
  const stored = useSyncExternalStore(subscribe, readStoredChoice, serverChoice);
  // O rodapé ("Preferências de cookies") pode reabrir o aviso mesmo depois da escolha.
  const [reopened, setReopened] = useState(false);
  const posthogRef = useRef<PostHog | null>(null);
  // O PostHog está sendo baixado agora (evita baixar/ligar duas vezes).
  const loadingRef = useRef(false);
  const pathname = usePathname();

  // 1. Escuta o "Preferências de cookies" do rodapé.
  useEffect(() => {
    const reopen = () => setReopened(true);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, reopen);
  }, []);

  // 2. Liga/desliga o PostHog conforme a escolha.
  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (stored === "analytics" && !posthogRef.current && !loadingRef.current) {
      loadingRef.current = true;
      import("posthog-js")
        .then(({ default: posthog }) => {
          // A pessoa pode ter voltado atrás enquanto o PostHog carregava ("Só os essenciais"):
          // confere a escolha de novo AGORA, antes de ligar qualquer coisa.
          if (readStoredChoice() !== "analytics") return;
          posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            capture_pageview: false, // contamos as páginas "à mão" (navegação sem recarregar)
            autocapture: false,
            disable_session_recording: true,
            person_profiles: "identified_only",
            respect_dnt: true,
            // Endereços sem ?parâmetros (ex.: o link de redefinir a senha leva um token secreto).
            before_send: (event) => sanitizeAnalyticsEvent(event),
          });
          posthog.opt_in_capturing();
          posthogRef.current = posthog;
          posthog.capture("$pageview");
        })
        // Sem internet ou bloqueador de anúncios: o site segue normal, só sem a análise.
        .catch(() => undefined)
        .finally(() => {
          loadingRef.current = false;
        });
    }
    if (stored === "essential" && posthogRef.current) {
      // Retirou o consentimento: para de coletar e apaga o identificador guardado no navegador.
      posthogRef.current.opt_out_capturing();
      posthogRef.current.reset();
      posthogRef.current = null;
    }
  }, [stored]);

  // 3. A cada troca de página (sem recarregar), conta uma visita — só com o consentimento.
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    if (!posthogRef.current || lastPath.current === pathname) return;
    lastPath.current = pathname;
    posthogRef.current.capture("$pageview");
  }, [pathname]);

  const showBanner = stored === "none" || (reopened && stored !== "unknown");

  if (!POSTHOG_KEY || !showBanner) return null;

  function decide(next: AnalyticsChoice) {
    document.cookie = analyticsChoiceCookie(next, window.location.protocol === "https:");
    setReopened(false);
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT)); // o React relê o cookie
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de cookies"
      className="bg-background fixed inset-x-0 bottom-0 z-50 border-t p-4 shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 basis-72 text-sm">
          Usamos cookies essenciais para o site funcionar (login) e, se você permitir, cookies de análise para entender como o
          site é usado e melhorá-lo. Veja a{" "}
          <Link href="/privacidade" className="underline">
            Política de privacidade
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => decide("essential")}>
            Só os essenciais
          </Button>
          <Button size="sm" onClick={() => decide("analytics")}>
            Aceitar análise
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Link do rodapé que reabre o aviso (só aparece quando a análise está configurada). */
export function CookiePreferencesLink() {
  if (!POSTHOG_KEY) return null;
  return (
    <button type="button" className="hover:underline" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))}>
      Preferências de cookies
    </button>
  );
}
