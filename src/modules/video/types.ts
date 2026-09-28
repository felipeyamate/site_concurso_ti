/**
 * types.ts — O "formato" de um vídeo pronto para tocar, igual para qualquer fornecedor.
 *
 * Quem usa: os provedores (`dev-provider.ts`, e na Fase 3 o do Panda) produzem um `VideoPlayback`;
 * o componente `VideoPlayer` sabe tocar qualquer um deles.
 *
 * É assim que cumprimos o princípio "trocar de fornecedor muda um arquivo só" (PROJECT.md, seção 4):
 * o resto do app nunca fala com o Panda (ou outro) diretamente, só com estes tipos.
 */

export type VideoPlayback =
  // Arquivo de vídeo tocado pelo próprio navegador (tag <video>).
  | { kind: "html5"; src: string }
  // Player do fornecedor dentro de um <iframe> (ex.: Panda Video, na Fase 3).
  | { kind: "iframe"; src: string };

// Quem está assistindo. Os fornecedores com antipirataria usam esses dados na marca d'água.
export type Viewer = {
  id: string;
  email: string;
};
