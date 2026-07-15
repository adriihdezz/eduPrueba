"use client";

import { useEffect, useRef, useState } from "react";
import ResultTabs from "../components/ResultTabs";
import VideoInput, { type ProcessingPhase } from "../components/VideoInput";
import VideoPlayer from "../components/VideoPlayer";
import { mockAdapt, mockTranscript } from "../lib/mock";
import type { AdaptResult, Segment, TranscriptResult } from "../lib/types";

type RequestSource = "upload" | "youtube" | "demo";

type CompleteResult = {
  transcript: TranscriptResult;
  adapt: AdaptResult;
  requestSource: RequestSource;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSegment = (value: unknown): value is Segment =>
  isRecord(value) &&
  typeof value.start === "number" &&
  Number.isFinite(value.start) &&
  typeof value.end === "number" &&
  Number.isFinite(value.end) &&
  typeof value.text === "string";

const isTranscriptResult = (value: unknown): value is TranscriptResult =>
  isRecord(value) &&
  (value.source === "upload" || value.source === "youtube") &&
  typeof value.text === "string" &&
  Array.isArray(value.segments) &&
  value.segments.every(isSegment) &&
  (value.source !== "youtube" || (typeof value.videoId === "string" && value.videoId.length > 0));

const isAdaptResult = (value: unknown): value is AdaptResult =>
  isRecord(value) &&
  typeof value.lecturaFacil === "string" &&
  Array.isArray(value.puntosClave) &&
  value.puntosClave.every((point) => typeof point === "string");

const readJson = async (response: Response): Promise<unknown> => {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

const errorMessage = (payload: unknown, fallback: string): string =>
  isRecord(payload) && typeof payload.error === "string" && payload.error.trim()
    ? payload.error
    : fallback;

export default function HomePage() {
  const [phase, setPhase] = useState<ProcessingPhase>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const localMediaUrlRef = useRef<string | null>(null);

  const revokeLocalMediaUrl = () => {
    if (localMediaUrlRef.current) URL.revokeObjectURL(localMediaUrlRef.current);
    localMediaUrlRef.current = null;
    setLocalMediaUrl(null);
  };

  useEffect(
    () => () => {
      controllerRef.current?.abort();
      if (localMediaUrlRef.current) URL.revokeObjectURL(localMediaUrlRef.current);
    },
    []
  );

  const invalidateResults = () => {
    setResult(null);
    setError(null);
    setPhase("idle");
  };

  const handleFileChange = (file: File | null) => {
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    revokeLocalMediaUrl();
    setSelectedFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      localMediaUrlRef.current = url;
      setLocalMediaUrl(url);
    }
    invalidateResults();
  };

  const handleValidationError = (message: string) => {
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    setResult(null);
    setError(message);
    setPhase("error");
  };

  const beginRequest = (): { id: number; controller: AbortController } => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const id = requestIdRef.current + 1;
    requestIdRef.current = id;
    setResult(null);
    setError(null);
    setPhase("transcribing");
    return { id, controller };
  };

  const isCurrentRequest = (id: number) => requestIdRef.current === id;

  const adaptTranscript = async (
    transcript: TranscriptResult,
    id: number,
    controller: AbortController,
    requestSource: RequestSource
  ) => {
    if (!isCurrentRequest(id)) return;
    setPhase("adapting");
    const response = await fetch("/api/adapt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript.text }),
      signal: controller.signal
    });
    const payload = await readJson(response);
    if (!response.ok) throw new Error(errorMessage(payload, "No se pudieron generar las adaptaciones."));
    if (!isAdaptResult(payload)) throw new Error("La respuesta de adaptaciones no tiene el formato esperado.");
    if (!isCurrentRequest(id)) return;
    setResult({ transcript, adapt: payload, requestSource });
    setPhase("ready");
  };

  const handleFileSubmit = async () => {
    if (!selectedFile) {
      setError("Selecciona un archivo antes de adaptar.");
      setPhase("error");
      return;
    }
    const { id, controller } = beginRequest();
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(errorMessage(payload, "No se pudo transcribir el archivo."));
      if (!isTranscriptResult(payload) || payload.source !== "upload") {
        throw new Error("La transcripción recibida no tiene el formato esperado.");
      }
      await adaptTranscript(payload, id, controller, "upload");
    } catch (caught) {
      if (!isCurrentRequest(id) || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setResult(null);
      setError(caught instanceof Error ? caught.message : "No se pudo procesar el archivo.");
      setPhase("error");
    } finally {
      if (isCurrentRequest(id)) {
        setPhase((current) => (current === "transcribing" || current === "adapting" ? "idle" : current));
      }
    }
  };

  const handleYoutubeSubmit = async (url: string) => {
    const { id, controller } = beginRequest();
    revokeLocalMediaUrl();
    setSelectedFile(null);
    try {
      const response = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      const payload = await readJson(response);
      if (!response.ok) throw new Error(errorMessage(payload, "No se pudo obtener la transcripción de YouTube."));
      if (!isTranscriptResult(payload) || payload.source !== "youtube" || !payload.videoId) {
        throw new Error("La transcripción de YouTube no tiene el formato esperado.");
      }
      await adaptTranscript(payload, id, controller, "youtube");
    } catch (caught) {
      if (!isCurrentRequest(id) || (caught instanceof DOMException && caught.name === "AbortError")) return;
      setResult(null);
      setError(caught instanceof Error ? caught.message : "No se pudo procesar el enlace de YouTube.");
      setPhase("error");
    } finally {
      if (isCurrentRequest(id)) {
        setPhase((current) => (current === "transcribing" || current === "adapting" ? "idle" : current));
      }
    }
  };

  const handleDemo = () => {
    controllerRef.current?.abort();
    requestIdRef.current += 1;
    revokeLocalMediaUrl();
    setSelectedFile(null);
    setError(null);
    setResult({ transcript: mockTranscript, adapt: mockAdapt, requestSource: "demo" });
    setPhase("ready");
  };

  return (
    <main>
      <header>
        <h1>AdaptaVídeo</h1>
        <p>Convierte una clase en contenido más accesible para todo el alumnado.</p>
      </header>

      <VideoInput
        phase={phase}
        error={error}
        selectedFile={selectedFile}
        onValidationError={handleValidationError}
        onFileChange={handleFileChange}
        onFileSubmit={handleFileSubmit}
        onYoutubeSubmit={handleYoutubeSubmit}
        onDemo={handleDemo}
      />

      {result && (
        <section aria-label="Resultados de la adaptación">
          <VideoPlayer
            transcript={result.transcript}
            localMediaUrl={result.transcript.source === "upload" ? localMediaUrl ?? undefined : undefined}
            localFile={result.transcript.source === "upload" ? selectedFile : undefined}
          />
          <ResultTabs transcript={result.transcript} adapt={result.adapt} />
        </section>
      )}
    </main>
  );
}
