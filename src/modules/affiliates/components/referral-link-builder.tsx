"use client";

/**
 * referral-link-builder.tsx — Monta o link de divulgação para uma página escolhida e copia.
 *
 * Quem chama: a área do afiliado e a ficha dele no painel.
 * "use client": o link muda enquanto a pessoa digita e o botão usa a área de transferência.
 * Só caminhos do site ("/cursos/..."); o servidor confere de novo ao abrir o link.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { referralLink } from "../rules";

export function ReferralLinkBuilder({ siteUrl, code }: { siteUrl: string; code: string }) {
  const [path, setPath] = useState("/");
  const [copied, setCopied] = useState(false);
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/";
  const link = referralLink(siteUrl, code, safePath);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="referral-path">Página de destino (ex.: /cursos/informatica-e-ti-do-zero ou /planos)</Label>
        <Input id="referral-path" value={path} onChange={(event) => setPath(event.target.value.trim() || "/")} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <code className="bg-muted rounded px-2 py-1 text-sm break-all" data-testid="referral-link">
          {link}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copiado!" : "Copiar link"}
        </Button>
      </div>
    </div>
  );
}
