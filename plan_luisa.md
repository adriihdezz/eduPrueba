# Plan de Luisa — Ingesta y subtítulos

## Objetivo

Implementar la entrada de contenido: transcribir archivos locales con Whisper, extraer subtítulos de enlaces de YouTube y generar archivos WebVTT. El resultado de ambas rutas debe cumplir `TranscriptResult`.

## Alcance y archivos propios

- `app/api/transcribe/route.ts`
- `app/api/youtube/route.ts`
- `lib/vtt.ts`

No modificar componentes de interfaz ni la API de adaptación. Si faltan los contratos compartidos, pedir que se creen `lib/types.ts` y `lib/mock.ts` antes de empezar; no crear variantes locales de esos tipos.

## Regla de ejecución

Ejecuta **una sola fase cada vez**. Al final de cada fase, realiza su comprobación y no avances hasta que pase. Si hay un bloqueo externo (por ejemplo, una clave de OpenAI ausente), deja el código preparado, documenta el bloqueo y continúa solo con las comprobaciones que no requieran esa dependencia.

## Fase 1 — Preparar el entorno y validar contratos

1. Confirma que el proyecto Next.js usa App Router y TypeScript.
2. Comprueba que están instalados `openai` y `youtube-transcript`; si no lo están, instala únicamente esos paquetes.
3. Lee `lib/types.ts` y confirma que existen `Segment` y `TranscriptResult` exactamente como define el PRD.
4. Comprueba que `OPENAI_API_KEY` está documentada en `.env.local.example` o en el README, sin incluir nunca su valor real.

**Verificación:** `npm run lint` (si el script existe) no debe introducir errores nuevos. Solo entonces pasa a la fase 2.

## Fase 2 — Crear el generador VTT puro

1. Implementa `segmentsToVtt(segments: Segment[]): string` en `lib/vtt.ts`.
2. Genera la cabecera `WEBVTT`, una línea vacía y un bloque por segmento.
3. Formatea horas, minutos, segundos y milisegundos como `HH:MM:SS.mmm`.
4. Conserva el texto de cada segmento y separa los bloques con una línea vacía.
5. Trata de forma segura una lista vacía y timestamps de más de una hora.

**Verificación:** ejecuta una comprobación local con segmentos de ejemplo y confirma que el texto resultante contiene `WEBVTT` y una línea del formato `00:00:00.000 --> 00:00:04.200`. No avances hasta confirmarlo.

## Fase 3 — Implementar `POST /api/transcribe`

1. Crea `app/api/transcribe/route.ts` con un manejador `POST`.
2. Lee `request.formData()` y exige el campo `file`.
3. Valida que sea un archivo, que pese como máximo 25 MB y que su extensión o MIME corresponda a `mp4`, `mp3`, `m4a` o `wav`.
4. Devuelve errores JSON claros con código 400 para archivo ausente, tipo no admitido o tamaño excesivo.
5. Convierte el archivo a un objeto aceptado por el SDK de OpenAI y llama a `openai.audio.transcriptions.create` con:
   - `model: "whisper-1"`
   - `response_format: "verbose_json"`
   - `language: "es"`
6. Convierte los segmentos recibidos a `{ start, end, text }` y une sus textos para crear la transcripción completa.
7. Devuelve `{ source: "upload", text, segments }` con estado 200.
8. Captura fallos de OpenAI y devuelve un mensaje seguro en JSON, sin revelar claves ni trazas internas.

**Verificación:** con el servidor activo y una clave válida, ejecuta el `curl` del PRD contra un audio corto. Confirma que la respuesta tiene `source: "upload"`, `text` no vacío y al menos un segmento. Después pasa a la fase 4.

## Fase 4 — Implementar `POST /api/youtube`

1. Crea una función privada para extraer `videoId` de URLs `youtube.com/watch?v=`, `youtu.be/` y `youtube.com/shorts/`.
2. Crea `app/api/youtube/route.ts` y valida que el body JSON incluya una URL válida de YouTube.
3. Devuelve 400 con un mensaje claro si no se puede obtener el identificador.
4. Consulta primero `YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })`.
5. Si no hay subtítulos en español, reintenta una vez sin forzar idioma.
6. Mapea `{ offset, duration, text }` de milisegundos a segundos: `start = offset / 1000`, `end = (offset + duration) / 1000`.
7. Devuelve `{ source: "youtube", videoId, text, segments }`.
8. Ante falta de subtítulos, devuelve un error comprensible: `Este vídeo no tiene subtítulos; súbelo como archivo`.

**Verificación:** prueba una URL conocida con subtítulos y otra sin subtítulos o malformada. La primera debe devolver `videoId` y segmentos; la segunda un error controlado. No avances hasta comprobar ambas rutas.

## Fase 5 — Robustez e integración

1. Relee las respuestas de las dos rutas y verifica que respetan `TranscriptResult` sin campos incompatibles.
2. Asegura que los errores usan `{ error: string }` y códigos HTTP adecuados.
3. Ejecuta `npm run lint` y `npm run build` si están disponibles.
4. Comunica a la persona de frontend los campos exactos devueltos y cómo importar `segmentsToVtt`.

**Criterio de terminado:** archivo local válido y enlace de YouTube con subtítulos devuelven transcripción segmentada; esos segmentos generan un `.vtt` válido.
