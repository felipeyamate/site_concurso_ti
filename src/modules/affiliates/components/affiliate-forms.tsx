"use client";

/**
 * affiliate-forms.tsx — Formulários de afiliado: cadastrar e editar (painel), registrar pagamento
 * (painel) e "como receber" (área do afiliado).
 *
 * Quem chama: /admin/vendas/afiliados, /admin/vendas/afiliados/[id] e /area-do-aluno/afiliado.
 * As regras (e-mail com conta, código único, comissões liberadas...) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createAffiliateAction, registerPayoutAction, updateAffiliateAction, updateOwnPayoutInfoAction } from "../actions";

export function NewAffiliateForm() {
  const { state, onSubmit, pending } = useAdminForm(createAffiliateAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <div className="grid gap-2">
        <Label htmlFor="new-affiliate-email">E-mail da conta da pessoa</Label>
        <Input id="new-affiliate-email" name="email" type="email" required aria-invalid={errors.email ? true : undefined} />
        <FieldError id="new-affiliate-email-error" message={errors.email} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-affiliate-code">Código do link</Label>
        <Input id="new-affiliate-code" name="code" required placeholder="Ex.: joao-silva" aria-invalid={errors.code ? true : undefined} />
        <p className="text-muted-foreground text-xs">O link fica /r/código. Não dá para mudar depois.</p>
        <FieldError id="new-affiliate-code-error" message={errors.code} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-affiliate-commission">Comissão (%)</Label>
        <Input id="new-affiliate-commission" name="commissionBps" inputMode="decimal" defaultValue="20" aria-invalid={errors.commissionBps ? true : undefined} />
        <FieldError id="new-affiliate-commission-error" message={errors.commissionBps} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-affiliate-payout">Como pagar (opcional)</Label>
        <Input id="new-affiliate-payout" name="payoutInfo" placeholder="Ex.: Pix: chave@email.com" />
        <FieldError id="new-affiliate-payout-error" message={errors.payoutInfo} />
      </div>
      <div className="sm:col-span-2">
        <FormStatus state={state} />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando..." : "Cadastrar afiliado"}
        </Button>
      </div>
    </form>
  );
}

export function AffiliateSettingsForm({
  affiliate,
}: {
  affiliate: { id: string; commissionPercent: string; payoutInfo: string; isActive: boolean };
}) {
  const { state, onSubmit, pending } = useAdminForm(updateAffiliateAction);
  const errors = state.fieldErrors;
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="affiliateId" value={affiliate.id} />
      <div className="grid gap-2">
        <Label htmlFor="affiliate-commission">Comissão (%) — vale para as próximas vendas</Label>
        <Input
          id="affiliate-commission"
          name="commissionBps"
          inputMode="decimal"
          defaultValue={affiliate.commissionPercent}
          aria-invalid={errors.commissionBps ? true : undefined}
        />
        <FieldError id="affiliate-commission-error" message={errors.commissionBps} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="affiliate-payout">Como pagar</Label>
        <Input id="affiliate-payout" name="payoutInfo" defaultValue={affiliate.payoutInfo} aria-invalid={errors.payoutInfo ? true : undefined} />
        <FieldError id="affiliate-payout-error" message={errors.payoutInfo} />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isActive" defaultChecked={affiliate.isActive} className="accent-primary size-4" />
        Ativo (desativado: o link e os cupons dele param de atribuir vendas novas)
      </label>
      <div className="sm:col-span-2">
        <FormStatus state={state} />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

export function PayoutForm({ affiliateId, availableLabel, disabled }: { affiliateId: string; availableLabel: string; disabled: boolean }) {
  const { state, onSubmit, pending, formRef } = useAdminForm(registerPayoutAction, { resetOnSuccess: true });
  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        if (!window.confirm(`Registrar que você PAGOU ${availableLabel} a este afiliado (fora do site)?`)) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-3"
    >
      <input type="hidden" name="affiliateId" value={affiliateId} />
      <div className="grid gap-2">
        <Label htmlFor="payout-note">Anotação (ex.: Pix de 10/10, comprovante 123)</Label>
        <Input id="payout-note" name="note" maxLength={300} />
        <FieldError id="payout-note-error" message={state.fieldErrors.note} />
      </div>
      <FormStatus state={state} />
      <div>
        {/* Texto com valor: pode quebrar a linha no celular. */}
        <Button type="submit" disabled={pending || disabled} className="h-auto min-h-9 py-2 text-left whitespace-normal">
          {pending ? "Registrando..." : `Registrar pagamento de ${availableLabel}`}
        </Button>
      </div>
    </form>
  );
}

export function OwnPayoutInfoForm({ payoutInfo }: { payoutInfo: string }) {
  const { state, onSubmit, pending } = useAdminForm(updateOwnPayoutInfoAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="own-payout">Como você quer receber (ex.: Pix: sua-chave)</Label>
        <Input id="own-payout" name="payoutInfo" defaultValue={payoutInfo} maxLength={300} aria-invalid={state.fieldErrors.payoutInfo ? true : undefined} />
        <FieldError id="own-payout-error" message={state.fieldErrors.payoutInfo} />
      </div>
      <FormStatus state={state} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
