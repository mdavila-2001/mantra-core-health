/** Cuántas preguntas se recuerdan. */
export const MAX_HISTORIAL = 30;
const PREFIJO = 'alovida:reportes:asistente:historial:';

/** El historial es de QUIEN lo escribió: en un navegador compartido el siguiente no lo hereda. */
const clave = (userId: string | null): string => `${PREFIJO}${userId ?? 'anonymous'}`;
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
export function leerHistorial(userId: string | null): string[] {
  try {
    const bruto = globalThis.localStorage?.getItem(clave(userId));
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

export function guardarHistorial(userId: string | null, historial: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem(clave(userId), JSON.stringify(historial));
  } catch {
    /* sin almacenamiento: el historial queda solo en memoria */
  }
}

export function borrarHistorialGuardado(userId: string | null): void {
  try {
    globalThis.localStorage?.removeItem(clave(userId));
  } catch {
    /* nada que borrar */
  }
}

/**
 * Al cerrar sesión se olvidan los historiales de TODOS los usuarios de este
 * navegador (TX-31): una pregunta sobre reportes comerciales puede revelar qué
 * le preocupa a un directivo, y el siguiente en el equipo no debe leerla.
 */
export function olvidarHistorialesDelNavegador(): void {
  try {
    const almacen = globalThis.localStorage;
    if (almacen == null) {
      return;
    }
    const claves: string[] = [];
    for (let i = 0; i < almacen.length; i++) {
      const k = almacen.key(i);
      if (k?.startsWith(PREFIJO)) {
        claves.push(k);
      }
    }
    claves.forEach((k) => almacen.removeItem(k));
  } catch {
    /* nada que olvidar */
  }
}
