import type { Hecho } from '../../molecules/fact-list/fact-list.types';

/**
 * Un bloque de una sección de ficha: un equipo, una sede, un estudio.
 *
 * Es «lo mismo repetido N veces» dentro de una card. Su forma es siempre la
 * misma —un nombre, a veces una nota en prosa, y su tabla campo → valor—, y por
 * eso la sección puede buscarlos, filtrarlos y paginarlos sin saber de qué son.
 */
export interface BloqueDeFicha {
  /** Identificador estable, para `@for` y para las pruebas. */
  readonly id: string;
  /** El nombre del bloque: «Analizador hematológico», «Hemograma completo». */
  readonly titulo: string;
  /**
   * Prosa libre, cuando la hay: la descripción de un estudio.
   *
   * Va antes de la tabla y no como una fila porque un párrafo dentro de una
   * celda rompe la columna de valores.
   */
  readonly nota?: string | null;
  /** Los datos del bloque. Los de valor `null` no se dibujan. */
  readonly hechos: readonly Hecho[];
  /**
   * Las etiquetas por las que este bloque se puede filtrar: «Operativo»,
   * «En mantenimiento», «Requiere orden médica».
   *
   * De la **unión** de las etiquetas de todos los bloques salen los chips, con
   * su recuento. Quien arma la sección no declara los chips: los declara el
   * contenido, así que un chip que no tiene a nadie detrás no puede existir.
   */
  readonly etiquetas?: readonly string[];
}

/**
 * Cuántos bloques entran en una página.
 *
 * Seis y no diez: es lo que llena dos filas de tres o tres de dos sin empujar
 * la sección siguiente fuera de la pantalla. Una ficha con cinco secciones de
 * diez bloques cada una es una página de scroll infinito donde la última
 * sección no la ve nadie, que es justo lo que la paginación viene a evitar.
 */
export const BLOQUES_POR_PAGINA = 6;

/**
 * A partir de cuántos bloques aparece el buscador.
 *
 * Con seis o menos se ven todos a la vez, y un buscador sobre lo que ya está
 * entero en pantalla es un control que no ahorra nada — peor, sugiere que hay
 * algo escondido. Aparece cuando de verdad hay que buscar.
 */
export const MINIMO_PARA_BUSCAR = 7;
