/**
 * rules.test.ts — Testes das regras de progresso (conclusão, percentual, "continuar").
 * Rodar: npm test
 */
import { describe, expect, it } from "vitest";

import {
  calculateCourseProgress,
  getResumePosition,
  pickResumeLessonId,
  shouldMarkCompleted,
  type ProgressEntry,
} from "./rules";

describe("shouldMarkCompleted", () => {
  it("conclui ao terminar o vídeo ou ao passar de 90%", () => {
    expect(shouldMarkCompleted({ positionSeconds: 10, durationSeconds: 600, ended: true })).toBe(true);
    expect(shouldMarkCompleted({ positionSeconds: 540, durationSeconds: 600, ended: false })).toBe(true);
    expect(shouldMarkCompleted({ positionSeconds: 539, durationSeconds: 600, ended: false })).toBe(false);
  });

  it("sem duração conhecida, só conclui quando o vídeo termina", () => {
    expect(shouldMarkCompleted({ positionSeconds: 9999, durationSeconds: null, ended: false })).toBe(false);
    expect(shouldMarkCompleted({ positionSeconds: 9999, durationSeconds: 0, ended: false })).toBe(false);
  });
});

describe("getResumePosition", () => {
  it("retoma de onde parou", () => {
    expect(getResumePosition({ positionSeconds: 125.7, durationSeconds: 600, completed: false })).toBe(125);
  });
  it("começa do zero se já concluiu, se mal começou ou se estava no fim", () => {
    expect(getResumePosition({ positionSeconds: 300, durationSeconds: 600, completed: true })).toBe(0);
    expect(getResumePosition({ positionSeconds: 3, durationSeconds: 600, completed: false })).toBe(0);
    expect(getResumePosition({ positionSeconds: 595, durationSeconds: 600, completed: false })).toBe(0);
  });
});

describe("calculateCourseProgress", () => {
  it("conta só as aulas do curso e arredonda o percentual para baixo", () => {
    const result = calculateCourseProgress(["a", "b", "c"], new Set(["a", "x"]));
    expect(result).toEqual({ completed: 1, total: 3, percent: 33 });
  });
  it("curso sem aulas fica em 0%", () => {
    expect(calculateCourseProgress([], new Set()).percent).toBe(0);
  });
});

describe("pickResumeLessonId", () => {
  const lessons = ["l1", "l2", "l3", "l4"];
  const at = (minutes: number) => new Date(Date.UTC(2026, 8, 28, 12, minutes));
  const entry = (lessonId: string, completed: boolean, minutes: number): ProgressEntry => ({
    lessonId,
    completed,
    lastWatchedAt: at(minutes),
  });

  it("sem progresso: primeira aula", () => {
    expect(pickResumeLessonId(lessons, [])).toBe("l1");
  });

  it("volta para a última aula assistida se ela não foi concluída", () => {
    expect(pickResumeLessonId(lessons, [entry("l1", true, 1), entry("l3", false, 5)])).toBe("l3");
  });

  it("se a última assistida foi concluída, vai para a próxima pendente", () => {
    expect(pickResumeLessonId(lessons, [entry("l1", true, 1), entry("l2", true, 2), entry("l3", true, 3)])).toBe(
      "l4",
    );
  });

  it("se não há pendente depois, volta para a primeira pendente do curso", () => {
    expect(pickResumeLessonId(lessons, [entry("l3", true, 1), entry("l4", true, 9)])).toBe("l1");
  });

  it("curso todo concluído: a última assistida; curso vazio: nenhuma", () => {
    const all = lessons.map((id, index) => entry(id, true, index));
    expect(pickResumeLessonId(lessons, all)).toBe("l4");
    expect(pickResumeLessonId([], [])).toBeNull();
  });

  it("ignora progresso de aulas que não existem mais no curso", () => {
    expect(pickResumeLessonId(lessons, [entry("aula-removida", false, 9)])).toBe("l1");
  });
});
