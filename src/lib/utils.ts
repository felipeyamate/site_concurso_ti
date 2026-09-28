/**
 * utils.ts — Utilitário `cn` usado pelos componentes de interface (shadcn/ui).
 *
 * Quem chama: praticamente todo componente visual, para montar a lista de classes CSS.
 * O que devolve: um texto com as classes do Tailwind, sem conflitos.
 *
 * Exemplo: cn("px-2 py-1", isActive && "bg-black", "px-4") → "py-1 bg-black px-4"
 * (o "px-4" do final vence o "px-2", e valores falsos são ignorados).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
