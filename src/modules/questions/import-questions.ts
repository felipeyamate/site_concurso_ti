/**
 * import-questions.ts — Transforma as linhas de uma planilha (CSV) em questões prontas para
 * gravar, conferindo cada uma.
 *
 * Quem chama: `admin/questions-admin.server.ts` (importação do painel), que depois grava tudo
 * numa transação. Aqui não há banco: recebemos as bancas/assuntos/provas já buscados.
 *
 * Regra "tudo ou nada": se QUALQUER linha tiver problema, nada é importado e o professor recebe
 * a lista de erros com o número da linha — corrige a planilha e importa de novo, sem duplicar.
 * As questões importadas entram como RASCUNHO (o professor revisa e publica).
 *
 * Colunas (o nome pode ter acento/maiúsculas; a ordem não importa):
 *   codigo (opcional) · tipo · enunciado · a · b · c · d · e · gabarito · comentario ·
 *   assunto · banca (opcional) · prova (opcional)
 *
 * Arquivo "puro", testado em `import-questions.test.ts`.
 */
import type { QuestionType } from "@/generated/prisma/enums";

import { OPTION_LABELS, validateQuestionContent } from "./answers";
import { normalizeHeader } from "./csv";
import { QUESTION_LIMITS } from "./limits";

export const MAX_IMPORT_ROWS = 500;
// Mostra no máximo estes erros (uma planilha toda errada não precisa de 500 mensagens).
const MAX_REPORTED_ERRORS = 50;

const REQUIRED_COLUMNS = ["tipo", "enunciado", "gabarito", "comentario", "assunto"] as const;

/**
 * Modelo de planilha que o painel oferece para baixar (separado por ";", como o Excel em português
 * salva). Os assuntos e a banca são os do conteúdo de exemplo (`npm run db:seed`), para o modelo
 * importar sem erro num banco de desenvolvimento — o teste `import-questions.test.ts` confere isso.
 */
export const IMPORT_TEMPLATE_CSV = [
  "codigo;tipo;enunciado;a;b;c;d;e;gabarito;comentario;assunto;banca;prova",
  'EX-1;Múltipla escolha;"Qual programa bloqueia acessos não autorizados à rede?";Antivírus;Firewall;Navegador;Planilha;;B;"O firewall filtra o tráfego da rede; o antivírus procura programas maliciosos.";seguranca-da-informacao;;',
  "EX-2;Certo/Errado;O protocolo HTTPS criptografa a comunicação entre o navegador e o site.;;;;;;C;Certo: o HTTPS usa TLS para criptografar.;redes-e-internet;cebraspe;",
].join("\r\n");

export type NamedRef = { id: string; name: string; slug: string };
export type ExamRef = { id: string; slug: string; boardId: string };

