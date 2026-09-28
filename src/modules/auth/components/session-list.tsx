"use client";

/**
 * session-list.tsx — Lista "Dispositivos conectados", com botão para desconectar os outros.
 *
 * Quem chama: `src/app/area-do-aluno/page.tsx`, que busca as sessões no servidor e passa
 * para cá uma lista já pronta para exibição (sem tokens nem dados sensíveis).
 */
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { revokeOtherSessionAction } from "../actions";

export type SessionListItem = {
  id: string;
  deviceLabel: string;
  signedInAt: string; // data já formatada em português, ex.: "28/09/2026 14:30"
  isCurrent: boolean;
};

export function SessionList({ sessions }: { sessions: SessionListItem[] }) {
  // `useTransition` marca a ação como "em andamento" sem travar a tela.
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRevoke(sessionId: string) {
    setError(null);
    startTransition(async () => {
      const result = await revokeOtherSessionAction(sessionId);
      if (!result.ok) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-3">
      <ul className="divide-y rounded-md border">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="grid gap-0.5">
              <span className="text-sm font-medium">
                {session.deviceLabel}
                {session.isCurrent ? (
                  <span className="text-muted-foreground font-normal"> — este dispositivo</span>
                ) : null}
              </span>
              <span className="text-muted-foreground text-xs">Entrou em {session.signedInAt}</span>
            </div>
            {session.isCurrent ? null : (
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRevoke(session.id)}
              >
                Desconectar
              </Button>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
