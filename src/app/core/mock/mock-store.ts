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
 * Una tabla en memoria con clave `id`.
 *
 * ## Por qué algunas sobreviven a un `F5` y otras no
 *
 * Por defecto los cambios duran mientras dure la **página**: alcanza para
 * recorrer un flujo de punta a punta. Pero eso deja fuera la única comprobación
 * que hace que «guardado» signifique algo —guardar, recargar, seguir ahí—, y
 * sin ella un formulario que traga el dato y otro que lo guarda se ven igual.
 *
 * Pasando una `clave` la tabla se guarda en `sessionStorage` y se recupera al
 * arrancar, así que la persistencia se puede comprobar de verdad. Es opcional y
 * no automático a propósito: los catálogos y los fixtures de lectura no ganan
 * nada con sobrevivir, y guardarlos todos llenaría el almacenamiento de la
 * pestaña con datos que nadie modifica.
 *
 * `sessionStorage` y no `localStorage`: la maqueta se cierra y se vuelve a
 * abrir limpia, que es lo que espera quien la usa para mostrar el producto.
 */
export class Coleccion<T extends { readonly id: string }> {
  private readonly filas = new Map<string, T>();

  /** Dónde se guarda, o `null` si esta tabla no sobrevive a la recarga. */
  private readonly clave: string | null;

  constructor(iniciales: readonly T[] = [], clave?: string) {
    this.clave = clave ?? null;
    const guardadas = this.leerGuardadas();
    // Lo guardado gana sobre los valores iniciales: si no, recargar volvería a
    // pisar con el fixture justo lo que la persona acaba de escribir.
    for (const fila of guardadas ?? iniciales) {
      this.filas.set(fila.id, fila);
    }
  }

  /**
   * Lo que quedó de una visita anterior, o `null` si no hay o no se puede leer.
   *
   * Tolerante a propósito: el almacenamiento puede estar bloqueado —modo
   * privado, política del navegador— o traer basura de una versión anterior de
   * la maqueta. En cualquiera de los dos casos se arranca de los fixtures, que
   * es peor que persistir pero mucho mejor que una pantalla rota.
   */
  private leerGuardadas(): readonly T[] | null {
    if (this.clave === null || typeof sessionStorage === 'undefined') {
      return null;
    }
    try {
      const crudo = sessionStorage.getItem(this.clave);
      if (crudo === null) return null;
      const filas: unknown = JSON.parse(crudo);
      return Array.isArray(filas) ? (filas as T[]) : null;
    } catch {
      return null;
    }
  }

