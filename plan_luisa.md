# Plan de Luisa — Ingesta y subtítulos

## Objetivo

Implementar la entrada de contenido: transcribir archivos locales con Whisper, extraer subtítulos de enlaces de YouTube y generar archivos WebVTT. El resultado de ambas rutas debe cumplir `TranscriptResult`.

## Alcance y archivos propios

- `app/api/transcribe/route.ts`
- `app/api/youtube/route.ts`
- `lib/vtt.ts`

No modificar componentes de interfaz ni la API de adaptación. Si faltan los contratos compartidos, pedir que se creen `lib/types.ts` y `lib/mock.ts` antes de empezar; no crear variantes locales de esos tipos.

## Entregables y contrato que no se debe romper

Al terminar, Luisa entrega exactamente estas piezas para que Adolfo pueda consumirlas sin adaptación manual:

| Pieza | Firma o respuesta exigida | Consumidor |
|---|---|---|
| VTT | `segmentsToVtt(segments: Segment[]): string` | `VideoPlayer` |
| Archivo | `POST /api/transcribe` → `TranscriptResult` con `source: "upload"` | `app/page.tsx` |
| YouTube | `POST /api/youtube` → `TranscriptResult` con `source: "youtube"` y `videoId` | `app/page.tsx`, `VideoPlayer` |
| Errores | `{ error: string }`, nunca HTML ni una traza | interfaz |

Los tiempos se expresan siempre en **segundos decimales**, el texto no se devuelve con etiquetas HTML y `segments` se conserva en orden temporal. No añadir autenticación, persistencia, descarga de YouTube, streaming ni cambios a los tipos sin acuerdo explícito del equipo.

## Preparación concreta para Codex

Antes de modificar nada, pide a Codex que ejecute, en este orden: `pwd`, `rg --files`, `sed -n '1,220p' lib/types.ts`, `cat package.json` y `git status --short`. Después, indícale: “edita solo los tres archivos del alcance mediante un parche; no sobrescribas cambios ajenos”. Al concluir cada fase, pide un `git diff --check` y la comprobación indicada para la fase.

## Regla de ejecución

Ejecuta **una sola fase cada vez**. Al final de cada fase, realiza su comprobación y no avances hasta que pase. Si hay un bloqueo externo (por ejemplo, una clave de OpenAI ausente), deja el código preparado, documenta el bloqueo y continúa solo con las comprobaciones que no requieran esa dependencia.

## Fase 1 — Preparar el entorno y validar contratos

1. Confirma que el proyecto Next.js usa App Router y TypeScript.
2. Comprueba que están instalados `openai` y `youtube-transcript`; si no lo están, instala únicamente esos paquetes.
3. Lee `lib/types.ts` y confirma que existen `Segment` y `TranscriptResult` exactamente como define el PRD.
4. Comprueba que `OPENAI_API_KEY` está documentada en `.env.local.example` o en el README, sin incluir nunca su valor real.
5. Confirma que las rutas no requieren runtime Edge; usa el runtime Node por defecto, que es el compatible con las dependencias y archivos.
6. Si el repo aún no está inicializado, detente y comunica que primero debe existir la base Next.js, tipos compartidos y dependencias; no construyas una aplicación paralela.

**Verificación:** `npm run lint` (si el script existe) no debe introducir errores nuevos. Solo entonces pasa a la fase 2.

## Fase 2 — Crear el generador VTT puro

1. Implementa `segmentsToVtt(segments: Segment[]): string` en `lib/vtt.ts`.
2. Genera la cabecera `WEBVTT`, una línea vacía y un bloque por segmento.
3. Formatea horas, minutos, segundos y milisegundos como `HH:MM:SS.mmm`.
4. Conserva el texto de cada segmento y separa los bloques con una línea vacía.
5. Trata de forma segura una lista vacía y timestamps de más de una hora.
6. Normaliza cada valor antes de formatear: evita números no finitos, timestamps negativos y un `end` menor que `start`. La opción más segura es omitir segmentos irrecuperables y mantener los válidos.
7. Redondea o trunca milisegundos de forma consistente; nunca uses formato local con comas.
8. El resultado debe acabar con salto de línea para que el archivo se abra bien en reproductores tolerantes y estrictos.

**Verificación:** ejecuta una comprobación local con tres segmentos: uno desde cero, uno con decimales y uno que empiece después de una hora. Confirma cabecera, orden, formato `00:00:00.000 --> 00:00:04.200`, salto de línea final y que una lista vacía devuelve solo una cabecera VTT válida. No avances hasta confirmarlo.

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
9. Comprueba al inicio que existe `OPENAI_API_KEY`; si no existe, devuelve una respuesta de servidor entendible, por ejemplo `El servicio de transcripción no está configurado`.
10. Considera MIME poco fiables: permite una lista cerrada de MIME habituales **o** una extensión admitida en el nombre, sin aceptar extensiones desconocidas. No aceptes ficheros vacíos.
11. No guardes el archivo en disco, no lo registres en logs y no retornes el nombre del archivo si no hace falta.
12. Al mapear la respuesta, filtra segmentos sin texto, asegura que `end >= start` y usa el texto de segmentos para `text`; si el proveedor no devuelve segmentos pero devuelve texto, responde de forma explícita y documenta el comportamiento elegido antes de integrarlo.

