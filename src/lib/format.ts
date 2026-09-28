/**
 * format.ts — Formatação de datas para exibição (padrão brasileiro).
 *
 * Quem chama: páginas que mostram datas (ex.: "Entrou em 28/09/2026 14:30").
 *
 * Por que fixar o fuso horário: o servidor da Vercel roda em UTC. Sem fixar
 * "America/Sao_Paulo", um login às 21h apareceria como "00h do dia seguinte".
 */

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}
