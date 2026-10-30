/** Cuántas preguntas se recuerdan. */
export const MAX_HISTORIAL = 30;
const CLAVE = 'alovida:reportes:asistente:historial';
const MAX_CARACTERES = 300;

/** Agrega al principio, sin repetir (sin distinguir mayúsculas) y sin pasar del tope. */
export function agregarAlHistorial(historial: readonly string[], pregunta: string): string[] {
  const limpia = pregunta.trim().slice(0, MAX_CARACTERES);
  if (limpia === '') {
    return [...historial];
  }
  const clave = limpia.toLowerCase();
  return [limpia, ...historial.filter((h) => h.toLowerCase() !== clave)].slice(0, MAX_HISTORIAL);
}

/**
 * El historial vive solo en este navegador y es una comodidad: si el
 * almacenamiento está bloqueado o roto, el panel sigue funcionando sin él.
 */
export function leerHistorial(): string[] {
  try {
    const bruto = globalThis.localStorage?.getItem(CLAVE);
    if (bruto == null) {
      return [];
    }
    const datos: unknown = JSON.parse(bruto);
    return Array.isArray(datos)
      ? datos.filter((d): d is string => typeof d === 'string' && d.trim() !== '').slice(0, MAX_HISTORIAL)
      : [];
  } catch {
    return [];
  }
}

export function guardarHistorial(historial: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(CLAVE, JSON.stringify(historial));
  } catch {
    /* sin almacenamiento: el historial queda solo en memoria */
  }
}

export function borrarHistorialGuardado(): void {
  try {
    globalThis.localStorage?.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
