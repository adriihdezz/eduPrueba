# Plan de Adrián — API de adaptaciones educativas

## Objetivo

Implementar la API que transforma una transcripción en lectura fácil y puntos clave, mediante una única llamada estructurada a `gpt-4o-mini`.

## Alcance y archivos propios

- `app/api/adapt/route.ts`
- `lib/prompts.ts`

No modificar las rutas de ingesta ni componentes visuales. El contrato de salida es `AdaptResult` de `lib/types.ts`.

## Regla de ejecución

Trabaja **fase a fase**. Completa y verifica cada fase antes de iniciar la siguiente. No sustituyas el contrato por datos inventados ni dependas de cambios en ficheros que pertenezcan a otra persona.

## Fase 1 — Revisar contratos y preparar dependencias

1. Confirma que existe `lib/types.ts` y que exporta `AdaptResult` con `lecturaFacil: string` y `puntosClave: string[]`.
2. Comprueba que el paquete `openai` está instalado y que `OPENAI_API_KEY` se documenta como variable de entorno.
3. Determina el patrón de inicialización de OpenAI que usa el proyecto para no duplicar clientes innecesariamente.

**Verificación:** TypeScript reconoce `AdaptResult` desde una ruta temporal de comprobación o mediante el editor. Solo entonces continúa.

## Fase 2 — Diseñar el prompt aislado

1. En `lib/prompts.ts`, exporta una función o constante que construya el mensaje para `gpt-4o-mini` a partir de la transcripción.
2. Exige que la respuesta sea exclusivamente un objeto JSON con `lecturaFacil` y `puntosClave`.
3. Incluye estas reglas explícitas para `lecturaFacil`: español, frases de 10–12 palabras como máximo, una idea por frase, vocabulario común, sin subordinadas, metáforas ni ironías, definir tecnicismos imprescindibles entre paréntesis y conservar aproximadamente toda la información sin resumir.
4. Exige entre 4 y 8 puntos clave, ordenados por importancia, de frase corta y literal.
5. Incluye el texto del usuario como contenido delimitado, no como instrucciones que puedan cambiar las reglas.

**Verificación:** revisa manualmente que el prompt cubra cada requisito del PRD y que contiene el texto fuente. No avances si falta alguno.

## Fase 3 — Implementar la ruta `POST /api/adapt`

1. Crea el manejador `POST` en `app/api/adapt/route.ts`.
2. Lee y valida el JSON: debe tener `text` de tipo string y no vacío tras eliminar espacios.
3. Devuelve 400 con `{ error: string }` si el cuerpo no es JSON válido o la transcripción no es válida.
4. Llama a OpenAI con modelo `gpt-4o-mini` y modo de respuesta JSON (`json_object` o el modo estructurado compatible con la versión instalada).
5. Extrae el contenido de la respuesta y conviértelo a JSON.
6. Devuelve exclusivamente el objeto compatible con `AdaptResult` y estado 200.
7. Devuelve un error 5xx claro y seguro para fallos del proveedor.

**Verificación:** una petición con texto breve debe llegar al proveedor y devolver los dos campos esperados. No continúes hasta verificar el código de estado y el tipo de cada campo.

## Fase 4 — Validación del modelo y reintento

1. Valida después del parseo que `lecturaFacil` sea un string no vacío.
2. Valida que `puntosClave` sea un array de strings no vacíos, con entre 4 y 8 elementos.
3. Si el JSON es inválido o no cumple el contrato, repite la llamada exactamente una vez con una instrucción de corrección clara.
4. Si el segundo intento falla, devuelve un error 502/500 seguro; no devuelvas datos parcialmente válidos.
5. Protege la ruta frente a respuestas sin contenido y errores de parseo.

**Verificación:** prueba de forma controlada el validador con JSON incompleto y JSON correcto. Confirma que hay como máximo dos intentos y que no se filtran errores internos.

## Fase 5 — Prueba manual y entrega

1. Arranca el proyecto y ejecuta el `curl` del PRD con una transcripción corta en español.
2. Revisa que la lectura fácil conserve la información y que los puntos estén en español y sean entre 4 y 8.
3. Ejecuta `npm run lint` y `npm run build`, si existen.
4. Informa a la persona de interfaz de la forma exacta de la respuesta y de los mensajes de error.

**Criterio de terminado:** `POST /api/adapt` acepta una transcripción válida, devuelve una adaptación válida de forma fiable y rechaza entradas o salidas malformadas de manera controlada.
