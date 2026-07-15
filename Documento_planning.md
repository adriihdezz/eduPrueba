# PRD — AdaptaVídeo (prototipo 1 hora, 4 personas)

## Qué es

Herramienta web donde un profesor mete un vídeo de clase — **subiendo un mp4/mp3 desde el PC o pegando un link de YouTube** — y recibe, en una sola pantalla:

1. **Subtítulos** sincronizados sobre el vídeo (descargables en `.vtt`) → alumnado con sordera/hipoacusia.
2. **Transcripción completa** legible → dislexia (leer a su ritmo, repasar).
3. **Versión en lectura fácil** del contenido → discapacidad intelectual y TEA.
4. **Puntos clave numerados** (resumen esencial) → TDAH.
5. **Botón "Escuchar"** (TTS del navegador) sobre cualquier texto → dislexia, baja visión.

**No incluye** (fuera de alcance): audiodescripción, lengua de signos, login, base de datos, historial, descarga del vídeo de YouTube. Todo vive en memoria del cliente durante la sesión.

## Por qué

El profesor hoy adapta el material a mano, alumno por alumno. El vídeo es el formato menos accesible de todos: sin transcripción no sirve a sordos, sin simplificación no sirve a discapacidad intelectual/TEA, sin resumen pierde a TDAH. Una sola tubería (vídeo → transcript → adaptaciones) cubre los 4 perfiles a la vez.

## Stack

- **Next.js 14 (App Router), un solo repo, TypeScript.**
- **OpenAI**: Whisper (`whisper-1`) para transcribir archivos subidos, `gpt-4o-mini` para las adaptaciones.
- **`youtube-transcript`** (npm) para los links de YouTube: extrae los subtítulos ya existentes del vídeo **sin descargar nada y sin gastar Whisper**. Es el atajo que hace viable YouTube en 1 hora.
- Sin base de datos. Sin auth. Una variable de entorno: `OPENAI_API_KEY`.
- Despliegue: `npm run dev` en local basta para la demo. (Vercel si sobra tiempo.)

## Flujo de usuario

```
┌────────────────────────────────────────┐
│  [ Pegar link de YouTube ............ ]│
│              — o —                     │
│  [ Subir mp4/mp3 desde el PC ]         │
└────────────────────────────────────────┘
            ↓ (loading)
  ┌─────────────────────────────┬──────────────────────────┐
  │ Vídeo con subtítulos        │ Tabs:                    │
  │ (player local o embed YT)   │  · Transcripción         │
  │ + botón descargar .vtt      │  · Lectura fácil         │
  │                             │  · Puntos clave          │
  │                             │  (cada tab: botón 🔊 TTS)│
  └─────────────────────────────┴──────────────────────────┘
```

## Contrato de datos (LO PRIMERO QUE SE ESCRIBE — 5 min, entre todos)

Crear `lib/types.ts` y `lib/mock.ts` ANTES de repartirse. Todo el mundo programa contra esto. El frontend usa el mock hasta que el backend esté listo.

```ts
// lib/types.ts
export type Segment = { start: number; end: number; text: string }; // segundos

export type TranscriptResult = {
  source: "upload" | "youtube";
  videoId?: string;      // solo si source === "youtube" (para el embed)
  text: string;          // transcripción completa
  segments: Segment[];   // para generar el .vtt
};

export type AdaptResult = {
  lecturaFacil: string;  // párrafos separados por \n\n
  puntosClave: string[]; // 4-8 puntos, frases cortas
};
```

```ts
// lib/mock.ts — datos falsos realistas (un vídeo de fotosíntesis de 2 min)
// export const mockTranscript: TranscriptResult = { source: "upload", ... 6-10 segments ... }
// export const mockAdapt: AdaptResult = { ... }
```

### Contratos de API

```
POST /api/transcribe
  body: FormData con campo "file" (mp4/mp3/m4a/wav, máx 25MB — límite de Whisper)
  200: TranscriptResult  (source: "upload")
  4xx/5xx: { error: string }

POST /api/youtube
  body: { url: string }   // cualquier formato de URL de YouTube
  200: TranscriptResult  (source: "youtube", videoId incluido)
  4xx/5xx: { error: string }  // p. ej. "Este vídeo no tiene subtítulos disponibles"

POST /api/adapt
  body: { text: string }   // la transcripción completa
  200: AdaptResult
  4xx/5xx: { error: string }
```