export type ImportedQuestion = {
  line: number;
  code: string | null;
  type: QuestionType;
  statement: string;
  options: Array<{ label: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  subjectId: string;
  boardId: string | null;
  examId: string | null;
};

export type ImportError = { line: number; message: string };
export type ImportResult = { ok: true; questions: ImportedQuestion[] } | { ok: false; errors: ImportError[] };

// "Múltipla escolha", "ME", "multipla" → MULTIPLE_CHOICE; "Certo/Errado", "CE" → TRUE_FALSE.
function parseType(value: string): QuestionType | null {
  const key = normalizeHeader(value).replace(/[^a-z]/g, "");
  if (["multiplaescolha", "multipla", "me", "ae"].includes(key)) return "MULTIPLE_CHOICE";
  if (["certoerrado", "certoouerrado", "ce"].includes(key)) return "TRUE_FALSE";
  return null;
}

// "a" → "A"; "Certo" → "C"; "Errado" → "E".
function parseAnswer(value: string): string {
  const key = normalizeHeader(value);
  if (key === "certo") return "C";
  if (key === "errado") return "E";
  return value.trim().toUpperCase();
}

/** Acha pelo slug ou pelo nome (sem diferença de acento/maiúsculas). */
function findByKey<T extends { slug: string; name?: string }>(items: readonly T[], value: string): T | undefined {
  const key = normalizeHeader(value);
  return items.find((item) => item.slug === value.trim() || (item.name !== undefined && normalizeHeader(item.name) === key));
}

/**
 * Confere as linhas e monta as questões.
 * Passos:
 *  1. Cabeçalho: colunas obrigatórias presentes; limite de linhas.
 *  2. Cada linha: tipo, textos, alternativas, gabarito (`validateQuestionContent`), assunto,
 *     banca e prova existentes (a banca de uma questão de prova é a da prova), código único
 *     (na planilha e no banco).
 *  3. Algum erro → devolve os erros; senão, as questões.
 */
export function parseQuestionImport(input: {
  rows: string[][];
  lineNumbers: number[];
  subjects: readonly NamedRef[];
  boards: readonly NamedRef[];
  exams: readonly ExamRef[];
  existingCodes: ReadonlySet<string>;
}): ImportResult {
  const errors: ImportError[] = [];
  const [header, ...dataRows] = input.rows;
  if (!header || dataRows.length === 0) {
    return { ok: false, errors: [{ line: 1, message: "A planilha está vazia (precisa do cabeçalho e de pelo menos uma questão)." }] };
  }
  const columns = header.map(normalizeHeader);
  const missing = REQUIRED_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    return { ok: false, errors: [{ line: 1, message: `Faltam colunas no cabeçalho: ${missing.join(", ")}.` }] };
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { ok: false, errors: [{ line: 1, message: `No máximo ${MAX_IMPORT_ROWS} questões por planilha (esta tem ${dataRows.length}).` }] };
  }

  const cell = (row: string[], name: string): string => {
    const index = columns.indexOf(name);
    return index >= 0 ? (row[index] ?? "").trim() : "";
  };
  const codesInFile = new Set<string>();
  const questions: ImportedQuestion[] = [];

  dataRows.forEach((row, index) => {
    const line = input.lineNumbers[index + 1] ?? index + 2;
    const problems: string[] = [];

    const type = parseType(cell(row, "tipo"));
    if (!type) problems.push('Tipo inválido: use "Múltipla escolha" ou "Certo/Errado".');

    const statement = cell(row, "enunciado");
    if (!statement) problems.push("Enunciado vazio.");
    else if (statement.length > QUESTION_LIMITS.statement) problems.push(`Enunciado com mais de ${QUESTION_LIMITS.statement} caracteres.`);

    const explanation = cell(row, "comentario");
    if (!explanation) problems.push("Comentário vazio (toda questão precisa ser comentada).");
    else if (explanation.length > QUESTION_LIMITS.explanation) problems.push(`Comentário com mais de ${QUESTION_LIMITS.explanation} caracteres.`);

    // Alternativas: as colunas a..e preenchidas, em sequência (a validação confere se pulou letra).
    const options = OPTION_LABELS.map((label) => ({ label, text: cell(row, label.toLowerCase()) }));
    const lastFilled = options.reduce((last, option, position) => (option.text ? position : last), -1);
    const usedOptions = type === "MULTIPLE_CHOICE" ? options.slice(0, lastFilled + 1) : [];
    if (type === "TRUE_FALSE" && lastFilled >= 0) problems.push("Questão de Certo/Errado não usa as colunas de alternativas (a..e).");
    if (usedOptions.some((option) => option.text.length > QUESTION_LIMITS.option)) {
      problems.push(`Alternativa com mais de ${QUESTION_LIMITS.option} caracteres.`);
    }

    const correctAnswer = parseAnswer(cell(row, "gabarito"));
    if (type) problems.push(...validateQuestionContent({ type, options: usedOptions, correctAnswer }));

    const subjectKey = cell(row, "assunto");
    const subject = subjectKey ? findByKey(input.subjects, subjectKey) : undefined;
    if (!subject) problems.push(subjectKey ? `Assunto não cadastrado: "${subjectKey}".` : "Assunto vazio.");

    const examKey = cell(row, "prova");
    const exam = examKey ? input.exams.find((item) => item.slug === examKey) : undefined;
    if (examKey && !exam) problems.push(`Prova não cadastrada: "${examKey}" (use o identificador da prova).`);

    const boardKey = cell(row, "banca");
    const board = boardKey ? findByKey(input.boards, boardKey) : undefined;
    if (boardKey && !board) problems.push(`Banca não cadastrada: "${boardKey}".`);
    if (exam && board && board.id !== exam.boardId) problems.push("A banca não é a da prova informada.");

    const code = cell(row, "codigo") || null;
    if (code) {
      if (code.length > QUESTION_LIMITS.code) problems.push(`Código com mais de ${QUESTION_LIMITS.code} caracteres.`);
      if (codesInFile.has(code)) problems.push(`Código "${code}" repetido na planilha.`);
      else if (input.existingCodes.has(code)) problems.push(`Já existe uma questão com o código "${code}".`);
      codesInFile.add(code);
    }

    if (problems.length > 0) {
      for (const message of problems) errors.push({ line, message });
      return;
    }
    questions.push({
      line,
      code,
      type: type as QuestionType,
      statement,
      options: usedOptions,
      correctAnswer,
      explanation,
      subjectId: (subject as NamedRef).id,
      boardId: exam ? exam.boardId : (board?.id ?? null),
      examId: exam?.id ?? null,
    });
  });

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, MAX_REPORTED_ERRORS) };
  return { ok: true, questions };
}
