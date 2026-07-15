"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";

export type ProcessingPhase = "idle" | "transcribing" | "adapting" | "ready" | "error";

type VideoInputProps = {
  phase: ProcessingPhase;
  error: string | null;
  selectedFile: File | null;
  onValidationError: (message: string) => void;
  onFileChange: (file: File | null) => void;
  onFileSubmit: () => void;
  onYoutubeSubmit: (url: string) => void;
  onDemo: () => void;
};

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const acceptedExtensions = ["mp4", "mp3", "m4a", "wav"];
const sampleVideos = [
  {
    title: "La fotosíntesis",
    description: "Cómo se alimentan las plantas",
    url: "https://youtu.be/ru6rZNQg3eM"
  },
  {
    title: "El ciclo del agua",
    description: "El viaje del agua en la naturaleza",
    url: "https://youtu.be/QDCohXW6blg"
  },
  {
    title: "Estados de la materia",
    description: "Sólido, líquido y gaseoso",
    url: "https://youtu.be/huVPSc9X61E"
  }
];

const formatFileSize = (bytes: number): string =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024) + " MB";

export default function VideoInput({
  phase,
  error,
  selectedFile,
  onValidationError,
  onFileChange,
  onFileSubmit,
  onYoutubeSubmit,
  onDemo
}: VideoInputProps) {
  const [url, setUrl] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = phase === "transcribing" || phase === "adapting";

  const handleUrlSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      const message = "Pega un enlace de YouTube antes de adaptar.";
      setInputError(message);
      onValidationError(message);
      return;
    }
    setInputError(null);
    onYoutubeSubmit(trimmedUrl);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !acceptedExtensions.includes(extension)) {
      const message = "Formato no compatible. Elige mp4, mp3, m4a o wav.";
      setInputError(message);
      event.target.value = "";
      onFileChange(null);
      onValidationError(message);
      return;
    }
    if (file.size === 0) {
      const message = "El archivo está vacío. Elige otro archivo.";
      setInputError(message);
      event.target.value = "";
      onFileChange(null);
      onValidationError(message);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      const message = "El archivo supera el límite de 25 MB.";
      setInputError(message);
      event.target.value = "";
      onFileChange(null);
      onValidationError(message);
      return;
    }

    setInputError(null);
    onFileChange(file);
  };

  const clearFile = () => {
    onFileChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const status =
    phase === "transcribing"
      ? "Transcribiendo…"
      : phase === "adapting"
        ? "Generando adaptaciones…"
        : "";
  const displayedError = phase === "error" ? inputError ?? error : error;

  return (
    <section aria-labelledby="video-input-title">
      <h2 id="video-input-title">Adapta un vídeo de clase</h2>
      <p>Usa un enlace de YouTube o sube un archivo de hasta 25 MB.</p>

      <form onSubmit={handleUrlSubmit}>
        <label htmlFor="youtube-url">Pega un link de YouTube</label>
        <input
          id="youtube-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          disabled={isProcessing}
          aria-describedby={displayedError ? "input-error" : undefined}
        />
        <button type="submit" disabled={isProcessing}>
          Adaptar enlace
        </button>
      </form>

      <p aria-hidden="true">— o —</p>

      <div>
        <label htmlFor="media-file">Sube un mp4, mp3, m4a o wav</label>
        <input
          ref={fileInputRef}
          id="media-file"
          type="file"
          accept=".mp4,.mp3,.m4a,.wav,video/mp4,audio/mpeg,audio/mp4,audio/wav"
          onChange={handleFileChange}
          disabled={isProcessing}
          aria-describedby={selectedFile ? "selected-file" : undefined}
        />
        {selectedFile && (
          <p id="selected-file">
            Archivo seleccionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </p>
        )}
        <button type="button" onClick={onFileSubmit} disabled={isProcessing || !selectedFile}>
          Adaptar archivo
        </button>
        {selectedFile && (
          <button type="button" onClick={clearFile} disabled={isProcessing}>
            Quitar archivo
          </button>
        )}
      </div>

      <button type="button" onClick={onDemo} disabled={isProcessing}>
        Usar demo
      </button>

      <section className="sample-videos" aria-labelledby="sample-videos-title">
        <h3 id="sample-videos-title">Vídeos de prueba</h3>
        <p>Ejemplos educativos con subtítulos en español comprobados.</p>
        <div className="sample-video-list">
          {sampleVideos.map((video) => (
            <button
              key={video.url}
              type="button"
              className="sample-video-button"
              onClick={() => onYoutubeSubmit(video.url)}
              disabled={isProcessing}
            >
              <span>{video.title}</span>
              <small>{video.description}</small>
            </button>
          ))}
        </div>
      </section>

      <p role="status" aria-live="polite" aria-atomic="true">
        {status}
      </p>
      {displayedError && (
        <p id="input-error" role="alert">
          {displayedError}
        </p>
      )}
    </section>
  );
}
