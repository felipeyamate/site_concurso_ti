/**
 * user-agent.ts — Transforma o "user agent" do navegador num texto legível.
 *
 * Quem chama: a lista "Dispositivos conectados" na área do aluno.
 *
 * O "user agent" é um texto que todo navegador envia, algo como
 * "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ... Chrome/130.0 Safari/537.36".
 * Para o aluno, mostramos só "Chrome no Windows". É uma estimativa simples (sem biblioteca):
 * suficiente para a pessoa reconhecer os próprios dispositivos.
 */

// A ORDEM importa: o Edge e o Opera também dizem "Chrome" no texto, e o Chrome diz "Safari".
// Por isso testamos os mais específicos primeiro.
const BROWSERS: Array<[RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/Android/, "Android"],
  [/iPhone|iPad|iPod/, "iOS"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

function findLabel(userAgent: string, patterns: Array<[RegExp, string]>): string | null {
  for (const [pattern, label] of patterns) {
    if (pattern.test(userAgent)) {
      return label;
    }
  }
  return null;
}

export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) {
    return "Dispositivo desconhecido";
  }
  const browser = findLabel(userAgent, BROWSERS);
  const system = findLabel(userAgent, SYSTEMS);

  if (browser && system) return `${browser} no ${system}`;
  if (browser) return browser;
  if (system) return system;
  return "Dispositivo desconhecido";
}
