/**
 * dates.ts — Datas "de calendário" usadas nas cobranças (vencimento, ciclos da assinatura).
 *
 * Quem chama: as regras de pagamento (`rules.ts`, `access-sync.ts`) e o provedor (o Asaas usa
 * datas no formato "AAAA-MM-DD", no horário de Brasília).
 *
 * Por que um arquivo só para isso: "hoje" depende do fuso. Às 22h de 29/09 em Brasília já é 30/09
 * em UTC (o horário dos servidores da Vercel). Aqui todas as contas usam o dia de BRASÍLIA.
 * Paralelo em Python: é a diferença entre `date.today()` e `datetime.now(ZoneInfo("America/Sao_Paulo")).date()`.
 *
 * Arquivo "puro", testado em `dates.test.ts`.
 */

export type DateOnly = string; // "AAAA-MM-DD"

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// "en-CA" formata datas como AAAA-MM-DD (o formato que queremos).
const saoPauloDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Que dia é (em Brasília) neste instante. */
export function toSaoPauloDate(instant: Date): DateOnly {
  return saoPauloDateFormatter.format(instant);
}

/** "2026-09-29" → Date à meia-noite UTC (formato das colunas de data do banco, `@db.Date`). */
export function dateOnlyToUtc(date: DateOnly): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Date de uma coluna de data do banco → "2026-09-29". */
export function utcToDateOnly(date: Date): DateOnly {
  return date.toISOString().slice(0, 10);
}

/**
 * O instante em que o dia COMEÇA em Brasília (00:00 de Brasília = 03:00 UTC; o Brasil não tem
 * horário de verão desde 2019). Usado como fim de um acesso: "até 04/11" = até 04/11 00:00.
 */
export function startOfDayInSaoPaulo(date: DateOnly): Date {
  return new Date(`${date}T03:00:00Z`);
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return utcToDateOnly(new Date(dateOnlyToUtc(date).getTime() + days * DAY_IN_MS));
}

/**
 * Soma meses a uma data, sem "pular" o mês: 31/01 + 1 mês = 28/02 (ou 29/02), não 03/03.
 * (Mesmo comportamento do `relativedelta(months=1)` do Python.)
 */
export function addMonths(date: DateOnly, months: number): DateOnly {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return utcToDateOnly(target);
}

/** Dias inteiros entre dois instantes (b − a), arredondando para baixo. */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_IN_MS);
}

/**
 * Coluna de data do banco (meia-noite UTC) → "30/09/2026".
 * Não usar `formatDate` aqui: no fuso de Brasília, meia-noite UTC ainda é o DIA ANTERIOR.
 */
export function formatDateOnly(date: Date): string {
  const [year, month, day] = utcToDateOnly(date).split("-");
  return `${day}/${month}/${year}`;
}
