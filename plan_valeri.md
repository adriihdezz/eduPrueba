# Plan de Valeri — Panel de adaptaciones y lectura en voz alta

## Objetivo

Construir las tres pestañas que presentan transcripción, lectura fácil y puntos clave, junto con un control de síntesis de voz para el contenido activo y un estilo accesible global.

## Alcance y archivos propios

- `components/ResultTabs.tsx`
- `components/TtsButton.tsx`
- `app/globals.css`

Puede leer e importar `lib/types.ts` y `lib/mock.ts`. No modificar la página principal, el reproductor ni las rutas API.

## Regla de ejecución

Avanza **fase por fase**, con su comprobación antes de continuar. Trabaja inicialmente contra los mocks; la integración debe depender solo de props tipadas, no de detalles de implementación de la página.

## Fase 1 — Preparar tipos, props y muestra local

1. Lee `lib/types.ts` y `lib/mock.ts`.
2. Define las props de `ResultTabs` para recibir `TranscriptResult` y `AdaptResult`.
3. Diseña el estado interno de pestaña activa: `transcripcion`, `lectura-facil` o `puntos-clave`.
4. Durante el desarrollo, permite renderizar el componente con `mockTranscript` y `mockAdapt` desde una vista temporal o mediante los props de prueba disponibles.

**Verificación:** TypeScript debe impedir pasar una adaptación incompleta y el componente debe poder mostrar contenido mock. No avances hasta conseguirlo.

## Fase 2 — Implementar las pestañas semánticas

1. Crea tres controles claramente nombrados: `Transcripción`, `Lectura fácil` y `Puntos clave`.
2. Implementa un patrón accesible de pestañas: botones con `role="tab"`, `aria-selected`, `aria-controls`; panel asociado con `role="tabpanel"` e identificadores coherentes.
3. Soporta navegación con teclado: flechas entre pestañas y Enter/Espacio para activar, además de Tab normal.
4. Muestra un único panel activo sin perder los datos de los otros paneles.

**Verificación:** usa solo teclado para cambiar de pestaña y confirma con el inspector que los atributos ARIA reflejan la pestaña activa. Luego pasa a la fase 3.

## Fase 3 — Dar formato a cada adaptación

1. En `Transcripción`, muestra `transcript.text` como texto corrido, con interlineado 1.8.
2. En `Lectura fácil`, separa el contenido por saltos de línea o frases de manera que sea fácil de seguir: fuente de 17–18 px, interlineado 2 y espaciado de letras discreto.
3. En `Puntos clave`, muestra una lista ordenada de `adapt.puntosClave`.
4. Destaca visual y semánticamente el primer punto como `Lo esencial`, sin ocultar su número ni alterar el orden.
5. Preserva texto, puntuación y caracteres de los resultados del modelo; no realices transformaciones que modifiquen el significado.

**Verificación:** con los mocks, comprueba visualmente que hay tres representaciones distintas y que la lectura fácil y los puntos se escanean con facilidad. No continúes hasta que esto sea cierto.

## Fase 4 — Implementar `TtsButton`

1. Crea un componente que reciba el texto que debe leer y un identificador opcional del panel activo.
2. Comprueba que `window.speechSynthesis` y `SpeechSynthesisUtterance` existan antes de utilizarlos, para evitar fallos en SSR o navegadores no compatibles.
3. Al reproducir, crea `new SpeechSynthesisUtterance(text)` con `lang = "es-ES"` y `rate = 0.9`.
4. El botón debe alternar entre reproducir y detener; al detener, usa `speechSynthesis.cancel()`.
5. Actualiza el estado del botón al terminar, cancelar o producirse un error. Cancela la locución al cambiar de pestaña y al desmontar el componente.
6. Usa etiquetas accesibles que indiquen la acción, por ejemplo `Escuchar lectura fácil` o `Detener lectura fácil`.

**Verificación:** en navegador, inicia la voz, detenla con el mismo botón, cambia de pestaña mientras habla y confirma que se cancela. Prueba también que el render inicial no accede a `window`.

## Fase 5 — Estilo global y validación final

1. En `app/globals.css`, aplica una base limpia de alto contraste, tamaños de objetivo táctil cómodos y foco visible.
2. Evita librerías de UI y evita usar únicamente color para comunicar estado.
3. Mantén contraste suficiente entre texto, fondo, pestaña activa e inactiva; respeta `prefers-reduced-motion` si introduces transiciones.
4. Comprueba la visualización en ancho móvil y escritorio sin que se corten pestañas o botones.
5. Ejecuta `npm run lint` y `npm run build`, si existen.

**Criterio de terminado:** el panel recibe resultados reales o mocks, muestra cada adaptación de forma accesible y clara, y el contenido de cada pestaña puede escucharse en español mediante un control seguro y cancelable.
