/**
 * progress.tsx — Barra de progresso (ex.: "40% do curso concluído").
 *
 * Quem chama: página do curso, página da aula e área do aluno.
 * Acessível: leitores de tela anunciam o percentual (role="progressbar" + aria-*).
 */
import { cn } from "@/lib/utils";

type ProgressProps = {
  value: number; // 0 a 100
  label: string; // descrição para leitores de tela, ex.: "Progresso do curso"
  className?: string;
};

function Progress({ value, label, className }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("bg-secondary h-2 w-full overflow-hidden rounded-full", className)}
    >
      <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export { Progress };
