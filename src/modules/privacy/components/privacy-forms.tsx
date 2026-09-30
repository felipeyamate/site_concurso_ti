"use client";

/**
 * privacy-forms.tsx — Formulários de privacidade (LGPD): aceite dos termos, nome da conta e
 * exclusão de conta (pela pessoa e pelo admin).
 *
 * Quem chama: /aceitar-termos, "Minha conta e privacidade" (/area-do-aluno/conta) e a ficha do
 * usuário no painel. "use client": os formulários mostram o resultado sem recarregar a página e
 * a exclusão pede uma confirmação a mais antes de enviar.
 */
import Link from "next/link";

import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { acceptLegalTermsAction, adminDeleteAccountAction, deleteOwnAccountAction, updateOwnNameAction } from "../actions";

/** Tela de aceite: caixa "Li e aceito" + botão; depois volta para a página pedida (`returnTo`). */
export function AcceptTermsForm({ returnTo }: { returnTo: string }) {
  const { state, onSubmit, pending } = useAdminForm(acceptLegalTermsAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="voltar" value={returnTo} />
      <label className="flex items-start gap-2 text-sm leading-relaxed">
        <input type="checkbox" name="accept" className="accent-primary mt-1 size-4 shrink-0" aria-describedby="accept-error" />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className="underline">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className="underline">
            Política de privacidade
          </Link>
          .
        </span>
      </label>
      <FieldError id="accept-error" message={state.fieldErrors.accept} />
      <FormStatus state={state.fieldErrors.accept ? { ...state, message: null } : state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Registrando..." : "Aceitar e continuar"}
        </Button>
      </div>
    </form>
  );
}

/** "Minha conta": corrigir o nome. */
export function NameForm({ name }: { name: string }) {
  const { state, onSubmit, pending } = useAdminForm(updateOwnNameAction);
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="account-name">Nome</Label>
        <Input id="account-name" name="name" defaultValue={name} maxLength={100} aria-invalid={state.fieldErrors.name ? true : undefined} />
        <FieldError id="account-name-error" message={state.fieldErrors.name} />
      </div>
      <FormStatus state={state} />
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Salvando..." : "Salvar nome"}
        </Button>
      </div>
    </form>
  );
}

/**
 * "Excluir minha conta": a pessoa digita a frase de confirmação e ainda confirma numa pergunta do
 * navegador (é definitivo). Os bloqueios (assinatura ativa etc.) são mostrados antes, pela página.
 */
export function DeleteAccountForm({ disabled }: { disabled: boolean }) {
  const { state, onSubmit, pending } = useAdminForm(deleteOwnAccountAction);
  return (
    <form
      onSubmit={(event) => {
        if (!window.confirm("Excluir a sua conta? Isso não pode ser desfeito.")) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-3"
    >
      <div className="grid gap-2">
        <Label htmlFor="delete-confirmation">
          Para confirmar, digite <strong>EXCLUIR MINHA CONTA</strong>
        </Label>
        <Input
          id="delete-confirmation"
          name="confirmation"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={state.fieldErrors.confirmation ? true : undefined}
        />
        <FieldError id="delete-confirmation-error" message={state.fieldErrors.confirmation} />
      </div>
      <FormStatus state={state.fieldErrors.confirmation ? { ...state, message: null } : state} />
      <div>
        <Button type="submit" variant="destructive" disabled={pending || disabled}>
          {pending ? "Excluindo..." : "Excluir minha conta"}
        </Button>
      </div>
    </form>
  );
}

/** Painel (ADMIN): excluir a conta de alguém — digitando o e-mail da conta para confirmar. */
export function AdminDeleteAccountForm({ userId }: { userId: string }) {
  const { state, onSubmit, pending } = useAdminForm(adminDeleteAccountAction);
  return (
    <form
      onSubmit={(event) => {
        if (!window.confirm("Excluir esta conta (LGPD)? Os dados pessoais serão apagados e isso não pode ser desfeito.")) {
          event.preventDefault();
          return;
        }
        onSubmit(event);
      }}
      className="grid gap-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-2">
        <Label htmlFor="admin-delete-email">Digite o e-mail da conta para confirmar</Label>
        <Input id="admin-delete-email" name="typedEmail" type="email" autoComplete="off" aria-invalid={state.fieldErrors.typedEmail ? true : undefined} />
        <FieldError id="admin-delete-email-error" message={state.fieldErrors.typedEmail} />
      </div>
      <FormStatus state={state.fieldErrors.typedEmail ? { ...state, message: null } : state} />
      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Excluindo..." : "Excluir conta"}
        </Button>
      </div>
    </form>
  );
}
