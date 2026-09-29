/**
 * files.ts — Regras sobre nomes e caminhos de arquivos no armazenamento (sem acesso a nada externo).
 *
 * Quem chama: o módulo de materiais (ao preparar/confirmar um envio) e os dois armazenamentos
 * (R2 e local), que montam o cabeçalho de download.
 *
 * Arquivo "puro": fácil de testar (`files.test.ts`).
 */

export const PDF_CONTENT_TYPE = "application/pdf";

// Todo material é guardado como: lessons/<id da aula>/<uuid aleatório>.pdf
// - o uuid torna o caminho impossível de adivinhar e evita sobrescrever outro arquivo;
// - o formato fixo impede truques como "../../" (que poderiam escapar da pasta, no armazenamento local).
const ATTACHMENT_KEY_PATTERN = /^lessons\/[A-Za-z0-9_-]{1,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

/** Monta o caminho de um novo material da aula. `uuid` vem de `crypto.randomUUID()`. */
export function buildAttachmentKey(lessonId: string, uuid: string): string {
  const key = `lessons/${lessonId}/${uuid}.pdf`;
  if (!isValidAttachmentKey(key)) {
    throw new Error(`Caminho de arquivo inválido: ${key}`);
  }
  return key;
}

/** O caminho segue exatamente o formato acima? */
export function isValidAttachmentKey(key: string): boolean {
  return ATTACHMENT_KEY_PATTERN.test(key);
}

/** O caminho pertence a esta aula? (impede confirmar o arquivo de uma aula em outra) */
export function isAttachmentKeyOfLesson(key: string, lessonId: string): boolean {
  return isValidAttachmentKey(key) && key.startsWith(`lessons/${lessonId}/`);
}

/**
 * Limpa o nome original do arquivo para mostrar e usar no download.
 * Tira pastas ("C:\\Users\\...\\resumo.pdf" → "resumo.pdf"), caracteres de controle e aspas,
 * e limita o tamanho.
 */
export function sanitizeFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() ?? "";
  // Remove caracteres invisíveis de controle (códigos 0–31 e 127), aspas e ponto e vírgula
  // (que atrapalhariam o cabeçalho de download).
  const cleaned = Array.from(baseName)
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127 && !`"';`.includes(char);
    })
    .join("")
    .trim();
  const limited = cleaned.slice(0, 120);
  return limited || "material.pdf";
}

/** "Resumo_aula-1.pdf" → "Resumo aula-1" (título sugerido quando o professor não digita um). */
export function titleFromFileName(fileName: string): string {
  const withoutExtension = sanitizeFileName(fileName).replace(/\.pdf$/i, "");
  const spaced = withoutExtension.replace(/_+/g, " ").replace(/\s+/g, " ").trim();
  return spaced || "Material da aula";
}

/**
 * Cabeçalho `Content-Disposition` do download: `inline` (o navegador abre o PDF numa aba) com o
 * nome do arquivo. Nomes com acento vão no formato `filename*=UTF-8''...` (padrão RFC 6266);
 * o `filename="..."` sem acentos fica para navegadores antigos.
 */
export function buildContentDisposition(fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const asciiFallback = safeName.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/[\\]/g, "") || "material.pdf";
  return `inline; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(safeName)}`;
}
