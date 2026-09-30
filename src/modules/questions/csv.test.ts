/**
 * csv.test.ts — Leitura de planilhas CSV (separador ";" ou ",", aspas, quebras de linha).
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import { CsvError, decodeCsvBytes, detectDelimiter, normalizeHeader, parseCsv } from "./csv";

describe("detectDelimiter", () => {
  it("Excel em português usa ';'; em inglês, ','", () => {
    expect(detectDelimiter("tipo;enunciado;gabarito\n...")).toBe(";");
    expect(detectDelimiter("tipo,enunciado,gabarito\n...")).toBe(",");
    // Vírgulas dentro de aspas não contam.
    expect(detectDelimiter('"a,b,c";x;y\n')).toBe(";");
  });
});

describe("parseCsv", () => {
  it("campos com aspas, aspas dobradas, separador e quebra de linha dentro", () => {
    const text = 'tipo;enunciado;gabarito\r\nME;"Leia: ""firewall""; depois\nresponda";A\r\nCE;Simples;C\r\n';
    const { rows, lineNumbers } = parseCsv(text);
    expect(rows).toEqual([
      ["tipo", "enunciado", "gabarito"],
      ["ME", 'Leia: "firewall"; depois\nresponda', "A"],
      ["CE", "Simples", "C"],
    ]);
    // A 2ª questão começa na linha 4 do arquivo (o enunciado anterior ocupou duas linhas).
    expect(lineNumbers).toEqual([1, 2, 4]);
  });

  it("remove o BOM do Excel, ignora linhas vazias e apara espaços fora de aspas", () => {
    const { rows } = parseCsv("﻿a,b\n\n  x , y \n,\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });

  it("aspas nunca fechadas: erro apontando a linha", () => {
    expect(() => parseCsv('a;b\nME;"sem fim\n')).toThrowError(CsvError);
    try {
      parseCsv('a;b\nME;"sem fim\n');
    } catch (error) {
      expect((error as CsvError).line).toBe(2);
    }
  });
});

describe("normalizeHeader", () => {
  it("sem acento, minúsculas e sem espaços nas pontas", () => {
    expect(normalizeHeader(" Comentário ")).toBe("comentario");
    expect(normalizeHeader("Código")).toBe("codigo");
  });
});

describe("decodeCsvBytes", () => {
  const text = "tipo;enunciado\nMúltipla escolha;Ação “segura”";

  it("UTF-8 (com ou sem BOM) sai igual", () => {
    const utf8 = new TextEncoder().encode(text);
    expect(decodeCsvBytes(utf8)).toBe(text);
    expect(decodeCsvBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]))).toBe(text);
  });

  it("Windows-1252 (o 'CSV separado por ponto e vírgula' do Excel em português) também", () => {
    // Em Windows-1252: ú = 0xFA, ç = 0xE7, ã = 0xE3, aspas curvas = 0x93 e 0x94.
    const bytes: number[] = [];
    for (const char of text) {
      const special: Record<string, number> = { "ú": 0xfa, "ç": 0xe7, "ã": 0xe3, "“": 0x93, "”": 0x94 };
      bytes.push(special[char] ?? char.charCodeAt(0));
    }
    expect(decodeCsvBytes(new Uint8Array(bytes))).toBe(text);
  });
});
