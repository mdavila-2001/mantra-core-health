/* ============================================================================
    Lo que la tarjeta de un centro de salud necesita para dibujarse.

    Un tipo propio y no `SearchResultItem`: aquella tarjeta describe **una fila
    de directorio** —figura chica, título, dos líneas de contexto— y ésta
    describe una ficha que se hojea mirando, con portada, logo montado y una
    fila de atributos. Forzar las dos formas en un tipo daría un objeto con la
    mitad de los campos opcionales y ninguna pantalla sabría cuál de las dos
    llegó.

    Todo lo de acá sale de `PublicSearchResult`, campo por campo. La tarjeta
    **no inventa nada**: lo que la API no sirve, no se pinta. Ver el mapper.
    ========================================================================== */

/** Un atributo corto de la fila inferior: calificación, turno, distancia. */
export interface CentroAtributo {
  /** Cuál es, para elegir el icono. */
  readonly clave: 'puntuacion' | 'turno' | 'lugar' | 'distancia';
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

/** Un centro de salud, tal como lo pinta la grilla. */
export interface CentroTarjeta {
  /** Clave estable de la lista. */
  readonly id: string;
  /** Nombre visible, con su sede si la tiene. */
  readonly nombre: string;
  /** Ruta de la ficha. */
  readonly link: string;
  /** Qué es este centro, en una línea. `null` si no lo publicó. */
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
