/**
 * json-ld-script.tsx — Põe os dados estruturados (JSON-LD) na página, num <script> que o Google lê.
 *
 * Quem chama: as páginas públicas (ver `json-ld.ts` para os formatos).
 * Único lugar do site com `dangerouslySetInnerHTML`: é o jeito de pôr um JSON num <script>, e o
 * texto passa antes por `serializeJsonLd`, que impede fechar a tag (ver o comentário de lá).
 */
import { serializeJsonLd, type JsonLdObject } from "./json-ld";

export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
