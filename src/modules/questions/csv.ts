/**
 * csv.ts — Lê um arquivo CSV (planilha salva como "CSV") e devolve as linhas e colunas.
 *
 * Quem chama: a importação de questões do painel (`import-questions.ts`).
 *
 * Por que um leitor próprio: é pouco código, sem dependência, e precisamos de três detalhes
 * que aparecem nas planilhas brasileiras:
 *  - o Excel em português separa as colunas com ";" (em inglês, com ","): detectamos pelo cabeçalho;
 *  - enunciados têm vírgulas, aspas e quebras de linha: seguimos a regra do CSV (RFC 4180) —
 *    campo entre aspas pode ter tudo isso, e aspas dentro dele vêm dobradas ("");
 *  - o Excel às vezes põe um caractere invisível (BOM) no começo do arquivo: removemos.
 * Paralelo em Python: é o `csv.reader(arquivo, delimiter=";")`.
 *
 * Arquivo "puro", testado em `csv.test.ts`.
 */

export class CsvError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "CsvError";
  }
}

/** Qual separador o cabeçalho usa: ";" (Excel em português) ou "," (fora de aspas). */
export function detectDelimiter(text: string): ";" | "," {
  let semicolons = 0;
  let commas = 0;
  let inQuotes = false;
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && char === ";") semicolons += 1;
    else if (!inQuotes && char === ",") commas += 1;
  }
  return semicolons >= commas && semicolons > 0 ? ";" : ",";
}

/**
 * Lê o CSV inteiro.
 * Devolve `{ rows, lineNumbers }`: as linhas (listas de textos) e, para cada linha, em que
 * linha do arquivo ela COMEÇA (um enunciado com quebras ocupa várias) — para as mensagens de
 * erro apontarem o lugar certo. Linhas totalmente vazias são ignoradas.
 * Lança `CsvError` se uma aspa abrir e nunca fechar.
 */
export function parseCsv(input: string): { rows: string[][]; lineNumbers: number[] } {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  const lineNumbers: number[] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let line = 1;
  let rowStartLine = 1;
  let quoteStartLine = 1;

  const endField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = "";
    fieldWasQuoted = false;
  };
  const endRow = () => {
    endField();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
      lineNumbers.push(rowStartLine);
    }
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") line += 1;
        field += char;
      }
      continue;
    }
    if (char === '"' && field.trim().length === 0) {
      inQuotes = true;
      fieldWasQuoted = true;
      field = "";
      quoteStartLine = line;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
      line += 1;
      rowStartLine = line;
    } else {
      field += char;
    }
  }
  if (inQuotes) throw new CsvError(`Aspas abertas e não fechadas (começam na linha ${quoteStartLine}).`, quoteStartLine);
  endRow();
  return { rows, lineNumbers };
}

/**
 * Normaliza o nome de uma coluna para comparar: sem acento, minúsculas, sem espaços nas pontas
 * ("Comentário " → "comentario").
 */
export function normalizeHeader(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
