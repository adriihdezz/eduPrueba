# Plan de Luisa — Panel de adaptaciones y lectura en voz alta

## Objetivo

Construir las tres pestañas que presentan transcripción, lectura fácil y puntos clave, junto con un control de síntesis de voz para el contenido activo y un estilo accesible global.

## Alcance y archivos propios

- `components/ResultTabs.tsx`
- `components/TtsButton.tsx`
- `app/globals.css`

Puede leer e importar `lib/types.ts` y `lib/mock.ts`. No modificar la página principal, el reproductor ni las rutas API.

## Entregables y contrato de integración

| Pieza | Responsabilidad | Entrada |
|---|---|---|
| `ResultTabs` | tres vistas accesibles, una activa y un TTS por contenido | `TranscriptResult` + `AdaptResult` |
| `TtsButton` | iniciar, detener, limpiar y anunciar síntesis de voz | texto y etiqueta contextual |
| CSS global | contraste, foco, tamaño y respuesta móvil | elementos de toda la app |

La interfaz no debe modificar ni resumir los datos que recibe. No usa APIs de OpenAI ni toca `window` durante renderizado de servidor. `speechSynthesis` es una mejora progresiva: si no existe, el resto del panel sigue siendo usable.

## Preparación concreta para Codex

Antes de editar, pide a Codex que lea los tipos, los mocks, los estilos existentes y las props usadas desde `app/page.tsx`. Confirma si el proyecto usa CSS global, CSS modules o Tailwind; mantén la convención ya presente. Pide que edite solo los tres archivos de alcance, aplique parches pequeños, ejecute `git diff --check` por fase y no “arregle” estilos ajenos fuera del alcance.

## Regla de ejecución

Avanza **fase por fase**, con su comprobación antes de continuar. Trabaja inicialmente contra los mocks; la integración debe depender solo de props tipadas, no de detalles de implementación de la página.

## Fase 1 — Preparar tipos, props y muestra local

1. Lee `lib/types.ts` y `lib/mock.ts`.
2. Define las props de `ResultTabs` para recibir `TranscriptResult` y `AdaptResult`.
3. Diseña el estado interno de pestaña activa: `transcripcion`, `lectura-facil` o `puntos-clave`.
4. Durante el desarrollo, permite renderizar el componente con `mockTranscript` y `mockAdapt` desde una vista temporal o mediante los props de prueba disponibles.
5. Define un identificador estable por instancia de pestañas (por ejemplo mediante `useId`) para que `aria-controls` y `aria-labelledby` no choquen si el componente se renderiza más de una vez.
6. Define el contenido de voz por pestaña: transcripción = `transcript.text`; lectura fácil = `adapt.lecturaFacil`; puntos = `adapt.puntosClave` unidos con numeración verbal o pausas claras.
7. Aclara en las props si pueden llegar datos vacíos; el contrato normal no debe permitirlo, pero el componente debe mostrar un estado seguro y no lanzar excepción si ocurre.

**Verificación:** TypeScript debe impedir pasar una adaptación incompleta y el componente debe poder mostrar contenido mock. No avances hasta conseguirlo.

## Fase 2 — Implementar las pestañas semánticas

1. Crea tres controles claramente nombrados: `Transcripción`, `Lectura fácil` y `Puntos clave`.
2. Implementa un patrón accesible de pestañas: botones con `role="tab"`, `aria-selected`, `aria-controls`; panel asociado con `role="tabpanel"` e identificadores coherentes.
3. Soporta navegación con teclado: flechas entre pestañas y Enter/Espacio para activar, además de Tab normal.
4. Muestra un único panel activo sin perder los datos de los otros paneles.
5. Implementa la navegación de flechas con orden circular y conserva el foco en el botón de pestaña recién seleccionado. No captures teclas que no sean flechas, Home/End, Enter o espacio.
6. Soporta `Home` para la primera pestaña y `End` para la última; activa al recibir foco si eliges activación automática, o exige Enter/Espacio si eliges manual. Documenta y aplica una sola estrategia.
7. No escondas el contenido activo solo con estilos visuales: los paneles inactivos deben quedar fuera de la navegación y del árbol accesible con `hidden` o equivalente correcto.

**Verificación:** usa solo teclado para recorrer Tab, flechas, Home, End, Enter y espacio. Confirma con el inspector: una sola pestaña tiene `aria-selected="true"`, cada pestaña apunta a un panel existente, el panel activo apunta de vuelta a su pestaña y paneles inactivos no reciben foco. Luego pasa a la fase 3.

## Fase 3 — Dar formato a cada adaptación

