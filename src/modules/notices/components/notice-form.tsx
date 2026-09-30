"use client";

/**
 * notice-form.tsx — Formulário da página de um concurso/edital no painel (criar e editar).
 *
 * Quem chama: /admin/conteudo/concursos/nova e /admin/conteudo/concursos/[id].
 * As regras (slug único, itens escolhidos existem, endereço antigo redirecionando) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { MarkdownField } from "@/components/admin/markdown-field";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { saveNoticeAction } from "../actions";
import { NOTICE_STATUS_LABELS } from "../labels";
import { NOTICE_STATUSES } from "../schemas";

export type NoticeFormValues = {
  id: string | null;
  title: string;
  slug: string;
  organization: string;
  role: string;
  boardId: string;
  status: (typeof NOTICE_STATUSES)[number];
  registrationEndsOn: string;
  examDate: string;
  vacancies: string;
  salary: string;
  summary: string;
  body: string;
  officialUrl: string;
  productId: string;
  planId: string;
  couponCode: string;
  subjectIds: string[];
  trackId: string;
  isPublished: boolean;
};

type Options = {
  boards: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; name: string }>;
  products: Array<{ id: string; title: string; isActive: boolean }>;
  plans: Array<{ id: string; title: string; isActive: boolean }>;
  tracks: Array<{ id: string; title: string; isPublished: boolean }>;
};

export function NoticeForm({ notice, options, canChooseCoupon }: { notice: NoticeFormValues; options: Options; canChooseCoupon: boolean }) {
  const { state, onSubmit, pending } = useAdminForm(saveNoticeAction);
  const errors = state.fieldErrors;
  const text = (
    name: keyof NoticeFormValues,
    label: string,
    props: { placeholder?: string; type?: string; required?: boolean; readOnly?: boolean; hint?: string } = {},
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={`notice-${name}`}>{label}</Label>
      <Input
        id={`notice-${name}`}
        name={name}
        defaultValue={String(notice[name] ?? "")}
        placeholder={props.placeholder}
        type={props.type}
        required={props.required}
        readOnly={props.readOnly}
        aria-invalid={errors[name] ? true : undefined}
      />
      {props.hint ? <p className="text-muted-foreground text-xs">{props.hint}</p> : null}
      <FieldError id={`notice-${name}-error`} message={errors[name]} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {notice.id ? <input type="hidden" name="noticeId" value={notice.id} /> : null}
      {text("title", "Título da página", { placeholder: "Ex.: Banco do Brasil 2026 — Escriturário", required: true })}
      <div className="grid gap-4 sm:grid-cols-2">
        {text("organization", "Órgão", { placeholder: "Ex.: Banco do Brasil", required: true })}
        {text("role", "Cargo", { placeholder: "Ex.: Escriturário — Agente Comercial" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="notice-board">Banca</Label>
          <NativeSelect id="notice-board" name="boardId" defaultValue={notice.boardId}>
            <option value="">A definir</option>
            {options.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="notice-board-error" message={errors.boardId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notice-status">Situação</Label>
          <NativeSelect id="notice-status" name="status" defaultValue={notice.status}>
            {NOTICE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {NOTICE_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {text("slug", "Endereço (slug)", { placeholder: "vazio = gerado do título" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        {text("registrationEndsOn", "Inscrições até", { type: "date" })}
        {text("examDate", "Data da prova", { type: "date" })}
        {text("vacancies", "Vagas", { placeholder: "Ex.: 6.000 + CR" })}
        {text("salary", "Salário", { placeholder: "Ex.: R$ 3.622,23" })}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notice-summary">Resumo (lista de concursos e Google)</Label>
        <Textarea id="notice-summary" name="summary" defaultValue={notice.summary} rows={2} maxLength={300} aria-invalid={errors.summary ? true : undefined} />
        <FieldError id="notice-summary-error" message={errors.summary} />
      </div>
      <MarkdownField id="notice-body" name="body" label="Texto da página (sobre o edital, o que cai de TI, dicas)" defaultValue={notice.body} error={errors.body} />
      {text("officialUrl", "Link do edital oficial (https://...)")}

      <fieldset className="grid gap-2 rounded-md border p-3">
        <legend className="px-1 text-sm font-medium">Assuntos de TI cobrados (atalhos para treinar questões)</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {options.subjects.map((subject) => (
            <label key={subject.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="subjectIds" value={subject.id} defaultChecked={notice.subjectIds.includes(subject.id)} className="accent-primary size-4" />
              {subject.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
        <legend className="px-1 text-sm font-medium">O que oferecer na página</legend>
        <div className="grid gap-2">
          <Label htmlFor="notice-product">Produto (compra avulsa)</Label>
          <NativeSelect id="notice-product" name="productId" defaultValue={notice.productId}>
            <option value="">Nenhum</option>
            {options.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
                {product.isActive ? "" : " (inativo)"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="notice-product-error" message={errors.productId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="notice-plan">Plano (assinatura)</Label>
          <NativeSelect id="notice-plan" name="planId" defaultValue={notice.planId}>
            <option value="">Nenhum</option>
            {options.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title}
                {plan.isActive ? "" : " (inativo)"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="notice-plan-error" message={errors.planId} />
        </div>
        {/* Cupom: só o ADMIN escolhe (o servidor também confere e mantém o cupom atual para o professor). */}
        {canChooseCoupon
          ? text("couponCode", "Cupom já aplicado nos botões (opcional)", { placeholder: "Ex.: BB10" })
          : text("couponCode", "Cupom já aplicado nos botões", { readOnly: true, hint: "Só o administrador escolhe o cupom." })}
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="notice-track">Trilha de estudos indicada (botão &quot;Seguir a trilha&quot;)</Label>
        <NativeSelect id="notice-track" name="trackId" defaultValue={notice.trackId}>
          <option value="">Nenhuma</option>
          {options.tracks.map((track) => (
            <option key={track.id} value={track.id}>
              {track.title}
              {track.isPublished ? "" : " (rascunho — não aparece até publicar)"}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="notice-track-error" message={errors.trackId} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={notice.isPublished} className="accent-primary size-4" />
        Publicada (aparece em /concursos e no Google)
      </label>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : notice.id ? "Salvar página" : "Criar página"}
        </Button>
      </div>
    </form>
  );
}
