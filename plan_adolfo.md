# Plan de Adolfo — Entrada dual y reproductor con subtítulos

## Objetivo

Construir la experiencia de entrada (enlace de YouTube o archivo local), orquestar las tres APIs y mostrar el vídeo o audio con subtítulos y descarga VTT.

## Alcance y archivos propios

- `app/page.tsx`
- `components/VideoInput.tsx`
- `components/VideoPlayer.tsx`

Puede importar `lib/types.ts`, `lib/mock.ts` y `lib/vtt.ts`, pero no debe editarlos. Tampoco debe editar los componentes de pestañas o TTS de Valeri.

## Entregables y frontera de integración

| Elemento | Responsabilidad de Adolfo | Contrato externo |
|---|---|---|
| `VideoInput` | recoger una única fuente y comunicar la acción | callbacks de URL, archivo y demo |
| `app/page.tsx` | máquina de estados, llamadas, errores y composición | APIs de Luisa y Adrián; `ResultTabs` de Valeri |
| `VideoPlayer` | medio local/YouTube, pista local y descarga VTT | `TranscriptResult`, archivo local opcional, `segmentsToVtt` |

La página es componente cliente porque gestiona `File`, `URL.createObjectURL`, eventos y estado. No contiene claves, no intenta procesar YouTube en cliente, no llama a OpenAI directamente y no conserva resultados entre sesiones.

## Preparación concreta para Codex

Antes de cambiar código, ordena a Codex que lea `lib/types.ts`, `lib/mock.ts`, `lib/vtt.ts`, los tres contratos de API y las props públicas de `ResultTabs`. Haz un inventario de componentes existentes con `rg --files app components lib`. Solicita cambios solo en los tres archivos propios y ejecuta `git diff --check` después de cada fase. Si `ResultTabs` aún no existe, crea una interfaz temporal mínima mediante tipos, sin modificar su archivo ni duplicarlo.

## Regla de ejecución

Procede **una fase a la vez**. Haz la verificación indicada y corrige el resultado antes de seguir. Mantén el frontend operativo con los mocks hasta que las APIs estén disponibles.

## Fase 1 — Revisar contratos y definir estado de pantalla

1. Lee `lib/types.ts`, `lib/mock.ts` y `lib/vtt.ts`.
2. Define en `app/page.tsx` el estado mínimo: archivo seleccionado, URL local temporal, `TranscriptResult`, `AdaptResult`, fase de carga, mensaje de error y si se muestra demo.
3. Usa tipos explícitos para las fases: inactivo, transcribiendo, adaptando, listo y error.
4. Planifica props estables para pasar datos a `VideoInput`, `VideoPlayer` y `ResultTabs`.
5. Declara un tipo de origen de solicitud (`"upload" | "youtube" | "demo"`) y un estado de resultado atómico: nunca renderices datos de una solicitud anterior durante una nueva carga.
6. Define la invariante central: `ready` solo existe si hay `transcript` y `adapt`; `upload` listo necesita además archivo y URL local para reproducir; `youtube` listo necesita `videoId`.
7. Decide una estrategia frente a dobles clics y solicitudes antiguas: usa un contador/identificador de solicitud o `AbortController` para ignorar la respuesta de una petición ya reemplazada.

**Tabla de estado que debe guiar la implementación:**

| Estado | Entrada habilitada | Resultado visible | Acción posible |
|---|---|---|---|
| `idle` | sí | no | enviar fuente o demo |
| `transcribing` | no | no | esperar/cancelar si se implementa |
| `adapting` | no | no | esperar/cancelar si se implementa |
| `ready` | sí | sí | iniciar nueva adaptación |
| `error` | sí | no o resultado anterior solo si se decide explícitamente | corregir y reintentar |

**Verificación:** la página compila usando los mocks sin depender de APIs reales. Solo entonces pasa a la fase 2.

## Fase 2 — Implementar `VideoInput`

1. Crea una tarjeta con campo `Pega un link de YouTube`, botón `Adaptar`, separador `— o —` e input de archivo.
2. Restringe el selector a `.mp4,.mp3,.m4a,.wav` y muestra nombre y tamaño del archivo elegido.
3. Valida en cliente tamaño máximo de 25 MB antes de hacer la petición y muestra un error claro.
4. Deshabilita acciones incompatibles mientras se procesa una solicitud.
5. Muestra el estado actual: `Transcribiendo…` y después `Generando adaptaciones…`.
6. Añade el botón `Usar demo`, que carga `mockTranscript` y `mockAdapt`.
7. Entrega callbacks diferenciados para YouTube, archivo y demo al componente padre.
8. Usa `<form>` para la URL y evita el envío si el campo está vacío. Evita que pulsar Enter active simultáneamente el formulario y otra acción.
9. El input de archivo debe poder vaciarse al reiniciar o después de un error, y debe permitir seleccionar de nuevo el mismo archivo.
10. No uses el valor de la URL directamente como `src` de iframe; solo el `videoId` recibido desde una ruta que lo ha validado.
11. Usa un contenedor de estado con `role="status"` o `aria-live="polite"` para los cambios de fase, y `role="alert"` para errores.

**Verificación:** sin backend, selecciona un archivo válido, intenta uno no permitido, intenta uno mayor de 25 MB, escribe una URL vacía, escribe una URL y pulsa Enter, y usa demo. Confirma que solo hay una acción por interacción, que se ven nombre/tamaño, que los mensajes se anuncian y que demo deja la interfaz lista sin hacer red. No avances hasta probar todos los casos.

## Fase 3 — Orquestar las solicitudes en `page.tsx`

