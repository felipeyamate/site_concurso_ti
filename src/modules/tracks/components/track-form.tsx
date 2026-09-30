"use client";

/**
 * track-form.tsx — Formulário da trilha no painel (criar e editar): título, endereço, banca, textos,
 * oferta e "publicada". Ao criar, a opção de já montar as etapas pelo "o que mais cai" da banca.
 *
 * Quem chama: /admin/conteudo/trilhas/nova e /admin/conteudo/trilhas/[id].
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

import { saveTrackAction } from "../actions";

export type TrackFormValues = {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  body: string;
  boardId: string;
  productId: string;
  planId: string;
  isPublished: boolean;
};

type Options = {
  boards: Array<{ id: string; name: string }>;
  products: Array<{ id: string; title: string; isActive: boolean }>;
  plans: Array<{ id: string; title: string; isActive: boolean }>;
};

export function TrackForm({ track, options }: { track: TrackFormValues; options: Options }) {
  const { state, onSubmit, pending } = useAdminForm(saveTrackAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {track.id ? <input type="hidden" name="trackId" value={track.id} /> : null}
      <div className="grid gap-2">
        <Label htmlFor="track-title">Título da trilha</Label>
        <Input
          id="track-title"
          name="title"
          defaultValue={track.title}
          placeholder="Ex.: TI para o Banco do Brasil — Cesgranrio"
          required
          aria-invalid={errors.title ? true : undefined}
        />
        <FieldError id="track-title-error" message={errors.title} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="track-board">Banca</Label>
          <NativeSelect id="track-board" name="boardId" defaultValue={track.boardId} aria-invalid={errors.boardId ? true : undefined}>
            <option value="">Nenhuma (trilha geral)</option>
            {options.boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
          <p className="text-muted-foreground text-xs">Ordena pelo &quot;o que mais cai&quot; e é o filtro padrão dos treinos.</p>
          <FieldError id="track-board-error" message={errors.boardId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="track-slug">Endereço (slug)</Label>
          <Input id="track-slug" name="slug" defaultValue={track.slug} placeholder="vazio = gerado do título" aria-invalid={errors.slug ? true : undefined} />
          <FieldError id="track-slug-error" message={errors.slug} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="track-summary">Resumo (lista de trilhas e Google)</Label>
        <Textarea id="track-summary" name="summary" defaultValue={track.summary} rows={2} maxLength={300} aria-invalid={errors.summary ? true : undefined} />
        <FieldError id="track-summary-error" message={errors.summary} />
      </div>
      <MarkdownField id="track-body" name="body" label="Apresentação (para quem é, como usar a trilha)" defaultValue={track.body} error={errors.body} />

      <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">O que oferecer na página (para liberar as aulas)</legend>
        <div className="grid gap-2">
          <Label htmlFor="track-product">Produto (compra avulsa)</Label>
          <NativeSelect id="track-product" name="productId" defaultValue={track.productId}>
            <option value="">Nenhum</option>
            {options.products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
                {product.isActive ? "" : " (inativo)"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="track-product-error" message={errors.productId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="track-plan">Plano (assinatura)</Label>
          <NativeSelect id="track-plan" name="planId" defaultValue={track.planId}>
            <option value="">Nenhum</option>
            {options.plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.title}
                {plan.isActive ? "" : " (inativo)"}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="track-plan-error" message={errors.planId} />
        </div>
      </fieldset>

      {track.id ? null : (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="fromIncidence" defaultChecked className="accent-primary mt-0.5 size-4" />
          <span>
            Já montar as etapas pelo &quot;o que mais cai&quot; da banca: uma etapa por assunto, do que mais cai para o que menos cai,
            com as aulas do assunto e um treino de questões na banca. Depois você revisa.
          </span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={track.isPublished} className="accent-primary size-4" />
        Publicada (aparece em /trilhas e no Google)
      </label>
      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : track.id ? "Salvar trilha" : "Criar trilha"}
        </Button>
      </div>
    </form>
  );
}