**Matriz mínima de respuestas:**

| Caso | Estado | Cuerpo esperado |
|---|---:|---|
| Sin `file` | 400 | `{ error: "Debes seleccionar un archivo" }` |
| Tipo no permitido | 400 | `{ error: "Formato no compatible…" }` |
| Más de 25 MB | 400 | `{ error: "El archivo supera el límite de 25 MB" }` |
| Clave ausente o proveedor caído | 5xx | `{ error: "No se pudo transcribir el archivo…" }` |
| Correcto | 200 | `TranscriptResult` de carga |

**Verificación:** con el servidor activo y una clave válida, ejecuta el `curl` del PRD contra un audio corto. Repite con: request sin campo, extensión inválida y archivo de más de 25 MB (sin subirlo al proveedor). Confirma que la respuesta buena tiene `source: "upload"`, `text` no vacío, segmentos numéricos ordenados y `end >= start`; las demás deben corresponder a la matriz. Después pasa a la fase 4.

## Fase 4 — Implementar `POST /api/youtube`

1. Crea una función privada para extraer `videoId` de URLs `youtube.com/watch?v=`, `youtu.be/` y `youtube.com/shorts/`.
2. Crea `app/api/youtube/route.ts` y valida que el body JSON incluya una URL válida de YouTube.
3. Devuelve 400 con un mensaje claro si no se puede obtener el identificador.
4. Consulta primero `YoutubeTranscript.fetchTranscript(videoId, { lang: "es" })`.
5. Si no hay subtítulos en español, reintenta una vez sin forzar idioma.
6. Mapea `{ offset, duration, text }` de milisegundos a segundos: `start = offset / 1000`, `end = (offset + duration) / 1000`.
7. Devuelve `{ source: "youtube", videoId, text, segments }`.
8. Ante falta de subtítulos, devuelve un error comprensible: `Este vídeo no tiene subtítulos; súbelo como archivo`.
9. Acepta `www.youtube.com`, `m.youtube.com`, parámetros adicionales y fragmentos sin incluirlos en el ID. Rechaza dominios que solo se parecen a YouTube.
10. Trata el texto de la librería como contenido: limpia solo espacios superfluos, conserva caracteres españoles y no ejecutes ni interpolas HTML.
11. Si el primer intento falla por otro motivo (red, limitación de YouTube o vídeo inaccesible), no lo presentes como “sin subtítulos” a menos que la librería lo confirme. Devuelve un mensaje genérico que invite a probar la carga local.
12. Si el array obtenido queda vacío, considéralo un fallo de subtítulos aunque la llamada no lance excepción.

**Casos de URL que deben cubrirse:**

| Entrada | Resultado esperado |
|---|---|
| `https://www.youtube.com/watch?v=ABCDEFGHIJK` | ID `ABCDEFGHIJK` |
| `https://youtu.be/ABCDEFGHIJK?t=20` | ID `ABCDEFGHIJK` |
| `https://www.youtube.com/shorts/ABCDEFGHIJK` | ID `ABCDEFGHIJK` |
| URL de YouTube sin ID / dominio externo | 400, error comprensible |

**Verificación:** prueba las tres formas de URL de la tabla, una URL malformada y un vídeo sin subtítulos. Para una URL conocida con subtítulos, confirma que `videoId` es el esperado, los offsets se convierten de ms a segundos, `text` es la unión legible de segmentos y no hay segmentos vacíos. No avances hasta comprobar todas las rutas.

## Fase 5 — Robustez e integración

1. Relee las respuestas de las dos rutas y verifica que respetan `TranscriptResult` sin campos incompatibles.
2. Asegura que los errores usan `{ error: string }` y códigos HTTP adecuados.
3. Ejecuta `npm run lint` y `npm run build` si están disponibles.
4. Comunica a la persona de frontend los campos exactos devueltos y cómo importar `segmentsToVtt`.
5. Entrega a Adolfo una muestra real anonimizada de cada respuesta correcta y la lista de errores que debe mostrar sin reemplazarlos por mensajes genéricos.
6. Pide a Adolfo que pruebe la descarga VTT con una respuesta de ambas fuentes. Cualquier discrepancia de tipos se resuelve en los contratos compartidos, nunca mediante `as any`.

## Handoff de Luisa a Adolfo

Antes de declarar terminada la parte, entrega este checklist escrito:

- URL de cada ruta y formato de su request.
- Ejemplo de `TranscriptResult` para `upload` y otro para `youtube`.
- Significado de cada error que puede recibir la UI.
- Confirmación de que `segmentsToVtt` es una función pura y no accede a `window`.
- Resultado de lint/build y cualquier limitación observada de `youtube-transcript`.

**Criterio de terminado:** archivo local válido y enlace de YouTube con subtítulos devuelven transcripción segmentada; esos segmentos generan un `.vtt` válido.
