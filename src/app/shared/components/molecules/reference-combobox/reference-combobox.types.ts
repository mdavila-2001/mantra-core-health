/* ============================================================================
    Contratos del Reference combobox — sistema REDSAT v1.0.

    Extensión propia. El spec no declara un buscador de referencia; las fichas
    de vistas del vault sí lo piden ocho veces sólo en V05 («autocompletar sobre
    la entidad referenciada: muestra nombre, guarda uuid»), y hasta ahora cada
    pantalla lo habría compuesto a mano. Pendiente de validación del diseñador.
    ========================================================================== */

/**
 * Una opción del buscador.
 *
 * Separa lo que se **guarda** de lo que se **ve**, que es la razón de ser de la
 * pieza: el modelo referencia entidades por uuid y ningún formulario debería
 * pedirle a una persona que escriba uno.
 */
export interface ReferenceOption {
  /** Identificador que se persiste. Es lo que sale por `value`. */
  readonly value: string;
  /** Texto que se pinta y sobre el que se lee la opción. */
  readonly label: string;
  /**
   * Segunda línea, para desambiguar homónimos (un documento, una especialidad,
   * una sucursal). Se anuncia junto al rótulo.
   */
  readonly hint?: string;
  /** La opción se muestra pero no se puede elegir. */
  readonly disabled?: boolean;
}

/**
 * Espera antes de avisar que hay que buscar. Es la misma que usa
 * `app-search-field`: dos campos de búsqueda del mismo sistema que reaccionan a
 * ritmos distintos se sienten como dos productos.
 */
export const REFERENCE_COMBOBOX_DEBOUNCE_MS = 300;

/**
 * Cuántos caracteres hacen falta antes de consultar, por defecto.
 *
 * Uno, y no cero: un combobox de referencia busca sobre catálogos que pueden
 * tener millones de filas, y disparar la consulta con el campo vacío pediría
 * «tráeme todo» cada vez que alguien pone el foco. Quien tenga un catálogo
 * corto puede bajarlo a cero y ofrecer la lista completa al abrir.
 */
export const REFERENCE_COMBOBOX_MIN_QUERY_LENGTH = 1;
