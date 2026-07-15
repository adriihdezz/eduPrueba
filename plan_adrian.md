# Plan de Adrián — API de adaptaciones educativas

## Objetivo

Implementar la API que transforma una transcripción en lectura fácil y puntos clave, mediante una única llamada estructurada a `gpt-4o-mini`.

## Alcance y archivos propios

- `app/api/adapt/route.ts`
- `lib/prompts.ts`

No modificar las rutas de ingesta ni componentes visuales. El contrato de salida es `AdaptResult` de `lib/types.ts`.

## Entregables y contrato que no se debe romper

| Pieza | Requisito exacto | Consumidor |
|---|---|---|
| Prompt | función o constante en `lib/prompts.ts`, sin llamadas de red | ruta API |
| API | `POST /api/adapt` recibe `{ text: string }` | `app/page.tsx` |
| Éxito | `{ lecturaFacil: string, puntosClave: string[] }` | `ResultTabs` |
| Error | `{ error: string }`, sin detalles internos | interfaz |

La ruta no debe asumir que el usuario es de confianza: la transcripción es contenido a adaptar, no instrucciones. No expone la clave, no guarda el texto, no añade base de datos y no realiza más de dos llamadas al modelo por petición.

## Preparación concreta para Codex

Antes de editar, haz que Codex inspeccione `lib/types.ts`, `package.json`, el patrón existente para rutas y `git status --short`. Pídele que limite los cambios a los dos archivos de alcance, que no cambie el modelo ni el contrato, y que ejecute `git diff --check` después de cada fase. Si hay cambios no relacionados en el árbol, no los modifiques ni los incluyas en la entrega.

## Regla de ejecución

Trabaja **fase a fase**. Completa y verifica cada fase antes de iniciar la siguiente. No sustituyas el contrato por datos inventados ni dependas de cambios en ficheros que pertenezcan a otra persona.

## Fase 1 — Revisar contratos y preparar dependencias

1. Confirma que existe `lib/types.ts` y que exporta `AdaptResult` con `lecturaFacil: string` y `puntosClave: string[]`.
2. Comprueba que el paquete `openai` está instalado y que `OPENAI_API_KEY` se documenta como variable de entorno.
3. Determina el patrón de inicialización de OpenAI que usa el proyecto para no duplicar clientes innecesariamente.
4. Confirma la versión del SDK instalada y consulta sus tipos locales para elegir la sintaxis soportada de `response_format`; no copies una sintaxis de otra versión a ciegas.
5. Decide la política de límite de entrada: para el prototipo, rechaza texto vacío y establece un límite explícito y documentado antes de llamar al modelo, para evitar costes o errores opacos. El límite debe ser coherente con el modelo instalado.

**Verificación:** TypeScript reconoce `AdaptResult` desde una ruta temporal de comprobación o mediante el editor. Solo entonces continúa.

## Fase 2 — Diseñar el prompt aislado

1. En `lib/prompts.ts`, exporta una función o constante que construya el mensaje para `gpt-4o-mini` a partir de la transcripción.
2. Exige que la respuesta sea exclusivamente un objeto JSON con `lecturaFacil` y `puntosClave`.
3. Incluye estas reglas explícitas para `lecturaFacil`: español, frases de 10–12 palabras como máximo, una idea por frase, vocabulario común, sin subordinadas, metáforas ni ironías, definir tecnicismos imprescindibles entre paréntesis y conservar aproximadamente toda la información sin resumir.
4. Exige entre 4 y 8 puntos clave, ordenados por importancia, de frase corta y literal.
5. Incluye el texto del usuario como contenido delimitado, no como instrucciones que puedan cambiar las reglas.
6. Ordena explícitamente que no invente información, no omita datos relevantes y no emita markdown, comentarios ni bloques de código fuera del JSON.
7. Indica que `lecturaFacil` debe incluir párrafos separados con `\n\n`; dentro de cada párrafo puede usar saltos de línea para una frase por línea si se decide así, pero el formato debe documentarse para Valeri.
8. Usa una instrucción del sistema para las reglas no negociables y un mensaje de usuario que contenga solo el texto delimitado.
9. Define una instrucción de reparación separada para el segundo intento: debe pedir únicamente una respuesta que satisfaga el contrato, sin volver a interpretar el texto como instrucciones.

**Ejemplo de forma, no de contenido:** `{"lecturaFacil":"Primera idea.\n\nSegunda idea.","puntosClave":["Idea clave 1", "Idea clave 2", "Idea clave 3", "Idea clave 4"]}`. No copies este ejemplo como resultado de usuario.

**Verificación:** revisa manualmente que el prompt cubra cada requisito del PRD y que contiene el texto fuente. No avances si falta alguno.

## Fase 3 — Implementar la ruta `POST /api/adapt`