---

## Reparto — 4 workstreams paralelos

Regla de oro: **cada persona toca solo sus ficheros**. Cero conflictos de merge. Integración en el minuto 45.

### Persona 1 — Ingesta: transcripción de archivo + YouTube
**Ficheros:** `app/api/transcribe/route.ts`, `app/api/youtube/route.ts`, `lib/vtt.ts`

- **/api/transcribe**: recibe el FormData, valida tipo (mp4/mp3/m4a/wav) y tamaño (≤25MB). Llama a Whisper: `openai.audio.transcriptions.create({ file, model: "whisper-1", response_format: "verbose_json", language: "es" })` → `verbose_json` devuelve `segments` con timestamps. Mapea a `TranscriptResult` con `source: "upload"`.
- **/api/youtube**: extrae el `videoId` de la URL (regex que cubra `youtube.com/watch?v=`, `youtu.be/`, `shorts/`). Llama a `YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })` del paquete `youtube-transcript`; si no hay subtítulos en español, reintenta sin `lang` (coge lo que haya). Mapea `{ offset, duration, text }` → `Segment` (offset y duration vienen en ms: dividir entre 1000). Si el vídeo no tiene subtítulos, devolver error claro: "Este vídeo no tiene subtítulos; súbelo como archivo".
- `lib/vtt.ts`: función pura `segmentsToVtt(segments: Segment[]): string`:
  ```
  WEBVTT

  00:00:00.000 --> 00:00:04.200
  Hola, hoy vamos a ver la fotosíntesis.
  ```
- Tests manuales:
  `curl -F "file=@test.mp3" localhost:3000/api/transcribe`
  `curl -X POST localhost:3000/api/youtube -H 'Content-Type: application/json' -d '{"url":"https://youtu.be/..."}'`

### Persona 2 — API de adaptación
**Ficheros:** `app/api/adapt/route.ts`, `lib/prompts.ts`

- Recibe `{ text }`, llama a `gpt-4o-mini` con `response_format: { type: "json_object" }` pidiendo `{ lecturaFacil, puntosClave }` en una sola llamada.
- Prompt en `lib/prompts.ts` (para iterarlo sin tocar la ruta). Requisitos del prompt:
  - **Lectura fácil**: frases de máx. 10-12 palabras, una idea por frase, vocabulario común, sin subordinadas, sin metáforas ni ironía (crítico para TEA), definir entre paréntesis cualquier tecnicismo imprescindible, mantener TODO el contenido (es adaptación, no resumen — longitud similar al original).
  - **Puntos clave**: 4-8 puntos, empezando por el más importante, cada uno una frase corta y literal.
  - Responder SIEMPRE en español y SOLO el JSON.
- Validar el JSON parseado antes de devolverlo; si falla el parse, reintentar 1 vez.
- Test manual: `curl -X POST localhost:3000/api/adapt -H 'Content-Type: application/json' -d '{"text":"..."}'`.

### Persona 3 — Frontend: entrada dual + vídeo con subtítulos
**Ficheros:** `app/page.tsx`, `components/VideoInput.tsx`, `components/VideoPlayer.tsx`

- `VideoInput`: dos vías en la misma tarjeta —
  - Campo de texto "Pega un link de YouTube" + botón "Adaptar".
  - Debajo, "— o —" y un input de archivo (accept `.mp4,.mp3,.m4a,.wav`) con nombre y tamaño visibles.
  - Estados: idle → procesando (spinner con mensaje "Transcribiendo…" / "Generando adaptaciones…") → listo / error. Los errores de la API se muestran tal cual (incluye el de "vídeo sin subtítulos").
