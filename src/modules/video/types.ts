/**
 * types.ts — O "formato" de um vídeo pronto para tocar, igual para qualquer fornecedor.
 *
 * Quem usa: os provedores (`dev-provider.ts` e `panda/panda-provider.ts`) produzem um
 * `VideoPlayback`; o componente `VideoPlayer` sabe tocar qualquer um deles.
 *
 * É assim que cumprimos o princípio "trocar de fornecedor muda um arquivo só" (PROJECT.md, seção 4):
 * o resto do app nunca fala com o Panda (ou outro) diretamente, só com estes tipos.
 */

export type VideoPlayback =
  // Arquivo de vídeo tocado pelo próprio navegador (tag <video>). Hoje: o vídeo de exemplo (DEV).
  | { kind: "html5"; src: string }
  // Player do Panda Video dentro de um <iframe>. O progresso chega pelas mensagens do player.
  | { kind: "panda"; src: string; videoId: string };

// Quem está assistindo. Os fornecedores com antipirataria usam esses dados na marca d'água.
export type Viewer = {
  id: string;
  name: string;
  email: string;
};