  /** Vuelca la tabla. Silencioso ante fallo: el simulador nunca rompe la app. */
  private guardar(): void {
    if (this.clave === null || typeof sessionStorage === 'undefined') {
      return;
    }
    try {
      sessionStorage.setItem(this.clave, JSON.stringify(this.todos()));
    } catch {
      // Cuota llena o almacenamiento bloqueado: se sigue en memoria.
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
    this.guardar();
    return fila;
  }

  actualizar(id: string, cambios: Partial<T>): T | undefined {
    const actual = this.filas.get(id);
    if (actual === undefined) return undefined;
    const siguiente = { ...actual, ...cambios };
    this.filas.set(id, siguiente);
    this.guardar();
    return siguiente;
  }

  borrar(id: string): boolean {
    const borrada = this.filas.delete(id);
    if (borrada) {
      this.guardar();
    }
    return borrada;
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

/**
 * La portada de una ficha pública: una banda de marca, sin texto.
 *
 * Aparte de `imagenSvg` a propósito. Aquélla dibuja un rótulo en el centro, que
 * está bien para una publicación o un adjunto —hay que saber qué se está
 * mirando— y está mal para la portada de una organización: el nombre ya va
 * debajo, en el `<h1>`, así que la ficha terminaba diciéndolo dos veces. Una
 * portada institucional no dice quién es; el logo y el título lo dicen.
 *
 * Proporción 4:1 como cualquier banner de red profesional: la ficha la recorta
 * a una banda, y una imagen cuadrada recortada así se queda sin sus dos tercios
 * interesantes.
 */
export function portadaSvg(color = '#0B557E'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1584" height="396" viewBox="0 0 1584 396">` +
    `<defs>` +
    // La trama fina es lo que separa una portada de una franja de color.
    `<pattern id="t" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">` +
    `<line x1="0" y1="0" x2="0" y2="24" stroke="#fff" stroke-opacity="0.08" stroke-width="1"/>` +
    `</pattern>` +
    // La profundidad se hace con negro y blanco translúcidos SOBRE el color de
    // la organización, no con tonos calculados: así cualquier color entra sin
    // que haya que darle una paleta propia.
    `<linearGradient id="s" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.45"/>` +
    `<stop offset="0.6" stop-color="#000" stop-opacity="0.05"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0.12"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="1584" height="396" fill="${color}"/>` +
    `<rect width="1584" height="396" fill="url(#s)"/>` +
    `<rect width="1584" height="396" fill="url(#t)"/>` +
    `<circle cx="1290" cy="70" r="230" fill="#fff" opacity="0.06"/>` +
    `<circle cx="230" cy="380" r="270" fill="#fff" opacity="0.05"/>` +
    `</svg>`;
  // Los paréntesis van codificados a mano: `encodeURIComponent` los deja pasar,
  // y esta imagen se consume desde `background-image: url(…)`, donde el primer
  // `)` del `url(#s)` de adentro CIERRA la función y deja la portada en blanco.
  // Las demás imágenes de la maqueta no llevan paréntesis: por eso el problema
  // aparece con ésta y con ninguna anterior.
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg).replace(/\(/g, '%28').replace(/\)/g, '%29')}`;
}
/** Una imagen de portada/publicación como SVG con un rótulo. */
/**
 * Un **QR de maqueta**: la trama de un código, sin código adentro.
 *
 * No codifica nada y no se puede escanear — a propósito. Lo que esta pantalla
 * tiene que poder mostrar es «acá va la imagen que el profesional subió», y el
 * rótulo centrado de {@link imagenSvg} no sirve: un rectángulo con texto no se
 * lee como un QR, así que no deja ver si el modal lo encuadra, lo recorta o lo
 * estira. La trama sí.
 *
 * Determinista por `semilla`: la misma sede dibuja siempre el mismo patrón, y
 * dos sedes distintas dibujan patrones distintos. Sin eso, cambiar de
 * consultorio no se notaría en pantalla.
 *
 * @param semilla - Texto del que sale el patrón, normalmente el id de la sede.
 * @param rotulo - Qué cuenta/banco representa, bajo la trama.
 */
export function qrSvg(semilla: string, rotulo = 'QR bancario'): string {
  const MODULOS = 25;
  const LADO = 12;
  const MARGEN = 24;
  const medida = MODULOS * LADO + MARGEN * 2;

  // Congruencia lineal: barata, determinista y suficiente para una trama.
  let estado = 2166136261;
  for (const caracter of semilla) {
    estado = Math.imul(estado ^ caracter.charCodeAt(0), 16777619) >>> 0;
  }
  const siguiente = (): number => {
    estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0;
    return estado / 4294967296;
  };

  /** Las tres esquinas de posición: sin ellas la trama no se lee como un QR. */
  const esEsquina = (fila: number, columna: number): boolean =>
    (fila < 7 && columna < 7) ||
    (fila < 7 && columna >= MODULOS - 7) ||
    (fila >= MODULOS - 7 && columna < 7);

  let trama = '';
  for (let fila = 0; fila < MODULOS; fila += 1) {
    for (let columna = 0; columna < MODULOS; columna += 1) {
      if (esEsquina(fila, columna) || siguiente() <= 0.55) continue;
      trama += `<rect x="${MARGEN + columna * LADO}" y="${MARGEN + fila * LADO}" width="${LADO}" height="${LADO}"/>`;
    }
  }

  const ojo = (fila: number, columna: number): string => {
    const x = MARGEN + columna * LADO;
    const y = MARGEN + fila * LADO;
    return (
      `<rect x="${x}" y="${y}" width="${LADO * 7}" height="${LADO * 7}" fill="none" stroke="#0f172a" stroke-width="${LADO}"/>` +
      `<rect x="${x + LADO * 2}" y="${y + LADO * 2}" width="${LADO * 3}" height="${LADO * 3}"/>`
    );
  };

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${medida}" height="${medida + 56}" viewBox="0 0 ${medida} ${medida + 56}">` +
    `<rect width="${medida}" height="${medida + 56}" fill="#ffffff"/>` +
    `<g fill="#0f172a">${trama}${ojo(0, 0)}${ojo(0, MODULOS - 7)}${ojo(MODULOS - 7, 0)}</g>` +
    `<text x="${medida / 2}" y="${medida + 34}" font-family="Inter, Arial, sans-serif" font-size="22" fill="#334155" text-anchor="middle">${rotulo}</text>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function imagenSvg(rotulo: string, fondo = '#e8f1f5', tinta = '#1f6f8b'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><rect width="960" height="540" fill="${fondo}"/><circle cx="820" cy="120" r="70" fill="${tinta}" opacity="0.15"/><circle cx="140" cy="440" r="110" fill="${tinta}" opacity="0.12"/><text x="480" y="285" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="600" fill="${tinta}" text-anchor="middle">${rotulo}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
