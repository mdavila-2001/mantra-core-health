/** Cuántas preguntas se recuerdan. */
export const MAX_HISTORIAL = 30;
const PREFIJO = 'alovida:reportes:asistente:historial:';
/** Llave de una versión previa (un solo historial para todo el navegador): también se olvida. */
const LLAVE_ANTIGUA = 'alovida:reportes:asistente:historial';

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
 * El historial vive en `sessionStorage`: solo en esta pestaña y hasta que se cierre. Una pregunta
 * libre puede nombrar a una persona («¿cuánto cobró el Dr. …?»), así que no se deja en disco
 * más tiempo del que dura el trabajo. Es una comodidad: si el almacenamiento está bloqueado o
 * roto, el panel sigue funcionando sin él.
 */
export function leerHistorial(userId: string | null): string[] {
  try {
    const bruto = globalThis.sessionStorage?.getItem(clave(userId));
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
    globalThis.sessionStorage?.setItem(clave(userId), JSON.stringify(historial));
  } catch {
    /* sin almacenamiento: el historial queda solo en memoria */
  }
}

export function borrarHistorialGuardado(userId: string | null): void {
  try {
    globalThis.sessionStorage?.removeItem(clave(userId));
  } catch {
    /* nada que borrar */
  }
}

/**
 * Al cerrar sesión se olvidan los historiales de TODOS los usuarios de este
 * navegador (TX-31): una pregunta sobre reportes comerciales puede revelar qué
 * le preocupa a un directivo, y el siguiente en el equipo no debe leerla.
 * Se limpian los dos almacenes: la versión anterior los guardaba en `localStorage`
 * y esas claves no pueden quedar vivas.
 */
export function clearBrowserHistories(): void {
  for (const almacen of [globalThis.sessionStorage, globalThis.localStorage]) {
    try {
      if (almacen == null) {
        continue;
      }
      const claves: string[] = [];
      for (let i = 0; i < almacen.length; i++) {
        const k = almacen.key(i);
        if (k === LLAVE_ANTIGUA || k?.startsWith(PREFIJO)) {
          claves.push(k);
        }
      }
      claves.forEach((k) => almacen.removeItem(k));
    } catch {
      /* nada que olvidar */
    }
  }
}
