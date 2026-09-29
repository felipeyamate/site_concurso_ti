/**
 * format.ts — Formatação de datas para exibição (padrão brasileiro).
 *
 * Quem chama: páginas que mostram datas (ex.: "Entrou em 28/09/2026 14:30") e durações
 * de aulas/cursos (ex.: "12 min", "2 h 05 min").
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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" });

/** Só a data, ex.: "28/09/2026" (no horário de Brasília). */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * Duração legível para o aluno. Arredonda para minutos (mínimo 1 min se houver algum segundo).
 * Exemplos: 540 → "9 min"; 3900 → "1 h 05 min"; 7200 → "2 h"; 0 → "0 min".
 */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0 min";
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${String(minutes).padStart(2, "0")} min`;
}
