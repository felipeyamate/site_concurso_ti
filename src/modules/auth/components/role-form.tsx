"use client";

/**
 * role-form.tsx — Formulário "Perfil" de um usuário no painel (só ADMIN).
 *
 * Quem chama: /admin/usuarios/[id].
 * As travas (não mudar o próprio perfil, não ficar sem administrador) ficam no servidor.
 */
import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { changeUserRoleAction } from "../admin-actions";
import { ROLES, ROLE_LABELS, type Role } from "../roles";

const ROLE_HELP: Record<Role, string> = {
  STUDENT: "vê os cursos em que está matriculado e as aulas grátis.",
  TEACHER: "também gerencia cursos, aulas, vídeos e PDFs (e vê todas as aulas, inclusive rascunhos).",
  ADMIN: "também gerencia usuários, perfis e matrículas.",
};

export function RoleForm({ userId, role, isSelf }: { userId: string; role: Role; isSelf: boolean }) {
  const { state, onSubmit, pending } = useAdminForm(changeUserRoleAction);

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-2">
        <Label htmlFor="user-role">Perfil</Label>
        <NativeSelect id="user-role" name="role" defaultValue={role} disabled={isSelf} className="sm:max-w-xs">
          {ROLES.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
        <FieldError id="user-role-error" message={state.fieldErrors.role} />
      </div>
      <ul className="text-muted-foreground grid gap-1 text-xs">
        {ROLES.map((item) => (
          <li key={item}>
            <strong>{ROLE_LABELS[item]}</strong>: {ROLE_HELP[item]}
          </li>
        ))}
      </ul>
      {isSelf ? (
        <p className="text-muted-foreground text-sm">Este é você: o seu perfil só pode ser mudado por outro administrador.</p>
      ) : (
        <>
          {!state.fieldErrors.role ? <FormStatus state={state} /> : null}
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
