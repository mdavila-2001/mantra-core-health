/**
 * Lo que se puede contar de un error, y nada más.
 *
 * ## Por qué no se usa `span.recordException`
 *
 * La API de OpenTelemetry trae `span.recordException(error)`, que es lo que
 * casi toda la documentación recomienda. Registra `exception.stacktrace`, y una
 * traza de pila de Angular **es una fuga**: lleva valores interpolados de
 * plantillas, argumentos de funciones y, en un formulario, lo que la persona
 * escribió. Este proyecto ya lo había decidido para el reporte de errores
 * («no se registra el `stack` —puede contener valores interpolados en
 * plantillas—», `core/errors/error-reporter.ts`) y la telemetría no puede ser
 * la puerta trasera de esa misma decisión.
 *
 * En su lugar viajan dos cosas: **la clase** del error, que es lo que agrupa, y
 * **un mensaje saneado y recortado**, que es lo que orienta.
 */

export interface SanitizedError {
  /** La clase: `HttpErrorResponse`, `TypeError`, `ChunkLoadError`… */
  readonly type: string;
  /** El mensaje, con lo identificable tapado y recortado. */
  readonly message: string;
}

/** Más allá de esto, un mensaje ya no orienta: solo ocupa. */
const MAX_MESSAGE = 200;

/**
 * Lo que se tapa dentro de un mensaje, en orden de aplicación.
 *
 * La lista es corta a propósito. No pretende reconocer todo dato personal
 * posible —eso no se puede— sino cerrar las formas concretas que aparecen en
 * los mensajes de error de **este** sistema: el JWT que alguien concatena al
 * depurar, el correo que la API devuelve en un error de validación, el
 * identificador de recurso que hace único un mensaje que debería agrupar, y la
 * URL con query donde viajan los tokens de verificación.
 */
const REDACTIONS: readonly (readonly [RegExp, string])[] = [
  // JWT: tres bloques base64url separados por puntos.
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]*/g, '«token»'],
  // Correo.
  [/\b[^\s@]+@[^\s@]+\.[^\s@)\]]+/g, '«correo»'],
  // Query string entero, con su interrogante.
  [/\?[^\s)\]]*/g, ''],
  // UUID.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '«id»'],
  // Cadenas hexadecimales largas: hashes, tokens de recuperación.
  [/\b[0-9a-f]{24,}\b/gi, '«id»'],
];

/**
 * Convierte cualquier cosa lanzada en algo que se puede poner en un span.
 *
 * Acepta `unknown` porque en JavaScript se puede lanzar cualquier cosa: un
 * `throw 'texto'` y un `throw { code: 500 }` son legales y llegan acá. Es la
 * misma tolerancia que ya tenía `mensajeDe` en `error-reporter.ts`.
 */
export function sanitizeError(error: unknown): SanitizedError {
  return { type: typeOf(error), message: redact(rawMessageOf(error)) };
}

/** La clase del error, que es lo que permite agrupar en Jaeger. */
export function typeOf(error: unknown): string {
  if (error instanceof Error) {
    // `name` y no `constructor.name`: sobrevive a la minificación, que renombra
    // las clases y dejaría `error.type = "t"` en producción.
    return error.name === '' ? 'Error' : error.name;
  }
  if (error === null) return 'null';
  if (Array.isArray(error)) return 'Array';
  if (typeof error === 'object') return 'Object';
  return typeof error;
}

function rawMessageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'number' || typeof error === 'boolean') {
    return String(error);
  }
  // Un objeto suelto no se serializa: `JSON.stringify` de un error de la API
  // volcaría el cuerpo entero de la respuesta en el span.
  return 'sin mensaje';
}

/** Aplica las tapaduras y recorta. Exportada para poder probarla sola. */
export function redact(message: string): string {
  const redacted = REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    message,
  ).trim();

  return redacted.length > MAX_MESSAGE ? `${redacted.slice(0, MAX_MESSAGE)}…` : redacted;
}
