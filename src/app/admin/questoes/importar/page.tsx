/**
 * page.tsx — Importar questões de uma planilha: /admin/questoes/importar  (PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (atalho da seção de questões).
 * Mostra: o formato da planilha (colunas), um modelo para baixar e o envio do arquivo CSV.
 * Tudo ou nada: com qualquer erro, nada é importado e a tela lista os erros por linha.
 */
import "server-only";

import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import { ImportForm } from "@/modules/questions/admin/components/import-form";
import { QuestionsSubnav } from "@/modules/questions/admin/components/questions-subnav";
import { IMPORT_TEMPLATE_CSV, MAX_IMPORT_ROWS } from "@/modules/questions/import-questions";

export const metadata: Metadata = {
  title: "Importar questões · Painel admin",
  robots: { index: false },
};

// Modelo pronto (ver `IMPORT_TEMPLATE_CSV`). Vai como link "data:", com o BOM para o Excel ler os acentos.
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${IMPORT_TEMPLATE_CSV}\r\n`)}`;

const COLUMNS: Array<[string, string]> = [
  ["codigo", "Opcional. Único: evita importar a mesma questão duas vezes (ex.: BB2023-41)."],
  ["tipo", '"Múltipla escolha" (ou ME) ou "Certo/Errado" (ou CE).'],
  ["enunciado", "O texto da questão (pode ter quebras de linha, entre aspas)."],
  ["a, b, c, d, e", "As alternativas, em sequência a partir do A (de 2 a 5). Vazias no Certo/Errado."],
  ["gabarito", 'A letra certa; no Certo/Errado, "C"/"E" ou "Certo"/"Errado".'],
  ["comentario", "O comentário do professor (obrigatório)."],
  ["assunto", "O identificador ou o nome de um assunto cadastrado."],
  ["banca", "Opcional. Identificador ou nome (em questão de prova, é a da prova)."],
  ["prova", "Opcional. O identificador de uma prova cadastrada (vazio = inédita)."],
];

export default async function ImportQuestionsPage() {
  await requireRole("TEACHER", "/admin/questoes/importar");

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Importar planilha</h1>
        <QuestionsSubnav current="import" />
        <p className="text-muted-foreground text-sm">
          No Excel ou no Google Planilhas, salve como <strong>CSV</strong>. Até {MAX_IMPORT_ROWS} questões por arquivo; elas entram como
          rascunho para você revisar e publicar. Se alguma linha tiver erro, nada é importado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar arquivo</CardTitle>
          <CardDescription>
            <a href={TEMPLATE_HREF} download="modelo-questoes.csv" className="underline">
              Baixar o modelo (CSV)
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm />
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Colunas</CardTitle>
          <CardDescription>A primeira linha é o cabeçalho (acentos e maiúsculas tanto faz; a ordem também).</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-2 text-sm">
            {COLUMNS.map(([name, description]) => (
              <div key={name} className="grid gap-1 sm:grid-cols-[9rem_1fr]">
                <dt className="font-mono font-medium">{name}</dt>
                <dd className="text-muted-foreground">{description}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