1. Para archivo: crea `FormData`, añade `file` y llama a `POST /api/transcribe`.
2. Para YouTube: llama a `POST /api/youtube` con `{ url }` JSON.
3. En ambos casos, comprueba `response.ok`; si falla, muestra el texto de `error` devuelto por la API.
4. Con el `TranscriptResult` correcto, cambia el estado a adaptando y llama a `POST /api/adapt` con `{ text: transcript.text }`.
5. Guarda ambos resultados solo cuando las respuestas son válidas; limpia resultados previos al iniciar una nueva petición.
6. Para archivos, crea la URL de objeto local y revócala al sustituir el archivo o desmontar el componente.
7. Para cada `fetch`, comprueba primero la cabecera/conversión JSON de forma segura: una respuesta inesperada no debe producir un error sin controlar en pantalla.
8. Valida en cliente la forma mínima de las respuestas antes de guardarlas: `text` string, `segments` array, `source` conocido; en YouTube, `videoId` no vacío; para adaptación, cadena y array de puntos.
9. Si la respuesta pertenece a una solicitud antigua, ignórala sin mutar estado.
10. En `finally`, restaura el estado solo si esa solicitud sigue siendo la actual. No habilites botones antes de terminar la segunda llamada.
11. La ruta demo debe usar las mismas props de resultado final que las rutas reales, de modo que pruebe la composición completa.

**Secuencia de red esperada:**

```
archivo ──POST FormData /api/transcribe──► TranscriptResult ──POST JSON /api/adapt──► AdaptResult
YouTube ──POST JSON /api/youtube─────────► TranscriptResult ──POST JSON /api/adapt──► AdaptResult
demo ─────────────────────────────────────► mockTranscript + mockAdapt (sin red)
```

**Verificación:** inspecciona la pestaña Network en una ruta real: debe haber dos llamadas en orden y ningún tercer fetch. Prueba una respuesta 400 de ingesta, una 5xx de adaptación y dos solicitudes rápidas consecutivas; confirma estado inactivo → transcribiendo → adaptando → listo, y que la segunda solicitud gana. Fuerza además JSON de error y confirma que la UI no se rompe.

## Fase 4 — Implementar `VideoPlayer`

1. Recibe `TranscriptResult`, el archivo o URL local cuando proceda y los segmentos.
2. Si `source === "upload"` y el tipo es vídeo, muestra `<video controls>`.
3. Si el archivo es audio, muestra `<audio controls>` y un aviso de que la transcripción está disponible en las pestañas.
4. Para vídeo local, usa `segmentsToVtt`, crea un `Blob` de tipo `text/vtt`, una URL de objeto y un `<track kind="subtitles" srclang="es" default>`.
5. Libera las URL de objetos de VTT al cambiar de contenido o desmontar.
6. Si `source === "youtube"`, renderiza un iframe seguro de `https://www.youtube.com/embed/{videoId}` con título y permisos apropiados. No intentes inyectar pistas en ese iframe.
7. En ambos modos, crea el botón para descargar el VTT con nombre `subtitulos.vtt` a partir de los segmentos.
8. Añade `preload="metadata"` en medios locales, controles nativos y texto alternativo/contextual para que el usuario sepa qué se está reproduciendo.
9. Para el iframe, usa `title` descriptivo, `allowFullScreen` si corresponde y una política `allow` mínima. El `src` debe derivarse solo de un ID validado, usando codificación si fuera necesaria.
10. Crea y libera por separado las URLs de objeto del medio y del VTT. La descarga puede crear una URL efímera y revocarla tras activar el enlace.
11. Si falta archivo local en un resultado `upload`, muestra un estado de interfaz claro en vez de renderizar un `src` inválido.
12. No prometer subtítulos superpuestos para YouTube: allí se usan los subtítulos nativos cuando estén disponibles.

**Verificación:** revisa los tres modos: vídeo local con pista, audio local y YouTube. En DevTools, confirma que no quedan URLs de objeto creciendo al cambiar varias veces de archivo. Descarga el VTT, ábrelo como texto y comprueba cabecera, formato de tiempos y segmentos. En vídeo local, activa la pista de subtítulos con los controles nativos. No pases a la siguiente fase hasta lograrlo.

## Fase 5 — Integración con el panel y accesibilidad

1. Renderiza `VideoPlayer` y `ResultTabs` solo con resultados completos.
2. Pasa la transcripción y adaptación reales al panel de Valeri con props tipadas.
3. Asegura etiquetas, foco visible, botones deshabilitados semánticamente y mensajes de error anunciables.
4. Prueba en orden: demo, URL de YouTube con subtítulos, audio local y vídeo local inferior a 25 MB.
5. Ejecuta `npm run lint` y `npm run build` si existen.
6. Haz una revisión de regresión con teclado: foco inicial, formulario, botón demo, controles del reproductor, descarga y pestañas. Ninguna acción debe depender solo del ratón.
7. Comprueba la interfaz al recargar, tras completar demo, después de error y después de una segunda carga exitosa; no deben permanecer spinner, error ni resultados obsoletos.

## Handoff de Adolfo al equipo

Antes de terminar, informa a Luisa, Adrián y Valeri de:

- Props finales de `VideoPlayer` y `ResultTabs` y su ubicación.
- Estados que se muestran y textos exactos de carga/error.
- Confirmación de que las respuestas de sus APIs se consumen sin coerciones inseguras.
- Resultado de los cuatro recorridos: demo, YouTube válido, audio local y vídeo local.
- Resultado de lint/build y cualquier limitación del navegador detectada.

**Criterio de terminado:** las dos vías de entrada llevan al mismo panel de resultados; el vídeo local muestra subtítulos, el contenido YouTube se incrusta y ambos permiten descargar VTT.
