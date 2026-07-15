# Plan de Adolfo — Entrada dual y reproductor con subtítulos

## Objetivo

Construir la experiencia de entrada (enlace de YouTube o archivo local), orquestar las tres APIs y mostrar el vídeo o audio con subtítulos y descarga VTT.

## Alcance y archivos propios

- `app/page.tsx`
- `components/VideoInput.tsx`
- `components/VideoPlayer.tsx`

Puede importar `lib/types.ts`, `lib/mock.ts` y `lib/vtt.ts`, pero no debe editarlos. Tampoco debe editar los componentes de pestañas o TTS de Valeri.

## Regla de ejecución

Procede **una fase a la vez**. Haz la verificación indicada y corrige el resultado antes de seguir. Mantén el frontend operativo con los mocks hasta que las APIs estén disponibles.

## Fase 1 — Revisar contratos y definir estado de pantalla

1. Lee `lib/types.ts`, `lib/mock.ts` y `lib/vtt.ts`.
2. Define en `app/page.tsx` el estado mínimo: archivo seleccionado, URL local temporal, `TranscriptResult`, `AdaptResult`, fase de carga, mensaje de error y si se muestra demo.
3. Usa tipos explícitos para las fases: inactivo, transcribiendo, adaptando, listo y error.
4. Planifica props estables para pasar datos a `VideoInput`, `VideoPlayer` y `ResultTabs`.

**Verificación:** la página compila usando los mocks sin depender de APIs reales. Solo entonces pasa a la fase 2.

## Fase 2 — Implementar `VideoInput`

1. Crea una tarjeta con campo `Pega un link de YouTube`, botón `Adaptar`, separador `— o —` e input de archivo.
2. Restringe el selector a `.mp4,.mp3,.m4a,.wav` y muestra nombre y tamaño del archivo elegido.
3. Valida en cliente tamaño máximo de 25 MB antes de hacer la petición y muestra un error claro.
4. Deshabilita acciones incompatibles mientras se procesa una solicitud.
5. Muestra el estado actual: `Transcribiendo…` y después `Generando adaptaciones…`.
6. Añade el botón `Usar demo`, que carga `mockTranscript` y `mockAdapt`.
7. Entrega callbacks diferenciados para YouTube, archivo y demo al componente padre.

**Verificación:** sin backend, seleccionar un archivo, escribir una URL y usar demo cambian el estado visual correcto. No avances hasta probar los tres casos.

## Fase 3 — Orquestar las solicitudes en `page.tsx`

1. Para archivo: crea `FormData`, añade `file` y llama a `POST /api/transcribe`.
2. Para YouTube: llama a `POST /api/youtube` con `{ url }` JSON.
3. En ambos casos, comprueba `response.ok`; si falla, muestra el texto de `error` devuelto por la API.
4. Con el `TranscriptResult` correcto, cambia el estado a adaptando y llama a `POST /api/adapt` con `{ text: transcript.text }`.
5. Guarda ambos resultados solo cuando las respuestas son válidas; limpia resultados previos al iniciar una nueva petición.
6. Para archivos, crea la URL de objeto local y revócala al sustituir el archivo o desmontar el componente.

**Verificación:** usando mocks o APIs disponibles, la secuencia visible debe ser inactivo → transcribiendo → adaptando → listo. Fuerza un error y confirma que se muestra sin romper la página.

## Fase 4 — Implementar `VideoPlayer`

1. Recibe `TranscriptResult`, el archivo o URL local cuando proceda y los segmentos.
2. Si `source === "upload"` y el tipo es vídeo, muestra `<video controls>`.
3. Si el archivo es audio, muestra `<audio controls>` y un aviso de que la transcripción está disponible en las pestañas.
4. Para vídeo local, usa `segmentsToVtt`, crea un `Blob` de tipo `text/vtt`, una URL de objeto y un `<track kind="subtitles" srclang="es" default>`.
5. Libera las URL de objetos de VTT al cambiar de contenido o desmontar.
6. Si `source === "youtube"`, renderiza un iframe seguro de `https://www.youtube.com/embed/{videoId}` con título y permisos apropiados. No intentes inyectar pistas en ese iframe.
7. En ambos modos, crea el botón para descargar el VTT con nombre `subtitulos.vtt` a partir de los segmentos.

**Verificación:** revisa los tres modos: vídeo local con pista, audio local y YouTube. Confirma que el botón descarga un archivo que empieza por `WEBVTT`. No pases a la siguiente fase hasta lograrlo.

## Fase 5 — Integración con el panel y accesibilidad

1. Renderiza `VideoPlayer` y `ResultTabs` solo con resultados completos.
2. Pasa la transcripción y adaptación reales al panel de Valeri con props tipadas.
3. Asegura etiquetas, foco visible, botones deshabilitados semánticamente y mensajes de error anunciables.
4. Prueba en orden: demo, URL de YouTube con subtítulos, audio local y vídeo local inferior a 25 MB.
5. Ejecuta `npm run lint` y `npm run build` si existen.

**Criterio de terminado:** las dos vías de entrada llevan al mismo panel de resultados; el vídeo local muestra subtítulos, el contenido YouTube se incrusta y ambos permiten descargar VTT.