1. Crea el manejador `POST` en `app/api/adapt/route.ts`.
2. Lee y valida el JSON: debe tener `text` de tipo string y no vacío tras eliminar espacios.
3. Devuelve 400 con `{ error: string }` si el cuerpo no es JSON válido o la transcripción no es válida.
4. Llama a OpenAI con modelo `gpt-4o-mini` y modo de respuesta JSON (`json_object` o el modo estructurado compatible con la versión instalada).
5. Extrae el contenido de la respuesta y conviértelo a JSON.
6. Devuelve exclusivamente el objeto compatible con `AdaptResult` y estado 200.
7. Devuelve un error 5xx claro y seguro para fallos del proveedor.
8. Trata `request.json()` dentro de un `try/catch` para distinguir JSON inválido de una caída del proveedor.
9. Recorta el texto únicamente para validar vacío; conserva el texto original para que la adaptación no pierda intencionadamente espacios o saltos de línea significativos.
10. Fija explícitamente `Content-Type: application/json` al hacer llamadas manuales de prueba y confirma que la ruta no acepta métodos no implementados.
11. Tras obtener la respuesta, comprueba que existe contenido antes de ejecutar `JSON.parse`; no presupongas que todo `200` trae JSON útil.

**Matriz mínima de respuestas:**

| Caso | Estado | Cuerpo esperado |
|---|---:|---|
| JSON malformado | 400 | `{ error: "El cuerpo debe ser JSON válido" }` |
| `text` ausente, no string o vacío | 400 | `{ error: "Debes enviar una transcripción válida" }` |
| Texto por encima del límite acordado | 400/413 | `{ error: "La transcripción es demasiado larga…" }` |
| Modelo o clave no disponible | 5xx | `{ error: "No se pudo generar la adaptación…" }` |
| Correcto | 200 | `AdaptResult` |

**Verificación:** una petición con texto breve debe llegar al proveedor y devolver los dos campos esperados. No continúes hasta verificar el código de estado y el tipo de cada campo.

## Fase 4 — Validación del modelo y reintento

1. Valida después del parseo que `lecturaFacil` sea un string no vacío.
2. Valida que `puntosClave` sea un array de strings no vacíos, con entre 4 y 8 elementos.
3. Si el JSON es inválido o no cumple el contrato, repite la llamada exactamente una vez con una instrucción de corrección clara.
4. Si el segundo intento falla, devuelve un error 502/500 seguro; no devuelvas datos parcialmente válidos.
5. Protege la ruta frente a respuestas sin contenido y errores de parseo.
6. Normaliza la salida para validación: `lecturaFacil.trim()` no puede quedar vacía; cada punto debe ser string y no vacío después de `trim()`; no aceptes claves alternativas ni arrays de objetos.
7. Conserva la causa técnica solo en logs de servidor si el proyecto los usa; el cliente recibe un mensaje estable.
8. Si implementas la corrección dentro de una misma request, marca claramente el contador de intento para que sea imposible lanzar un tercer intento por accidente.
9. No reintentes fallos de autenticación, entrada inválida o falta de clave: el reintento está reservado para salida JSON inválida o que no cumple `AdaptResult`.

**Verificación:** prueba el validador de forma controlada con: JSON incompleto, `lecturaFacil` vacía, tres puntos, nueve puntos, un punto no-string y un objeto correcto. Confirma que el correcto pasa, todos los demás activan un único reintento, y que no hay nunca un tercero ni se filtran mensajes de SDK.

## Fase 5 — Prueba manual y entrega

1. Arranca el proyecto y ejecuta el `curl` del PRD con una transcripción corta en español.
2. Revisa que la lectura fácil conserve la información y que los puntos estén en español y sean entre 4 y 8.
3. Ejecuta `npm run lint` y `npm run build`, si existen.
4. Informa a la persona de interfaz de la forma exacta de la respuesta y de los mensajes de error.
5. Prueba además JSON inválido, texto vacío, texto excesivamente largo y clave ausente (sin revelar el secreto). Anota estado y cuerpo de cada respuesta.
6. Revisa una respuesta real para comprobar: español, entre 4 y 8 puntos, lectura fácil no resumida de manera extrema y ningún texto fuera de los dos campos del contrato.

## Handoff de Adrián a Adolfo y Valeri

Entrega por escrito:

- La forma exacta de la petición y respuesta, con ejemplo anonimizado.
- El límite de texto acordado y el mensaje de error asociado.
- La convención de saltos de línea de `lecturaFacil`.
- El listado de estados HTTP que maneja la UI.
- Resultado de lint/build y cualquier comportamiento del modelo que exija una mejora posterior del prompt.

**Criterio de terminado:** `POST /api/adapt` acepta una transcripción válida, devuelve una adaptación válida de forma fiable y rechaza entradas o salidas malformadas de manera controlada.
