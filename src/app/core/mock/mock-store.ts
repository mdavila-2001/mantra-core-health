/* ============================================================================
    Ayudantes del backend simulado: identificadores estables, fechas relativas
    a «hoy», paginación por cursor y colecciones en memoria.

    Los identificadores se derivan de una semilla de texto para que sean
    **estables entre recargas** (un enlace copiado sigue abriendo lo mismo) y
    tengan pinta de uuid, que es lo que validan `ParseUUIDPipe` y los tipos.
    ========================================================================== */

/** Un uuid v4 determinístico a partir de una semilla. */
export function uuid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 * 31 + h2) >>> 0);
  const d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

let contador = 0;

/** Un id nuevo para lo que se crea durante la sesión. */
export function nuevoId(prefijo = 'nuevo'): string {
  contador += 1;
  return uuid(`${prefijo}-${Date.now()}-${contador}`);
}

/* ---- fechas ---------------------------------------------------------------- */

export function hoy(): Date {
  return new Date();
}

/** Un instante `dias` días desde ahora (negativo = pasado), a la hora dada. */
export function fecha(dias: number, hora = 9, minutos = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, minutos, 0, 0);
  return d;
}

export function iso(dias: number, hora = 9, minutos = 0): string {
  return fecha(dias, hora, minutos).toISOString();
}

/** Sólo la fecha, `YYYY-MM-DD`, `dias` días desde hoy. */
export function isoDia(dias: number): string {
  const d = fecha(dias);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function ahora(): string {
  return new Date().toISOString();
}

/** Minutos después de un instante ISO. */
export function masMinutos(instante: string, minutos: number): string {
  return new Date(new Date(instante).getTime() + minutos * 60_000).toISOString();
}

/* ---- paginación ------------------------------------------------------------ */

export interface PaginaCursor<T> {
  readonly items: readonly T[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Corta una lista por `cursor`/`limit` como lo hace la API (cursor = índice). */
export function paginar<T>(
  todos: readonly T[],
  query: URLSearchParams,
  limitePorDefecto = 20,
): PaginaCursor<T> {
  const limit = Math.max(1, Number(query.get('limit') ?? limitePorDefecto) || limitePorDefecto);
  const cursor = query.get('cursor');
  const desde = cursor === null || cursor === '' ? 0 : Math.max(0, Number(cursor) || 0);
  const items = todos.slice(desde, desde + limit);
  const siguiente = desde + limit;
  return {
    items,
    count: todos.length,
    limit,
    nextCursor: siguiente < todos.length ? String(siguiente) : null,
  };
}

/* ---- colecciones en memoria ------------------------------------------------ */

/**
 * Una tabla en memoria con clave `id`. Los cambios duran mientras dure la
 * pestaña: alcanza para probar un flujo de punta a punta sin persistir nada.
 */
export class Coleccion<T extends { readonly id: string }> {
  private readonly filas = new Map<string, T>();

  constructor(iniciales: readonly T[] = []) {
    for (const fila of iniciales) {
      this.filas.set(fila.id, fila);
    }
  }

  todos(): T[] {
    return [...this.filas.values()];
  }

  get(id: string): T | undefined {
    return this.filas.get(id);
  }

  has(id: string): boolean {
    return this.filas.has(id);
  }

  agregar(fila: T): T {
    this.filas.set(fila.id, fila);
    return fila;
  }

  actualizar(id: string, cambios: Partial<T>): T | undefined {
    const actual = this.filas.get(id);
    if (actual === undefined) return undefined;
    const siguiente = { ...actual, ...cambios };
    this.filas.set(id, siguiente);
    return siguiente;
  }

  borrar(id: string): boolean {
    return this.filas.delete(id);
  }

  filtrar(predicado: (fila: T) => boolean): T[] {
    return this.todos().filter(predicado);
  }

  get tamano(): number {
    return this.filas.size;
  }
}

/* ---- varios ---------------------------------------------------------------- */

export function elegir<T>(lista: readonly T[], indice: number): T {
  return lista[indice % lista.length]!;
}

export function texto(query: URLSearchParams, clave: string): string | null {
  const valor = query.get(clave);
  return valor === null || valor === '' ? null : valor;
}

export function contiene(haystack: string | null | undefined, needle: string | null): boolean {
  if (needle === null) return true;
  return (haystack ?? '').toLocaleLowerCase('es').includes(needle.toLocaleLowerCase('es'));
}

export function cuerpo<T extends object>(request: { readonly body: unknown }): Partial<T> {
  return (typeof request.body === 'object' && request.body !== null ? request.body : {}) as Partial<T>;
}

/** Un SVG con iniciales, para avatares y logos sin archivo real. */
export function avatarSvg(nombre: string, fondo = '#1f6f8b'): string {
  const iniciales = nombre
    .split(/\s+/)
    .filter((p) => p !== '')
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="24" fill="${fondo}"/><text x="80" y="98" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="600" fill="#fff" text-anchor="middle">${iniciales}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Una imagen de portada/publicación como SVG con un rótulo. */
export function imagenSvg(rotulo: string, fondo = '#e8f1f5', tinta = '#1f6f8b'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${fondo}"/><circle cx="820" cy="120" r="70" fill="${tinta}" opacity="0.15"/><circle cx="140" cy="440" r="110" fill="${tinta}" opacity="0.12"/><text x="480" y="285" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="600" fill="${tinta}" text-anchor="middle">${rotulo}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
