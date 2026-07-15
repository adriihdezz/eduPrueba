import { NextResponse } from "next/server";
import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
} from "youtube-transcript";

import type { Segment, TranscriptResult } from "../../../lib/types";

export const runtime = "nodejs";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function extractVideoId(value: string): string | null {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    let candidate: string | null = null;

    if (hostname === "youtu.be" || hostname === "www.youtu.be") {
      candidate = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com"
    ) {
      if (url.pathname === "/watch") {
        candidate = url.searchParams.get("v");
      } else {
        const [first, second] = url.pathname.split("/").filter(Boolean);
        if ((first === "shorts" || first === "embed") && second) {
          candidate = second;
        }
      }
    }

    return candidate && VIDEO_ID_PATTERN.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function cleanText(text: string): string {
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function hasNoCaptions(error: unknown): boolean {
  return (
    error instanceof YoutubeTranscriptDisabledError ||
    error instanceof YoutubeTranscriptNotAvailableError
  );
}

async function fetchTranscript(videoId: string) {
  try {
    return await YoutubeTranscript.fetchTranscript(videoId, { lang: "es" });
  } catch (firstError) {
    if (!(firstError instanceof YoutubeTranscriptNotAvailableLanguageError)) {
      throw firstError;
    }
    return YoutubeTranscript.fetchTranscript(videoId);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error("Debes enviar una URL de YouTube válida", 400);
  }

  const url =
    typeof body === "object" && body !== null && "url" in body && typeof body.url === "string"
      ? body.url.trim()
      : "";
  const videoId = extractVideoId(url);
  if (!videoId) {
    return error("Debes enviar una URL de YouTube válida", 400);
  }

  try {
    const transcript = await fetchTranscript(videoId);
    const segments: Segment[] = transcript
      .map((entry) => {
        const text = cleanText(entry.text);
        const start = entry.offset / 1000;
        const end = (entry.offset + entry.duration) / 1000;
        return { start, end, text };
      })
      .filter(
        (segment) =>
          Number.isFinite(segment.start) &&
          Number.isFinite(segment.end) &&
          segment.start >= 0 &&
          segment.end >= segment.start &&
          segment.text.length > 0
      )
      .sort((a, b) => a.start - b.start || a.end - b.end);

    if (segments.length === 0) {
      return error("Este vídeo no tiene subtítulos; súbelo como archivo", 422);
    }

    const result: TranscriptResult = {
      source: "youtube",
      videoId,
      text: segments.map((segment) => segment.text).join(" "),
      segments,
    };

    return NextResponse.json(result);
  } catch (caught) {
    if (hasNoCaptions(caught)) {
      return error("Este vídeo no tiene subtítulos; súbelo como archivo", 422);
    }
    return error("No se pudieron obtener los subtítulos. Prueba a subir el archivo", 502);
  }
}
