"use client";

/**
 * lesson-video-form.tsx — Formulário "Vídeo da aula" no painel.
 *
 * Quem chama: /admin/cursos/[id]/aulas/[aulaId].
 * O que faz:
 *  - escolher de onde vem o vídeo: Panda Video, sem vídeo, ou o vídeo de exemplo (só desenvolvimento);
 *  - colar o link do player do Panda (ou o código <iframe> que o Panda mostra em "Incorporar");
 *  - OU escolher o vídeo direto da biblioteca do Panda (se a PANDA_API_KEY estiver configurada),
 *    que preenche o link e a duração sozinho;
 *  - informar a duração (aparece no catálogo e ajuda a calcular o progresso).
 *
 * Os campos são "controlados" (o valor fica num `useState`), porque a biblioteca do Panda
 * preenche o link e a duração pelo código.
 */
import { useState, useTransition } from "react";

import { FieldError, FormStatus } from "@/components/admin/form-status";
import { useAdminForm } from "@/components/admin/use-admin-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration } from "@/lib/format";
import type { PandaLibraryVideo } from "@/modules/video/panda/panda-api";

import { listPandaVideosAction, updateLessonVideoAction } from "../actions";
import type { VideoSource } from "../schemas";

type LessonVideoFormProps = {
  lessonId: string;
  initialSource: VideoSource;
  initialPandaEmbed: string;
  initialDurationSeconds: number;
  pandaLibraryEnabled: boolean;
  devVideoAllowed: boolean;
};

export function LessonVideoForm(props: LessonVideoFormProps) {
  const { state, onSubmit, pending } = useAdminForm(updateLessonVideoAction);
  const [source, setSource] = useState<VideoSource>(props.initialSource);
  const [pandaEmbed, setPandaEmbed] = useState(props.initialPandaEmbed);
  const [minutes, setMinutes] = useState(String(Math.floor(props.initialDurationSeconds / 60)));
  const [seconds, setSeconds] = useState(String(props.initialDurationSeconds % 60));
  const errors = state.fieldErrors;

  function pickFromLibrary(video: PandaLibraryVideo) {
    if (!video.embedUrl) return;
    setSource("PANDA");
    setPandaEmbed(video.embedUrl);
    if (video.durationSeconds) {
      setMinutes(String(Math.floor(video.durationSeconds / 60)));
      setSeconds(String(video.durationSeconds % 60));
    }
  }

  const sourceOptions: { value: VideoSource; label: string }[] = [
    { value: "PANDA", label: "Panda Video" },
    { value: "NONE", label: "Sem vídeo (aula só com texto/PDF)" },
  ];
  // O vídeo de exemplo só aparece fora de produção (ou se a aula já usa, para mostrar a situação).
  if (props.devVideoAllowed || props.initialSource === "DEV") {
    sourceOptions.push({ value: "DEV", label: "Vídeo de exemplo (só desenvolvimento)" });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="lessonId" value={props.lessonId} />

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">De onde vem o vídeo</legend>
        {sourceOptions.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="source"
              value={option.value}
              checked={source === option.value}
              onChange={() => setSource(option.value)}
              className="accent-primary size-4"
            />
            {option.label}
          </label>
        ))}
        <FieldError id="video-source-error" message={errors.source} />
      </fieldset>

      {source === "PANDA" ? (
        <div className="grid gap-2">
          <Label htmlFor="video-panda-embed">Link do player do Panda (ou o código de incorporação)</Label>
          <Textarea
            id="video-panda-embed"
            name="pandaEmbed"
            value={pandaEmbed}
            onChange={(event) => setPandaEmbed(event.target.value)}
            rows={3}
            placeholder="https://player-vz-....tv.pandavideo.com.br/embed/?v=..."
            aria-invalid={errors.pandaEmbed ? true : undefined}
          />
          <p className="text-muted-foreground text-xs">
            No painel do Panda: abra o vídeo → &quot;Incorporar&quot; (embed) → copie o link ou o código inteiro.
          </p>
          <FieldError id="video-panda-embed-error" message={errors.pandaEmbed} />
          {props.pandaLibraryEnabled ? <PandaLibraryPicker onPick={pickFromLibrary} /> : null}
        </div>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Duração do vídeo</legend>
        <div className="flex items-center gap-2">
          <Input
            aria-label="Minutos"
            name="durationMinutes"
            inputMode="numeric"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="w-20"
            aria-invalid={errors.durationMinutes ? true : undefined}
          />
          <span className="text-sm">min</span>
          <Input
            aria-label="Segundos"
            name="durationSecondsPart"
            inputMode="numeric"
            value={seconds}
            onChange={(event) => setSeconds(event.target.value)}
            className="w-20"
            aria-invalid={errors.durationSecondsPart ? true : undefined}
          />
          <span className="text-sm">s</span>
        </div>
        <FieldError id="video-duration-error" message={errors.durationMinutes ?? errors.durationSecondsPart} />
      </fieldset>

      <FormStatus state={state} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar vídeo"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Busca na biblioteca do Panda (pela API) e deixa escolher um vídeo.
 * Só aparece quando a PANDA_API_KEY está configurada.
 */
function PandaLibraryPicker({ onPick }: { onPick: (video: PandaLibraryVideo) => void }) {
  const [search, setSearch] = useState("");
  const [videos, setVideos] = useState<PandaLibraryVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    setError(null);
    startTransition(async () => {
      const result = await listPandaVideosAction(search);
      if (result.ok) setVideos(result.videos);
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">Ou escolha da sua biblioteca do Panda</p>
      <div className="flex flex-wrap gap-2">
        <Input
          aria-label="Buscar vídeo pelo título"
          placeholder="Buscar pelo título (opcional)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            // Enter aqui busca, em vez de enviar o formulário do vídeo.
            if (event.key === "Enter") {
              event.preventDefault();
              load();
            }
          }}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant="outline" onClick={load} disabled={isPending}>
          {isPending ? "Buscando..." : "Buscar no Panda"}
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {videos && videos.length === 0 ? <p className="text-muted-foreground text-sm">Nenhum vídeo encontrado.</p> : null}
      {videos && videos.length > 0 ? (
        <ul className="grid max-h-72 gap-1 overflow-y-auto">
          {videos.map((video) => (
            <li key={video.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
              <span className="min-w-0 truncate">
                {video.title}
                <span className="text-muted-foreground">
                  {video.durationSeconds ? ` · ${formatDuration(video.durationSeconds)}` : ""}
                  {!video.embedUrl ? " · ainda processando" : ""}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant={pickedId === video.id ? "secondary" : "outline"}
                disabled={!video.embedUrl}
                onClick={() => {
                  setPickedId(video.id);
                  onPick(video);
                }}
              >
                {pickedId === video.id ? "Escolhido" : "Usar este"}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {pickedId ? <p className="text-muted-foreground text-xs">Link e duração preenchidos. Clique em &quot;Salvar vídeo&quot;.</p> : null}
    </div>
  );
}
