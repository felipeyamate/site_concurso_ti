"use client";

/**
 * classification-forms.tsx — Formulários de bancas, assuntos e provas no painel (criar e editar).
 *
 * Quem chama: /admin/questoes/classificacao.
 * Cada formulário serve para os dois casos: sem ID = cria; com ID = edita aquela linha.
 * O identificador (slug) vazio é gerado a partir do nome.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { saveBoardAction, saveExamAction, saveSubjectAction } from "../actions";

type BoardValues = { id: string; name: string; slug: string };

export function BoardForm({ board }: { board?: BoardValues }) {
  const { state, onSubmit, pending } = useAdminForm(saveBoardAction, { resetOnSuccess: !board });
  const prefix = board ? `board-${board.id}` : "board-new";
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      {board ? <input type="hidden" name="boardId" value={board.id} /> : null}
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-name`}>{board ? "Nome" : "Nova banca"}</Label>
        <Input id={`${prefix}-name`} name="name" defaultValue={board?.name} placeholder="Ex.: Cesgranrio" required />
        <FieldError id={`${prefix}-name-error`} message={state.fieldErrors.name} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-slug`}>Identificador</Label>
        <Input id={`${prefix}-slug`} name="slug" defaultValue={board?.slug} placeholder="gerado a partir do nome" />
        <FieldError id={`${prefix}-slug-error`} message={state.fieldErrors.slug} />
      </div>
      <Button type="submit" variant={board ? "outline" : "default"} disabled={pending}>
        {pending ? "Salvando..." : board ? "Salvar" : "Criar banca"}
      </Button>
      <div className="sm:col-span-3">
        <FormStatus state={state} />
      </div>
    </form>
  );
}

type SubjectValues = { id: string; name: string; slug: string; position: number };

export function SubjectForm({ subject }: { subject?: SubjectValues }) {
  const { state, onSubmit, pending } = useAdminForm(saveSubjectAction, { resetOnSuccess: !subject });
  const prefix = subject ? `subject-${subject.id}` : "subject-new";
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto] sm:items-end">
      {subject ? <input type="hidden" name="subjectId" value={subject.id} /> : null}
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-name`}>{subject ? "Nome" : "Novo assunto"}</Label>
        <Input id={`${prefix}-name`} name="name" defaultValue={subject?.name} placeholder="Ex.: Segurança da Informação" required />
        <FieldError id={`${prefix}-name-error`} message={state.fieldErrors.name} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-slug`}>Identificador</Label>
        <Input id={`${prefix}-slug`} name="slug" defaultValue={subject?.slug} placeholder="gerado a partir do nome" />
        <FieldError id={`${prefix}-slug-error`} message={state.fieldErrors.slug} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-position`}>Ordem</Label>
        <Input id={`${prefix}-position`} name="position" type="number" min={0} defaultValue={subject?.position ?? 0} />
      </div>
      <Button type="submit" variant={subject ? "outline" : "default"} disabled={pending}>
        {pending ? "Salvando..." : subject ? "Salvar" : "Criar assunto"}
      </Button>
      <div className="sm:col-span-4">
        <FormStatus state={state} />
      </div>
    </form>
  );
}

type ExamValues = { id: string; name: string; slug: string; year: number; boardId: string };

export function ExamForm({ exam, boards }: { exam?: ExamValues; boards: Array<{ id: string; name: string }> }) {
  const { state, onSubmit, pending } = useAdminForm(saveExamAction, { resetOnSuccess: !exam });
  const prefix = exam ? `exam-${exam.id}` : "exam-new";
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-[2fr_6rem_1fr_1fr_auto] sm:items-end">
      {exam ? <input type="hidden" name="examId" value={exam.id} /> : null}
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-name`}>{exam ? "Nome" : "Nova prova"}</Label>
        <Input id={`${prefix}-name`} name="name" defaultValue={exam?.name} placeholder="Ex.: Banco do Brasil — Escriturário" required />
        <FieldError id={`${prefix}-name-error`} message={state.fieldErrors.name} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-year`}>Ano</Label>
        <Input id={`${prefix}-year`} name="year" type="number" min={1990} max={2100} defaultValue={exam?.year} required />
        <FieldError id={`${prefix}-year-error`} message={state.fieldErrors.year} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-board`}>Banca</Label>
        <NativeSelect id={`${prefix}-board`} name="boardId" defaultValue={exam?.boardId ?? ""} required>
          <option value="">Escolha...</option>
          {boards.map((board) => (
            <option key={board.id} value={board.id}>
              {board.name}
            </option>
          ))}
        </NativeSelect>
        <FieldError id={`${prefix}-board-error`} message={state.fieldErrors.boardId} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={`${prefix}-slug`}>Identificador</Label>
        <Input id={`${prefix}-slug`} name="slug" defaultValue={exam?.slug} placeholder="gerado (nome + ano)" />
        <FieldError id={`${prefix}-slug-error`} message={state.fieldErrors.slug} />
      </div>
      <Button type="submit" variant={exam ? "outline" : "default"} disabled={pending}>
        {pending ? "Salvando..." : exam ? "Salvar" : "Criar prova"}
      </Button>
      <div className="sm:col-span-5">
        <FormStatus state={state} />
      </div>
    </form>
  );
}
