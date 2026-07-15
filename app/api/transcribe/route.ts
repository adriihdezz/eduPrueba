import OpenAI, { toFile } from "openai";
import { NextResponse } from "next/server";

import type { Segment, TranscriptResult } from "../../../lib/types";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["mp4", "mp3", "m4a", "wav"]);
const ALLOWED_MIME_TYPES = new Set([
  "audio/m4a",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
]);

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function extensionOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function toSegments(
  segments: Array<{ start: number; end: number; text: string }> | undefined
): Segment[] {
  return (segments ?? [])
    .map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    }))
    .filter(
      (segment) =>
        Number.isFinite(segment.start) &&
        Number.isFinite(segment.end) &&
        segment.start >= 0 &&
        segment.end >= segment.start &&
        segment.text.length > 0
    )
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return error("La solicitud debe incluir un formulario válido", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return error("Debes seleccionar un archivo", 400);
  }

  const extension = extensionOf(file.name);
  if (
    !ALLOWED_EXTENSIONS.has(extension) ||
    (file.type.length > 0 && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase()))
  ) {
    return error("Formato no compatible. Usa mp4, mp3, m4a o wav", 400);
  }

  if (file.size === 0) {
    return error("El archivo está vacío", 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return error("El archivo supera el límite de 25 MB", 400);
  }

  if (!process.env.OPENAI_API_KEY) {
    return error("El servicio de transcripción no está configurado", 503);
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const openaiFile = await toFile(await file.arrayBuffer(), file.name, {
      type: file.type || undefined,
    });
    const transcription = await client.audio.transcriptions.create({
      file: openaiFile,
      model: "whisper-1",
      response_format: "verbose_json",
      language: "es",
    });
    const segments = toSegments(transcription.segments);

    // Whisper without segmentos no permite construir subtítulos sincronizados.
    if (segments.length === 0) {
      return error("El servicio no devolvió marcas de tiempo para este archivo", 502);
    }

    const result: TranscriptResult = {
      source: "upload",
      text: segments.map((segment) => segment.text).join(" "),
      segments,
    };

    return NextResponse.json(result);
  } catch {
    return error("No se pudo transcribir el archivo. Inténtalo de nuevo", 502);
  }
}
