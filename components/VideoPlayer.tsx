"use client";

import { useEffect, useMemo, useState } from "react";
import { segmentsToVtt } from "../lib/vtt";
import type { TranscriptResult } from "../lib/types";

type VideoPlayerProps = {
  transcript: TranscriptResult;
  localMediaUrl?: string;
  localFile?: File | null;
};

const isSafeYoutubeId = (value: string | undefined): value is string =>
  Boolean(value && /^[A-Za-z0-9_-]{6,}$/.test(value));

export default function VideoPlayer({ transcript, localMediaUrl, localFile }: VideoPlayerProps) {
  const [vttUrl, setVttUrl] = useState<string | null>(null);
  const vttContent = useMemo(() => segmentsToVtt(transcript.segments), [transcript.segments]);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([vttContent], { type: "text/vtt" }));
    const timeout = window.setTimeout(() => setVttUrl(url), 0);
    return () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
    };
  }, [vttContent]);

  const downloadVtt = () => {
    const url = URL.createObjectURL(new Blob([vttContent], { type: "text/vtt" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "subtitulos.vtt";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const isAudio = localFile?.type.startsWith("audio/") || /\.(mp3|m4a|wav)$/i.test(localFile?.name ?? "");

  return (
    <section aria-label="Reproductor y subtítulos">
      <h2>Vídeo y subtítulos</h2>
      {transcript.source === "upload" ? (
        !localMediaUrl || !localFile ? (
          <p role="alert">No se encontró el archivo local para reproducirlo. Vuelve a seleccionarlo.</p>
        ) : isAudio ? (
          <>
            <audio controls preload="metadata" src={localMediaUrl}>
              Tu navegador no puede reproducir este audio.
            </audio>
            <p>La transcripción del audio está disponible en las pestañas de resultados.</p>
          </>
        ) : (
          <video controls preload="metadata" src={localMediaUrl}>
            {vttUrl && <track kind="subtitles" src={vttUrl} srcLang="es" label="Español" default />}
            Tu navegador no puede reproducir este vídeo.
          </video>
        )
      ) : isSafeYoutubeId(transcript.videoId) ? (
        <iframe
          src={`https://www.youtube.com/embed/${encodeURIComponent(transcript.videoId)}`}
          title="Vídeo de YouTube con contenido adaptado"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <p role="alert">No se recibió un identificador de YouTube válido.</p>
      )}
      {transcript.source === "youtube" && <p>Activa los subtítulos nativos en los controles de YouTube si los necesitas.</p>}
      <button type="button" onClick={downloadVtt}>
        Descargar subtítulos .vtt
      </button>
    </section>
  );
}
