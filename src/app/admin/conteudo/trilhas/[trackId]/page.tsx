/**
 * page.tsx — Editar uma trilha: /admin/conteudo/trilhas/[id]  (PROFESSOR ou mais)
 *
 * Quem chama: a lista de trilhas (Editar) e a página "Nova trilha" (depois de criar).
 * Mostra: os dados da trilha; as etapas e os passos (aulas e treinos) com ↑ ↓, editar, tirar e incluir;
 * "montar pelo que mais cai" (trilha ainda vazia); publicar/despublicar, "ver no site" e apagar.
 * Os formulários pequenos ficam dentro de <details> (abre/fecha sem JavaScript) para a página não
 * virar um paredão de campos.
 */
import "server-only";

import { ArrowDown, ArrowUp, BookOpen, ListChecks, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/modules/auth/session";
import {
  deleteItemAction,
  deleteSectionAction,
  deleteTrackAction,
  fillTrackFromIncidenceAction,
  moveItemAction,
  moveSectionAction,
  setTrackPublishedAction,
} from "@/modules/tracks/actions";
import { TrackForm } from "@/modules/tracks/components/track-form";
import { ItemEditForm, LessonItemForm, PracticeItemForm, SectionForm } from "@/modules/tracks/components/track-step-forms";
import { getTrackForAdmin, listTrackFormOptions } from "@/modules/tracks/tracks-admin.server";

export const metadata: Metadata = {
  title: "Trilha · Painel admin",
  robots: { index: false },
};

// Um <details> com o título clicável: formulário escondido até a pessoa abrir.
function Collapsible({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="rounded-md border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">{summary}</summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}

export default async function EditTrackPage({ params }: PageProps<"/admin/conteudo/trilhas/[trackId]">) {
  const { trackId } = await params;
  await requireRole("TEACHER", `/admin/conteudo/trilhas/${trackId}`);
  const [track, options] = await Promise.all([getTrackForAdmin(trackId), listTrackFormOptions()]);
  if (!track) notFound();
  const boardName = options.boards.find((board) => board.id === track.boardId)?.name ?? null;
  const sectionOptions = track.sections.map((section) => ({ id: section.id, title: section.title }));

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/trilhas" className="text-muted-foreground text-sm hover:underline">
          ← Trilhas
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{track.title}</h1>
          <Badge variant={track.isPublished ? "default" : "secondary"}>{track.isPublished ? "Publicada" : "Rascunho"}</Badge>
        </div>
        <p className="text-sm">
          <Link href={`/trilhas/${track.slug}`} className="underline" target="_blank">
            Ver no site{track.isPublished ? "" : " (prévia do rascunho)"}
          </Link>
        </p>
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Etapas e passos</CardTitle>
          <CardDescription>
            O aluno segue na ordem abaixo. Aula: vale a matrícula no curso dela (quem não tem vê o cadeado e a oferta). Treino: feito
            quando a pessoa responde a meta de questões DIFERENTES do assunto (na banca, se escolhida).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {track.sections.length === 0 ? (
            <div className="grid gap-2 rounded-md border border-dashed p-4 text-sm">
              <p>A trilha ainda não tem etapas.</p>
              {track.boardId ? (
                <div>
                  <ActionButton action={fillTrackFromIncidenceAction} fields={{ trackId: track.id }}>
                    Montar pelo que mais cai na {boardName}
                  </ActionButton>
                </div>
              ) : (
                <p className="text-muted-foreground">Escolha a banca (em &quot;Dados da trilha&quot;) para montar as etapas pelo que mais cai, ou crie à mão abaixo.</p>
              )}
            </div>
          ) : null}

          {track.sections.map((section, sectionIndex) => (
            <section key={section.id} className="grid min-w-0 gap-3 rounded-lg border p-3" aria-label={`Etapa ${sectionIndex + 1}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="grid min-w-0 gap-1">
                  <h2 className="font-semibold">
                    Etapa {sectionIndex + 1} — {section.title}
                  </h2>
                  {section.subject ? <p className="text-muted-foreground text-xs">Assunto: {section.subject.name}</p> : null}
                  {section.description ? <p className="text-muted-foreground text-sm">{section.description}</p> : null}
                </div>
                <div className="flex flex-wrap items-start gap-1">
                  <ActionButton action={moveSectionAction} fields={{ id: section.id, direction: "up" }} variant="ghost" size="icon" aria-label="Subir etapa" disabled={sectionIndex === 0}>
                    <ArrowUp />
                  </ActionButton>
                  <ActionButton
                    action={moveSectionAction}
                    fields={{ id: section.id, direction: "down" }}
                    variant="ghost"
                    size="icon"
                    aria-label="Descer etapa"
                    disabled={sectionIndex === track.sections.length - 1}
                  >
                    <ArrowDown />
                  </ActionButton>
                  <ActionButton
                    action={deleteSectionAction}
                    fields={{ sectionId: section.id }}
                    variant="ghost"
                    size="icon"
                    aria-label="Apagar etapa"
                    confirmMessage={`Apagar a etapa "${section.title}" e os ${section.items.length} passo(s) dela?`}
                  >
                    <Trash2 />
                  </ActionButton>
                </div>
              </div>

              {section.items.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum passo nesta etapa.</p> : null}
              <ol className="grid gap-2">
                {section.items.map((item, itemIndex) => (
                  <li key={item.id} className="grid min-w-0 gap-2 rounded-md bg-muted/40 p-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2 text-sm">
                        {item.kind === "LESSON" ? <BookOpen className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ListChecks className="mt-0.5 size-4 shrink-0" aria-hidden />}
                        <div className="grid min-w-0 gap-0.5">
                          {item.kind === "LESSON" && item.lesson ? (
                            <span>
                              <span className="text-muted-foreground">{item.lesson.course.title} — </span>
                              {item.lesson.title}
                              {!item.lesson.isPublished || !item.lesson.course.isPublished ? (
                                <Badge variant="secondary" className="ml-2">
                                  Rascunho (o aluno não vê)
                                </Badge>
                              ) : null}
                            </span>
                          ) : (
                            <span>
                              Treinar {item.subject?.name} · {item.board ? item.board.name : "qualquer banca"} · meta de {item.questionGoal} questões
                            </span>
                          )}
                          {item.note ? <span className="text-muted-foreground text-xs">Dica: {item.note}</span> : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start gap-1">
                        <ActionButton action={moveItemAction} fields={{ id: item.id, direction: "up" }} variant="ghost" size="icon" aria-label="Subir passo" disabled={itemIndex === 0}>
                          <ArrowUp />
                        </ActionButton>
                        <ActionButton
                          action={moveItemAction}
                          fields={{ id: item.id, direction: "down" }}
                          variant="ghost"
                          size="icon"
                          aria-label="Descer passo"
                          disabled={itemIndex === section.items.length - 1}
                        >
                          <ArrowDown />
                        </ActionButton>
                        <ActionButton action={deleteItemAction} fields={{ itemId: item.id }} variant="ghost" size="icon" aria-label="Tirar passo da trilha">
                          <Trash2 />
                        </ActionButton>
                      </div>
                    </div>
                    <Collapsible summary="Editar passo">
                      <ItemEditForm
                        item={{ id: item.id, kind: item.kind, sectionId: section.id, note: item.note, boardId: item.boardId, questionGoal: item.questionGoal }}
                        sections={sectionOptions}
                        boards={options.boards}
                      />
                    </Collapsible>
                  </li>
                ))}
              </ol>

              <div className="grid gap-2">
                <Collapsible summary="+ Incluir aula">
                  <LessonItemForm sectionId={section.id} lessons={options.lessons} />
                </Collapsible>
                <Collapsible summary="+ Incluir treino de questões">
                  <PracticeItemForm
                    sectionId={section.id}
                    subjects={options.subjects}
                    boards={options.boards}
                    defaultSubjectId={section.subject?.id ?? null}
                    defaultBoardId={track.boardId}
                  />
                </Collapsible>
                <Collapsible summary="Editar etapa">
                  <SectionForm
                    trackId={track.id}
                    section={{ id: section.id, title: section.title, description: section.description, subjectId: section.subject?.id ?? null }}
                    subjects={options.subjects}
                  />
                </Collapsible>
              </div>
            </section>
          ))}

          <div className="grid gap-2 rounded-lg border border-dashed p-3">
            <h2 className="text-sm font-semibold">Nova etapa (entra no fim)</h2>
            <SectionForm trackId={track.id} subjects={options.subjects} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da trilha</CardTitle>
        </CardHeader>
        <CardContent>
          <TrackForm
            track={{
              id: track.id,
              title: track.title,
              slug: track.slug,
              summary: track.summary,
              body: track.body,
              boardId: track.boardId ?? "",
              productId: track.productId ?? "",
              planId: track.planId ?? "",
              isPublished: track.isPublished,
            }}
            options={options}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3 border-t pt-4">
        <ActionButton action={setTrackPublishedAction} fields={{ trackId: track.id, isPublished: track.isPublished ? "false" : "true" }} variant="outline">
          {track.isPublished ? "Despublicar" : "Publicar"}
        </ActionButton>
        <ActionButton
          action={deleteTrackAction}
          fields={{ trackId: track.id }}
          variant="destructive"
          confirmMessage="Apagar esta trilha? O endereço dela deixa de existir (as aulas e as questões continuam)."
        >
          Apagar trilha
        </ActionButton>
      </div>
    </div>
  );
}
