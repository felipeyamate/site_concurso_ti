/**
 * import-questions.test.ts — Importação de questões por planilha (tudo ou nada).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";
import { MAX_IMPORT_ROWS, importCodes, parseQuestionImport } from "./import-questions";

const lookups = {
  subjects: [
    { id: "s-seg", name: "Segurança da Informação", slug: "seguranca-da-informacao" },
    { id: "s-redes", name: "Redes", slug: "redes" },
  ],
  boards: [
    { id: "b-ces", name: "Cesgranrio", slug: "cesgranrio" },
    { id: "b-cebraspe", name: "Cebraspe", slug: "cebraspe" },
  ],
  exams: [{ id: "e-bb", slug: "bb-2024", boardId: "b-ces" }],
  existingCodes: new Set(["JA-EXISTE"]),
};

function importCsv(text: string) {
  const { rows, lineNumbers } = parseCsv(text);
  return parseQuestionImport({ rows, lineNumbers, ...lookups });
}

const HEADER = "Código;Tipo;Enunciado;A;B;C;D;E;Gabarito;Comentário;Assunto;Banca;Prova";

describe("parseQuestionImport", () => {
  it("importa múltipla escolha de prova (banca vem da prova) e Certo/Errado inédita", () => {
    const result = importCsv(
      [
        HEADER,
        'BB-1;Múltipla escolha;"O que é um firewall?";Antivírus;Filtro de tráfego;Backup;;;B;Filtra o tráfego da rede.;seguranca-da-informacao;;bb-2024',
        ";Certo/Errado;HTTPS criptografa a comunicação.;;;;;;certo;Correto: usa TLS.;Redes;cebraspe;",
      ].join("\n"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toEqual([
      {
        line: 2,
        code: "BB-1",
        type: "MULTIPLE_CHOICE",
        statement: "O que é um firewall?",
        options: [
          { label: "A", text: "Antivírus" },
          { label: "B", text: "Filtro de tráfego" },
          { label: "C", text: "Backup" },
        ],
        correctAnswer: "B",
        explanation: "Filtra o tráfego da rede.",
        subjectId: "s-seg",
        boardId: "b-ces",
        examId: "e-bb",
      },
      {
        line: 3,
        code: null,
        type: "TRUE_FALSE",
        statement: "HTTPS criptografa a comunicação.",
        options: [],
        correctAnswer: "C",
        explanation: "Correto: usa TLS.",
        subjectId: "s-redes",
        boardId: "b-cebraspe",
        examId: null,
      },
    ]);
  });

  it("tudo ou nada: qualquer erro devolve só os erros, com o número da linha", () => {
    const result = importCsv(
      [
        HEADER,
        ";ME;Ok;x;y;;;;A;Comentário;redes;;",
        ";Dissertativa;Tipo errado;;;;;;A;Comentário;redes;;",
        ";ME;Pula letra;x;;z;;;A;Comentário;redes;;",
        ";CE;Sem comentário;;;;;;C;;redes;;",
        ";ME;Assunto desconhecido;x;y;;;;A;Comentário;banco-de-dados;;",
        ";ME;Prova de outra banca;x;y;;;;A;Comentário;redes;cebraspe;bb-2024",
        "JA-EXISTE;ME;Código repetido;x;y;;;;A;Comentário;redes;;",
      ].join("\n"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const lines = result.errors.map((error) => error.line);
    expect(lines).not.toContain(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { line: 3, message: 'Tipo inválido: use "Múltipla escolha" ou "Certo/Errado".' },
        { line: 4, message: "Alternativa B sem texto (as alternativas seguem a ordem A, B, C... sem pular)." },
        { line: 5, message: "Comentário vazio (toda questão precisa ser comentada)." },
        { line: 6, message: 'Assunto não cadastrado: "banco-de-dados".' },
        { line: 7, message: "A banca não é a da prova informada." },
        { line: 8, message: 'Já existe uma questão com o código "JA-EXISTE".' },
      ]),
    );
  });

  it("código repetido na própria planilha e Certo/Errado com alternativas", () => {
    const result = importCsv(
      [HEADER, "X1;ME;Um;a;b;;;;A;c;redes;;", "X1;ME;Dois;a;b;;;;A;c;redes;;", ";CE;Três;a;;;;;C;c;redes;;"].join("\n"),
    );
    expect(result).toMatchObject({
      ok: false,
      errors: expect.arrayContaining([
        { line: 3, message: 'Código "X1" repetido na planilha.' },
        { line: 4, message: "Questão de Certo/Errado não usa as colunas de alternativas (a..e)." },
      ]),
    });
  });

  it("cabeçalho sem colunas obrigatórias, planilha vazia e excesso de linhas", () => {
    expect(importCsv("tipo;enunciado\nME;x")).toMatchObject({
      ok: false,
      errors: [{ line: 1, message: "Faltam colunas no cabeçalho: gabarito, comentario, assunto." }],
    });
    expect(importCsv(HEADER)).toMatchObject({ ok: false, errors: [{ line: 1 }] });
    const many = [HEADER, ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => ";CE;x;;;;;;C;c;redes;;")].join("\n");
    expect(importCsv(many)).toMatchObject({ ok: false, errors: [{ line: 1, message: expect.stringContaining("No máximo") }] });
  });
});

describe("importCodes", () => {
  it("só a coluna `codigo`, sem espaços nas pontas e sem repetir (as outras células não entram)", () => {
    const { rows } = parseCsv([HEADER, '" BB-1 ";ME;Enunciado longo;a;b;;;;A;Comentário;seguranca;;', ";ME;Sem código;a;b;;;;A;c;seguranca;;", "BB-1;ME;x;a;b;;;;A;c;seguranca;;"].join("\n"));
    expect(importCodes(rows)).toEqual(["BB-1"]);
  });

  it("sem a coluna `codigo`: nenhum código", () => {
    const { rows } = parseCsv(["tipo;enunciado;a;b;gabarito;comentario;assunto", "ME;x;a;b;A;c;seguranca"].join("\n"));
    expect(importCodes(rows)).toEqual([]);
  });
});
