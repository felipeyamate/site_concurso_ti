/**
 * page.tsx — Nova trilha: /admin/conteudo/trilhas/nova  (PROFESSOR ou mais)
 *
 * Quem chama: o botão "Nova trilha". Depois de criar, vai para a edição (etapas e passos).
 */
import "server-only";

import type { Metadata } from "next";
import Link from "next/link";

import { requireRole } from "@/modules/auth/session";
import { TrackForm } from "@/modules/tracks/components/track-form";
import { listTrackFormOptions } from "@/modules/tracks/tracks-admin.server";

export const metadata: Metadata = {
  title: "Nova trilha · Painel admin",
  robots: { index: false },
};

export default async function NewTrackPage() {
  await requireRole("TEACHER", "/admin/conteudo/trilhas/nova");
  const options = await listTrackFormOptions();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-6">
      <div className="grid gap-1">
        <Link href="/admin/conteudo/trilhas" className="text-muted-foreground text-sm hover:underline">
          ← Trilhas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nova trilha</h1>
      </div>
      <TrackForm
        track={{ id: null, title: "", slug: "", summary: "", body: "", boardId: "", productId: "", planId: "", isPublished: false }}
        options={options}
      />
    </div>
  );
}
