/**
 * route.ts — Download de um material da aula: /cursos/<curso>/aulas/<aula>/materiais/<id>
 *
 * Quem chama: o link "Material da aula" na página da aula (o aluno clica, abre numa nova aba).
 * O que faz, a CADA clique:
 *  1. exige login (sem login → página de entrar, voltando para cá depois);
 *  2. confere que o material é desta aula e que a pessoa tem ACESSO à aula
 *     (mesma regra do vídeo: `checkLessonAccess`);
 *  3. só então redireciona para um link temporário do arquivo (vale 5 minutos).
 * Sem acesso (ex.: matrícula venceu) → volta para a página da aula, que explica o motivo.
 *
 * O `proxy.ts` já barra quem não tem cookie; a checagem de verdade é a daqui.
 */
import "server-only";

import { NextResponse, type NextRequest } from "next/server";

import { loginPath } from "@/modules/auth/redirect";
import { getCurrentSession } from "@/modules/auth/session";
import { getAttachmentDownloadUrl } from "@/modules/materials/materials.server";
import { getFileStorage } from "@/modules/storage/storage.server";

// Nenhuma resposta desta rota pode ficar guardada em cache (cada uma vale para uma pessoa).
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  request: NextRequest,
  context: RouteContext<"/cursos/[courseSlug]/aulas/[lessonSlug]/materiais/[attachmentId]">,
): Promise<Response> {
  const { courseSlug, lessonSlug, attachmentId } = await context.params;
  const lessonPath = `/cursos/${courseSlug}/aulas/${lessonSlug}`;

  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.redirect(new URL(loginPath(request.nextUrl.pathname), request.url), { headers: NO_STORE });
  }

  const result = await getAttachmentDownloadUrl({
    storage: getFileStorage(),
    attachmentId,
    courseSlug,
    lessonSlug,
    userId: session.user.id,
    role: session.user.role,
  });

  if (result.ok) {
    // `new URL(..., request.url)`: o armazenamento local devolve um caminho relativo; o R2, um endereço completo.
    return NextResponse.redirect(new URL(result.url, request.url), { status: 303, headers: NO_STORE });
  }
  if (result.reason === "NO_ACCESS") {
    return NextResponse.redirect(new URL(lessonPath, request.url), { status: 303, headers: NO_STORE });
  }
  if (result.reason === "STORAGE_UNAVAILABLE") {
    return new Response("O material está indisponível no momento. Tente mais tarde.", { status: 503, headers: NO_STORE });
  }
  return new Response("Material não encontrado.", { status: 404, headers: NO_STORE });
}
