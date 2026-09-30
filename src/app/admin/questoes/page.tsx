/**
 * page.tsx — Questões no painel: /admin/questoes  (exige perfil PROFESSOR ou mais)
 *
 * Quem chama: o Next.js (menu "Questões" do painel).
 * Mostra: a lista de questões (busca por texto/código, filtros por assunto, banca e situação),
 * com publicar/despublicar e o link para editar. 30 por página.
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { ActionButton } from "@/components/admin/action-button";
import { Pager, firstParam, pageParam } from "@/components/admin/pager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { requireRole } from "@/modules/auth/session";
import { setQuestionPublishedAction } from "@/modules/questions/admin/actions";
import { QuestionsSubnav } from "@/modules/questions/admin/components/questions-subnav";
import { listClassification, listQuestionsForAdmin, type AdminQuestionFilters } from "@/modules/questions/admin/questions-admin.server";
import { QUESTION_TYPE_LABELS } from "@/modules/questions/labels";

export const metadata: Metadata = {
  title: "Questões · Painel admin",
  robots: { index: false },
};

const STATUS_OPTIONS = { all: "Todas", published: "Publicadas", draft: "Rascunhos" } as const;

export default async function AdminQuestionsPage({ searchParams }: PageProps<"/admin/questoes">) {
  await requireRole("TEACHER", "/admin/questoes");
  const params = await searchParams;
  const statusParam = firstParam(params.situacao);
  const filters: AdminQuestionFilters = {
    search: firstParam(params.busca).slice(0, 100),
    subjectId: firstParam(params.assunto) || null,
    boardId: firstParam(params.banca) || null,
    status: statusParam === "published" || statusParam === "draft" ? statusParam : "all",
    page: pageParam(params.pagina),
  };
  const [{ questions, total, page, pageCount }, classification] = await Promise.all([
    listQuestionsForAdmin(filters),
    listClassification(),
  ]);

  const hrefFor = (target: number) => {
    const query = new URLSearchParams();
    if (filters.search) query.set("busca", filters.search);
    if (filters.subjectId) query.set("assunto", filters.subjectId);
    if (filters.boardId) query.set("banca", filters.boardId);
    if (filters.status !== "all") query.set("situacao", filters.status);
    query.set("pagina", String(target));
    return `/admin/questoes?${query.toString()}`;
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6">
      <div className="grid gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Questões</h1>
        <QuestionsSubnav current="list" />
        <p className="text-muted-foreground text-sm">
          {total} questão(ões). Só as publicadas aparecem para os alunos. Questão já respondida não se apaga: despublique.
        </p>
      </div>

      <form action="/admin/questoes" className="flex flex-wrap gap-2" role="search">
        <Input name="busca" defaultValue={filters.search} placeholder="Texto ou código" aria-label="Buscar" className="min-w-0 flex-1 sm:max-w-xs" />
        <NativeSelect name="assunto" defaultValue={filters.subjectId ?? ""} aria-label="Assunto" className="w-auto">
          <option value="">Todos os assuntos</option>
          {classification.subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="banca" defaultValue={filters.boardId ?? ""} aria-label="Banca" className="w-auto">
          <option value="">Todas as bancas</option>
          {classification.boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="situacao" defaultValue={filters.status} aria-label="Situação" className="w-auto">
          {Object.entries(STATUS_OPTIONS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      {questions.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm">
          Nenhuma questão encontrada.{" "}
          <Link href="/admin/questoes/nova" className="underline">
            Cadastrar uma
          </Link>{" "}
          ou{" "}
          <Link href="/admin/questoes/importar" className="underline">
            importar uma planilha
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-3">
          {questions.map((question) => (
            <li key={question.id} className="grid gap-2 rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={question.isPublished ? "default" : "outline"}>{question.isPublished ? "Publicada" : "Rascunho"}</Badge>
                <Badge variant="secondary">{question.subject.name}</Badge>
                <span className="text-muted-foreground">
                  {question.exam ? `${question.exam.name} (${question.exam.year})` : "Inédita"}
                  {question.board ? ` · ${question.board.name}` : ""} · {QUESTION_TYPE_LABELS[question.type]}
                  {question.code ? ` · ${question.code}` : ""} · {question._count.attempts} resposta(s)
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{question.statement}</p>
              <div className="flex flex-wrap items-start gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/questoes/${question.id}`}>Editar</Link>
                </Button>
                <ActionButton
                  action={setQuestionPublishedAction}
                  fields={{ id: question.id, publish: question.isPublished ? "false" : "true" }}
                  size="sm"
                  variant="ghost"
                >
                  {question.isPublished ? "Despublicar" : "Publicar"}
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pager page={page} pageCount={pageCount} hrefFor={hrefFor} />
    </div>
  );
}
