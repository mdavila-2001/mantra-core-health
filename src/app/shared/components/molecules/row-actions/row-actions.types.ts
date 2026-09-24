import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/**
 * Una acción de una fila.
 *
 * ## Por qué van por datos y no por proyección
 *
 * La misma razón que ya escribió `PageHeaderAction`: con dos o menos se
 * dibujan como botones en la fila y con más van dentro de un desplegable, y
 * **el mismo nodo no puede vivir en los dos lugares**. Los datos sí.
 *
 * ## Por qué el ícono es un `NavIconName` y no un SVG suelto
 *
 * Porque el set de íconos de trazo del sistema ya existe
 * (`atoms/nav-icon/nav-icon.types.ts`) y es cerrado a propósito: su propio
 * comentario dice que un string libre «terminaría en nombres que no existen y
 * en íconos mudos». Abrir acá una segunda puerta para íconos daría dos sets
 * que se desincronizan.
 *
 * Es **obligatorio** desde el 2026-09-24. Era opcional porque el set no
 * cubría ver, aceptar ni completar, y el resultado fue un desplegable donde la
 * mitad de las opciones tenía dibujo y la otra mitad no: se leía como dos
 * clases de cosa. El propietario pidió que toda opción lleve ícono; el set se
 * amplió y el tipo lo exige para que no vuelva a pasar.
 */
export interface RowAction {
  /** Código estable que identifica la acción al emitirse. */
  readonly code: string;

  /** Lo que se lee en pantalla. Nunca vacío: el texto es el punto. */
  readonly label: string;

  /** Del set cerrado del sistema. Va siempre, junto al texto. */
  readonly icon: NavIconName;

  readonly disabled?: boolean;

  /** Acción que borra o anula: tinta de error, en la fila y en el menú. */
  readonly destructive?: boolean;
}

/**
 * Cuántas acciones caben en la fila antes de mandarlas al desplegable.
 *
 * Sale de la decisión del 2026-09-13 que ADR-0012 conserva: con texto, cinco
 * botones hacían crecer la fila a tres renglones. Dos entran; tres ya no.
 */
export const ROW_ACTIONS_INLINE_MAX = 2;
