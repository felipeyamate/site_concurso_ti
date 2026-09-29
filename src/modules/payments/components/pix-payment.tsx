"use client";

/**
 * pix-payment.tsx — QR Code do Pix + o "copia e cola" com botão de copiar.
 *
 * Quem chama: a página de pagamento (/area-do-aluno/pagamentos/[id]).
 * "use client" porque copiar para a área de transferência só existe no navegador.
 */
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function PixPayment({ image, payload }: { image: string; payload: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Sem permissão para copiar: o aluno ainda pode selecionar o texto à mão.
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem em base64 (data URL), não um arquivo */}
      <img src={image} alt="QR Code do Pix" width={200} height={200} className="size-[200px] rounded-md border bg-white p-2" />
      <div className="grid min-w-0 gap-2">
        <p className="text-sm">
          Abra o app do seu banco, escolha <strong>Pix → Ler QR Code</strong> ou <strong>Pix Copia e Cola</strong>:
        </p>
        <textarea
          readOnly
          value={payload}
          aria-label="Código Pix copia e cola"
          rows={3}
          className="border-input w-full resize-none rounded-md border bg-transparent p-2 font-mono text-xs break-all"
          onFocus={(event) => event.currentTarget.select()}
        />
        <div>
          <Button type="button" variant="outline" size="sm" onClick={copy}>
            {copied ? "Copiado!" : "Copiar código Pix"}
          </Button>
        </div>
      </div>
    </div>
  );
}
