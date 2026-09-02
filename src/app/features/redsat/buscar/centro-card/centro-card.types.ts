/* ============================================================================
    Lo que la tarjeta de una entidad de salud necesita para dibujarse.

    Un tipo propio y no `SearchResultItem`: aquella tarjeta describe **una fila
    de directorio** —figura chica, título, dos líneas de contexto— y ésta
    describe una ficha que se hojea mirando, con portada, logo montado y una
    fila de atributos. Forzar las dos formas en un tipo daría un objeto con la
    mitad de los campos opcionales y ninguna pantalla sabría cuál de las dos
    llegó.

    Todo lo de acá sale de la API, campo por campo. La tarjeta **no inventa
    nada**: lo que la API no sirve, no se pinta. Ver los mapeadores de cada
    vertical (`facility-card.mapper.ts`, `diagnostic-card.mapper.ts`,
    `insurer-card.mapper.ts`, `medication-card.mapper.ts`).
    ========================================================================== */

import type { NavIconName } from '@shared/components/atoms/nav-icon/nav-icon.types';

/**
 * Qué dato es un atributo de la fila inferior.
 *
 * Es una unión cerrada y no un `string`: cada clave elige su ícono del set de
 * navegación, y un nombre libre terminaría en un atributo mudo. Los cuatro
 * primeros son los del directorio de centros; los seis siguientes entraron con
 * los otros tres verticales —laboratorios, aseguradoras y medicamentos—, que
 * muestran **datos distintos** en la misma posición (AC-06-4).
 */
export type CentroAttributeKey =
  | 'puntuacion'
  | 'turno'
  | 'lugar'
  | 'distancia'
  | 'estudios'
  | 'ramo'
  | 'precio'
  | 'farmacias'
  | 'receta'
  | 'grupo';

/**
 * Qué glifo del set cerrado dibuja cada clave.
 *
 * Vive acá y no en la plantilla porque es una decisión de contenido —qué dice
 * el ícono— y no de maquetado. El set es el de `NavIconName`: la regla del
 * sistema prohíbe un `<svg>` suelto cuando el glifo ya existe.
 */
export const ATTRIBUTE_ICON: Readonly<Record<CentroAttributeKey, NavIconName>> = {
  puntuacion: 'star',
  turno: 'calendar',
  lugar: 'pin',
  distancia: 'route',
  estudios: 'flask',
  ramo: 'umbrella',
  precio: 'billing',
  farmacias: 'bag',
  receta: 'clipboard',
  grupo: 'labels',
};

/** Un atributo corto de la fila inferior: calificación, turno, precio, distancia. */
export interface CentroAtributo {
  /** Cuál es, para elegir el ícono. */
  readonly clave: CentroAttributeKey;
  /** El texto ya formateado y listo para pintar. */
  readonly texto: string;
  /**
   * Lo que oye un lector de pantalla cuando el texto solo no alcanza.
   *
   * «4,6» al lado de una estrella se ve claro y se **escucha** como un número
   * suelto; esto lo dice entero.
   */
  readonly etiqueta?: string;
}

/** Una insignia sobre la portada o junto al nombre. */
export interface CentroSello {
  readonly texto: string;
  readonly tono: 'ok' | 'info' | 'aviso' | 'neutro';
}

/** Una entidad de salud, tal como la pinta la grilla. */
export interface CentroTarjeta {
  /** Clave estable de la lista. */
  readonly id: string;
  /** Nombre visible, con su sede si la tiene. */
  readonly nombre: string;
  /**
   * Ruta de la ficha, o `null` cuando la entidad **no tiene ficha**.
   *
   * Un medicamento no la tiene: el contrato público sirve cinco prefijos y
   * ninguno es de medicamento. Con `null` el nombre se pinta como texto y la
   * tarjeta no se vuelve un enlace a sí misma, que es lo que hacía antes el
   * mapeador cuando devolvía `/search/medications`.
   */
  readonly link: string | null;
  /** Qué es esta entidad, en una línea. `null` si no lo publicó. */
  readonly titular: string | null;
  /** Ciudad y calle, ya unidas en la forma en que se leen. */
  readonly donde: string | null;
  /** La portada. `null` degrada a un fondo del tema, nunca a un hueco. */
  readonly portada: string | null;
  /** El logo. `null` degrada a las iniciales. */
  readonly logo: string | null;
  /** Las iniciales, para cuando no hay logo. */
  readonly iniciales: string;
  /** Los sellos: verificado, declarado, verificación vencida. */
  readonly sellos: readonly CentroSello[];
  /** La fila de atributos de abajo. */
  readonly atributos: readonly CentroAtributo[];
}