- Orquestación en `page.tsx`: según la vía → `POST /api/transcribe` o `POST /api/youtube` → con el resultado → `POST /api/adapt` → guarda ambos en estado y renderiza resultados. Mientras el backend no exista, botón "Usar demo" que carga `lib/mock.ts`.
- `VideoPlayer`, dos modos según `source`:
  - `"upload"`: `<video>` con `URL.createObjectURL(file)` + track de subtítulos generado en cliente: `segmentsToVtt()` → `Blob` → `URL.createObjectURL` → `<track kind="subtitles" srclang="es" default>`. Si es solo audio (mp3), `<audio>` y el texto como transcripción.
  - `"youtube"`: `<iframe>` embed (`https://www.youtube.com/embed/{videoId}`). Los subtítulos nativos del embed ya existen; nuestro valor va en las tabs. No intentar inyectar el track en el iframe.
  - En ambos modos: botón "Descargar .vtt" (blob de `segmentsToVtt()`, `download="subtitulos.vtt"`).

### Persona 4 — Frontend: panel de adaptaciones + TTS
**Ficheros:** `components/ResultTabs.tsx`, `components/TtsButton.tsx`, `app/globals.css`

- `ResultTabs`: tres pestañas — Transcripción / Lectura fácil / Puntos clave. Programa contra `mockTranscript` y `mockAdapt` desde el minuto 5; recibe los datos reales por props al integrar.
  - **Transcripción**: texto corrido, interlineado 1.8.
  - **Lectura fácil**: fuente 17-18px, interlineado 2, espaciado entre letras ligero, una frase por línea.
  - **Puntos clave**: lista numerada con el punto 1 destacado ("lo esencial").
- `TtsButton`: `speechSynthesis` del navegador (`new SpeechSynthesisUtterance(text)`, `lang: "es-ES"`, `rate: 0.9`), toggle reproducir/parar. Uno por pestaña, lee el contenido de la pestaña activa.
- Estilo global mínimo: limpio, contraste alto, botones grandes. Nada de librerías de UI — CSS plano o Tailwind si ya viene con `create-next-app`.

---

## Timeline (60 min)

| Min | Todos |
|---|---|
| 0-5 | Uno crea el repo (`npx create-next-app adaptavideo --ts`), instala `openai` y `youtube-transcript`, pushea `lib/types.ts` + `lib/mock.ts` + este PRD. Los demás clonan. |
| 5-45 | Cada uno en su workstream, en su rama o directamente en main (ficheros disjuntos). |
| 45-55 | Integración: P3 quita el mock y conecta las APIs reales. Prueba end-to-end con las DOS vías: un mp4 corto local y un link de YouTube con subtítulos. |
| 55-60 | Ensayo de la demo. |

## Riesgos y atajos

- **`youtube-transcript` puede fallar** (vídeos sin subtítulos, restricciones regionales, o el paquete roto por cambios de YouTube — pasa a veces). Mitigación doble: (1) elegir ANTES de empezar el vídeo de YouTube de la demo y verificar que el paquete le saca los subtítulos; (2) si el paquete está roto, la vía upload es el plan B y la demo sigue en pie. **No** intentar descargar el audio de YouTube con ytdl para pasarlo por Whisper — es el agujero de tiempo clásico.
- **Whisper tarda** (~1 min por cada 10 min de vídeo): vídeos de prueba de 1-2 minutos. Una request síncrona vale; nada de streaming ni polling.
- **Límite 25MB de Whisper**: validar en cliente y servidor; mensaje de error claro. No implementar troceado.
- **El prompt de lectura fácil resume en vez de adaptar**: el fallo más probable de P2. Insistir en el prompt: "misma longitud aproximada, no resumas".
- **Bloqueo cruzado**: no existe si el contrato de tipos se escribe primero. Ante la duda, el mock manda.

## Demo (guion de 2 min)

1. Pegas un link de YouTube de una clase → aparecen las adaptaciones al lado del vídeo.
2. "Y si el vídeo es vuestro y no está en YouTube…" → subes un mp4 de 90 segundos → mismo resultado, ahora con subtítulos incrustados en el player.
3. Tab lectura fácil → "esto para discapacidad intelectual y TEA".
4. Tab puntos clave → "esto para TDAH".
5. Botón escuchar → "esto para dislexia". Botón descargar .vtt → "esto para el alumno sordo".
6. Cierre: "Cualquier vídeo, cuatro perfiles, cero trabajo manual del profesor."

## Éxito del prototipo

Un link de YouTube Y un mp4 local de 1-2 min entran, y las 4 salidas son mostrables sin editar nada a mano. Nada más.