1. En `Transcripción`, muestra `transcript.text` como texto corrido, con interlineado 1.8.
2. En `Lectura fácil`, separa el contenido por saltos de línea o frases de manera que sea fácil de seguir: fuente de 17–18 px, interlineado 2 y espaciado de letras discreto.
3. En `Puntos clave`, muestra una lista ordenada de `adapt.puntosClave`.
4. Destaca visual y semánticamente el primer punto como `Lo esencial`, sin ocultar su número ni alterar el orden.
5. Preserva texto, puntuación y caracteres de los resultados del modelo; no realices transformaciones que modifiquen el significado.
6. Para lectura fácil, respeta primero los dobles saltos de línea que entregue la API. Dentro de cada bloque, conserva saltos simples o conviértelos en líneas visuales sin crear un único bloque ilegible.
7. Usa elementos semánticos: encabezado de sección, párrafos y `<ol><li>` para puntos. El distintivo `Lo esencial` puede ser texto visible adicional dentro del primer `li`, no una sustitución del contenido.
8. No uses `dangerouslySetInnerHTML`: las adaptaciones son texto, no markup confiable.
9. Define un mensaje neutro de ausencia de contenido para proteger la UI ante datos inesperados, aunque la API normal lo valide.

**Verificación:** con los mocks, comprueba visualmente que hay tres representaciones distintas. Prueba además texto con acentos, signos, dos párrafos y más de cuatro puntos; confirma que no se interpreta como HTML, que el primer punto mantiene el número 1 y que la lectura fácil conserva sus divisiones. No continúes hasta que esto sea cierto.

## Fase 4 — Implementar `TtsButton`

1. Crea un componente que reciba el texto que debe leer y un identificador opcional del panel activo.
2. Comprueba que `window.speechSynthesis` y `SpeechSynthesisUtterance` existan antes de utilizarlos, para evitar fallos en SSR o navegadores no compatibles.
3. Al reproducir, crea `new SpeechSynthesisUtterance(text)` con `lang = "es-ES"` y `rate = 0.9`.
4. El botón debe alternar entre reproducir y detener; al detener, usa `speechSynthesis.cancel()`.
5. Actualiza el estado del botón al terminar, cancelar o producirse un error. Cancela la locución al cambiar de pestaña y al desmontar el componente.
6. Usa etiquetas accesibles que indiquen la acción, por ejemplo `Escuchar lectura fácil` o `Detener lectura fácil`.
7. Antes de empezar una nueva locución, llama a `cancel()` para detener cualquier locución anterior de otra pestaña o instancia. No uses `pause()` como si fuera una cancelación definitiva.
8. Usa una referencia para saber qué `SpeechSynthesisUtterance` pertenece al botón actual; ignora callbacks tardíos de una locución ya cancelada para que no cambien el estado de un botón nuevo.
9. No marques “reproduciendo” hasta que se haya creado correctamente la utterance; maneja `onend` y `onerror` devolviendo el botón a estado inactivo.
10. Si no existe soporte, muestra el botón deshabilitado o un mensaje corto `La lectura en voz alta no está disponible en este navegador`; no lances error ni escondas las pestañas.
11. Cancela la voz al recibir nuevo texto, al cambiar la pestaña activa y en la limpieza de `useEffect` al desmontar.

**Estados que debe tener el botón:**

| Estado | Etiqueta / acción | Resultado |
|---|---|---|
| disponible | `Escuchar …` | inicia una única locución |
| hablando | `Detener …` | cancela y vuelve a disponible |
| no soportado | aviso o botón deshabilitado | no intenta acceder a la API |
| error | `Volver a intentar escuchar …` | permite nuevo intento |

**Verificación:** en navegador, inicia la voz, detenla con el mismo botón, inicia una segunda antes de que termine, cambia de pestaña mientras habla, desmonta el panel y vuelve a montarlo. Confirma que nunca hay dos voces a la vez, que el botón siempre vuelve a disponible y que el render inicial no accede a `window`. Si es posible, prueba un navegador sin soporte o simula la ausencia de la API.

## Fase 5 — Estilo global y validación final

1. En `app/globals.css`, aplica una base limpia de alto contraste, tamaños de objetivo táctil cómodos y foco visible.
2. Evita librerías de UI y evita usar únicamente color para comunicar estado.
3. Mantén contraste suficiente entre texto, fondo, pestaña activa e inactiva; respeta `prefers-reduced-motion` si introduces transiciones.
4. Comprueba la visualización en ancho móvil y escritorio sin que se corten pestañas o botones.
5. Ejecuta `npm run lint` y `npm run build`, si existen.
6. Comprueba contraste de texto normal, botones, foco, pestaña activa, error y contenido destacado con una herramienta de contraste o revisión equivalente. Los mensajes no pueden depender solo de color.
7. Asegura un objetivo táctil aproximado de 44×44 px para los controles principales y espacio suficiente entre ellos.
8. Asegura que el CSS no impide el zoom del navegador, no fija alturas que corten transcripciones largas y no elimina el contorno de foco sin reemplazo.

## Handoff de Valeri a Adolfo

Antes de declarar la parte terminada, entrega:

- La firma final de props de `ResultTabs` y ejemplo de uso con los mocks.
- La convención usada para separar `lecturaFacil` y construir el texto de TTS de puntos clave.
- Las condiciones en que TTS se deshabilita o cancela.
- Resultado de pruebas de teclado, responsive, contraste y navegador.
- Resultado de lint/build y cualquier dependencia de CSS que Adolfo deba respetar al componer la página.

**Criterio de terminado:** el panel recibe resultados reales o mocks, muestra cada adaptación de forma accesible y clara, y el contenido de cada pestaña puede escucharse en español mediante un control seguro y cancelable.
