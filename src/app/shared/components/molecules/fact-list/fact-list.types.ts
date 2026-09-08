import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/**
 * Un dato de una ficha: cómo se llama el campo y qué vale.
 *
 * ## Por qué el valor es texto y no `unknown`
 *
 * Porque quien arma la lista ya sabe cómo se escribe su dato —una fecha con su
 * formato, un importe con su moneda, un recuento con su sustantivo— y el
 * componente no puede saberlo sin conocer el dominio. Un `valor: unknown` con
 * un `| date` adentro obligaría a esta molécula a elegir el formato de fecha de
 * todo el producto.
 */
export interface Hecho {
  /** El nombre del campo: «Código», «Próxima calibración», «Sede». */
  readonly etiqueta: string;
  /**
   * Lo que vale, ya escrito.
   *
   * `null` **no se dibuja**: una fila que dice que falta un dato ocupa el mismo
   * lugar que la que lo trae, y en una ficha con veinte campos eso es veinte
   * veces el mismo aviso inútil. Quien arma la lista puede pasar `null` sin
   * filtrar antes.
   */
  readonly valor: string | null;
  /**
   * El ícono del campo, del set cerrado de la navegación.
   *
   * Opcional: una lista donde sólo la mitad de las filas lo tiene se lee peor
   * que una sin ninguno, así que o se lo ponen todas o ninguna. Lo hace cumplir
   * quien arma la lista, no el componente — no puede saber si el que falta es
   * un olvido o una decisión.
   */
  readonly icono?: NavIconName;
  /**
   * Un tono para el valor, cuando el valor **es un estado**: «Operativo»,
   * «En mantenimiento», «Vigente hasta…».
   *
   * Sin tono el valor va en el color del texto normal, que es lo correcto para
   * un código o una fecha. Pintar de verde un número de serie no dice nada.
   */
  readonly tono?: HechoTono;
}

/** Los tonos que puede tomar un valor que es un estado. */
export const HECHO_TONOS = ['ok', 'aviso', 'error', 'neutro'] as const;

export type HechoTono = (typeof HECHO_TONOS)[number];

/**
 * Cómo se reparte la lista en la pantalla.
 *
 * - `filas`: campo a la izquierda, valor a la derecha, una debajo de otra. Es
 *   la tabla de toda la vida y la que sirve para **leer un dato concreto**:
 *   los nombres quedan alineados en una columna que se recorre con la vista.
 * - `columnas`: los campos uno al lado del otro, el valor debajo de su nombre.
 *   Sirve para **comparar de un vistazo** cuatro o cinco datos cortos —un
 *   resumen de cabecera—, y se rompe en cuanto un valor es largo.
 */
export const FACT_LIST_DISPOSICIONES = ['filas', 'columnas'] as const;

export type FactListDisposicion = (typeof FACT_LIST_DISPOSICIONES)[number];
