"use client";

/**
 * question-form.tsx — Formulário de questão no painel: nova ou editar.
 *
 * Quem chama: /admin/questoes/nova e /admin/questoes/[id].
 * Campos: código (opcional), tipo, enunciado, alternativas A–E (múltipla escolha), gabarito,
 * comentário, assunto, prova (ou banca, se for inédita) e "publicada".
 * As regras (alternativas em sequência, gabarito entre elas, histórico de aluno) ficam no
 * servidor (`schemas.ts` e `questions-admin.server.ts`) — aqui só facilitamos o preenchimento.
 */
import { useState } from "react";

import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

import { OPTION_LABELS } from "../../answers";
import { saveQuestionAction } from "../actions";

type Named = { id: string; name: string };
type ExamOption = Named & { year: number; boardName: string };

export type QuestionFormValues = {
  id: string;
  code: string | null;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  statement: string;
  options: Array<{ label: string; text: string }>;
  correctAnswer: string;
  explanation: string;
  subjectId: string;
  boardId: string | null;
  examId: string | null;
  isPublished: boolean;
};

type QuestionFormProps = {
  question?: QuestionFormValues;
  subjects: Named[];
  boards: Named[];
  exams: ExamOption[];
  // A questão já foi respondida: tipo, letras e gabarito ficam travados (ver o servidor).
  hasHistory?: boolean;
};

export function QuestionForm({ question, subjects, boards, exams, hasHistory = false }: QuestionFormProps) {
  const { state, onSubmit, pending } = useAdminForm(saveQuestionAction);
  const errors = state.fieldErrors;
  const [type, setType] = useState(question?.type ?? "MULTIPLE_CHOICE");
  const [examId, setExamId] = useState(question?.examId ?? "");
  const optionText = (label: string) => question?.options.find((option) => option.label === label)?.text ?? "";
  const answerChoices = type === "TRUE_FALSE" ? ["C", "E"] : [...OPTION_LABELS];

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {question ? <input type="hidden" name="questionId" value={question.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="q-type">Tipo</Label>
          <NativeSelect
            id="q-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as QuestionFormValues["type"])}
            disabled={hasHistory}
          >
            <option value="MULTIPLE_CHOICE">Múltipla escolha (A–E)</option>
            <option value="TRUE_FALSE">Certo ou errado</option>
          </NativeSelect>
          {/* Campo desativado não é enviado: mandamos o valor escondido. */}
          {hasHistory ? <input type="hidden" name="type" value={type} /> : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="q-code">Código (opcional)</Label>
          <Input id="q-code" name="code" defaultValue={question?.code ?? ""} placeholder="Ex.: BB2023-41" aria-invalid={errors.code ? true : undefined} />
          <FieldError id="q-code-error" message={errors.code} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="q-statement">Enunciado</Label>
        <Textarea
          id="q-statement"
          name="statement"
          defaultValue={question?.statement}
          rows={6}
          required
          aria-invalid={errors.statement ? true : undefined}
        />
        <p className="text-muted-foreground text-xs">Texto puro; as quebras de linha aparecem para o aluno.</p>
        <FieldError id="q-statement-error" message={errors.statement} />
      </div>

      {type === "MULTIPLE_CHOICE" ? (
        <fieldset className="grid gap-3">
          <legend className="text-sm font-medium">Alternativas (preencha em sequência, a partir do A; de 2 a 5)</legend>
          {OPTION_LABELS.map((label) => (
            <div key={label} className="grid grid-cols-[2rem_1fr] items-start gap-2">
              <Label htmlFor={`q-option-${label}`} className="pt-2 font-semibold">
                {label}
              </Label>
              <Textarea id={`q-option-${label}`} name={`option${label}`} defaultValue={optionText(label)} rows={2} />
            </div>
          ))}
          <FieldError id="q-options-error" message={errors.optionA} />
        </fieldset>
      ) : null}

      <div className="grid gap-2 sm:max-w-xs">
        <Label htmlFor="q-answer">Gabarito</Label>
        <NativeSelect
          id="q-answer"
          name="correctAnswer"
          defaultValue={question?.correctAnswer ?? ""}
          key={type}
          disabled={hasHistory}
          aria-invalid={errors.correctAnswer ? true : undefined}
          aria-describedby="q-answer-error"
        >
          <option value="">Escolha...</option>
          {answerChoices.map((value) => (
            <option key={value} value={value}>
              {type === "TRUE_FALSE" ? (value === "C" ? "Certo" : "Errado") : value}
            </option>
          ))}
        </NativeSelect>
        {hasHistory ? <input type="hidden" name="correctAnswer" value={question?.correctAnswer ?? ""} /> : null}
        <FieldError id="q-answer-error" message={errors.correctAnswer} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="q-explanation">Comentário do professor</Label>
        <Textarea
          id="q-explanation"
          name="explanation"
          defaultValue={question?.explanation}
          rows={5}
          required
          aria-invalid={errors.explanation ? true : undefined}
        />
        <p className="text-muted-foreground text-xs">Explique por que a certa é certa — e por que as outras estão erradas.</p>
        <FieldError id="q-explanation-error" message={errors.explanation} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="q-subject">Assunto</Label>
          <NativeSelect id="q-subject" name="subjectId" defaultValue={question?.subjectId ?? ""} required aria-invalid={errors.subjectId ? true : undefined}>
            <option value="">Escolha...</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="q-subject-error" message={errors.subjectId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="q-exam">Prova (vazio = inédita)</Label>
          <NativeSelect id="q-exam" name="examId" value={examId} onChange={(event) => setExamId(event.target.value)}>
            <option value="">Inédita (sem prova)</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name} ({exam.year}) · {exam.boardName}
              </option>
            ))}
          </NativeSelect>
          <FieldError id="q-exam-error" message={errors.examId} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="q-board">Banca</Label>
          <NativeSelect id="q-board" name="boardId" defaultValue={question?.boardId ?? ""} disabled={examId !== ""}>
            <option value="">{examId ? "A da prova" : "Nenhuma"}</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </NativeSelect>
          {examId ? <input type="hidden" name="boardId" value="" /> : null}
          <p className="text-muted-foreground text-xs">Com prova, a banca é a da prova. Inédita: opcional (&quot;no estilo de&quot;).</p>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPublished" defaultChecked={question?.isPublished ?? false} className="accent-primary size-4" />
        Publicada (aparece para os alunos e conta no mapa &quot;o que mais cai&quot;, se for de prova)
      </label>

      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : question ? "Salvar questão" : "Criar questão"}
        </Button>
      </div>
    </form>
  );
}
