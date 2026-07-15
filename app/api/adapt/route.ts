import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { buildAdaptMessages, buildAdaptRepairMessages } from "../../../lib/prompts";
import type { AdaptResult } from "../../../lib/types";

const MODEL = "gpt-4o-mini";
const MAX_TRANSCRIPT_CHARS = 24_000;
const INVALID_JSON_ERROR = "El cuerpo debe ser JSON válido";
const INVALID_TRANSCRIPT_ERROR = "Debes enviar una transcripción válida";
const TOO_LONG_ERROR = `La transcripción es demasiado larga. Máximo ${MAX_TRANSCRIPT_CHARS} caracteres`;
const PROVIDER_ERROR = "No se pudo generar la adaptación. Inténtalo de nuevo más tarde";

const responseFormat = {
  type: "json_schema" as const,
  json_schema: {
    name: "adapt_result",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        lecturaFacil: { type: "string" },
        puntosClave: {
          type: "array",
          minItems: 4,
          maxItems: 8,
          items: { type: "string" }
        }
      },
      required: ["lecturaFacil", "puntosClave"]
    }
  }
};

let openaiClient: OpenAI | undefined;

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return undefined;
  }

  openaiClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export function validateAdaptResult(value: unknown): AdaptResult | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<AdaptResult>;
  const lecturaFacil = typeof candidate.lecturaFacil === "string" ? candidate.lecturaFacil.trim() : "";

  if (!lecturaFacil || !Array.isArray(candidate.puntosClave)) {
    return undefined;
  }

  if (candidate.puntosClave.length < 4 || candidate.puntosClave.length > 8) {
    return undefined;
  }

  const puntosClave = candidate.puntosClave.map((point) => (typeof point === "string" ? point.trim() : ""));

  if (puntosClave.some((point) => !point)) {
    return undefined;
  }

  return { lecturaFacil, puntosClave };
}

function parseAdaptResult(content: string): AdaptResult | undefined {
  try {
    return validateAdaptResult(JSON.parse(content));
  } catch {
    return undefined;
  }
}

function logProviderError(error: unknown) {
  if (error && typeof error === "object") {
    const detail = error as { code?: unknown; status?: unknown; type?: unknown };
    console.error("Adaptation provider failed", {
      code: detail.code,
      status: detail.status,
      type: detail.type
    });
    return;
  }

  console.error("Adaptation provider failed");
}

async function createAdaptation(client: OpenAI, text: string, attempt: 1 | 2) {
  const messages = attempt === 1 ? buildAdaptMessages(text) : buildAdaptRepairMessages(text);
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: messages as ChatCompletionMessageParam[],
    response_format: responseFormat,
    temperature: 0.2
  });

  return completion.choices[0]?.message?.content;
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError(INVALID_JSON_ERROR, 400);
  }

  const text = typeof (body as { text?: unknown })?.text === "string" ? (body as { text: string }).text : undefined;

  if (!text || !text.trim()) {
    return jsonError(INVALID_TRANSCRIPT_ERROR, 400);
  }

  if (text.length > MAX_TRANSCRIPT_CHARS) {
    return jsonError(TOO_LONG_ERROR, 413);
  }

  const client = getOpenAIClient();

  if (!client) {
    return jsonError(PROVIDER_ERROR, 503);
  }

  try {
    for (const attempt of [1, 2] as const) {
      const content = await createAdaptation(client, text, attempt);

      if (!content) {
        continue;
      }

      const parsed = parseAdaptResult(content);

      if (parsed) {
        return NextResponse.json(parsed);
      }
    }

    return jsonError(PROVIDER_ERROR, 502);
  } catch (error) {
    logProviderError(error);
    return jsonError(PROVIDER_ERROR, 502);
  }
}
