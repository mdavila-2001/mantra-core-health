/* ============================================================================
    Contratos de la tabla de registros históricos.

    Una tabla **acotada y editable**: la persona ve todas sus entradas de un
    registro que se acumula en el tiempo (medicaciones, alergias, cirugías…),
    las filtra por columna, y agrega, corrige o borra una a una. Cada cambio
    pide confirmación y avisa al terminar.

    Va sobre `app-pagination` (paginado por número, no por cursor) porque el
    conjunto es corto y se conoce el total; `app-data-table` es para listados
    del servidor con cursor.
    ========================================================================== */

export const HISTORICAL_FIELD_TYPES = ['text', 'number', 'date', 'select', 'textarea'] as const;
export type HistoricalFieldType = (typeof HISTORICAL_FIELD_TYPES)[number];

export interface HistoricalFieldOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Una columna es también un campo del formulario: la tabla y el modal
 * muestran **los mismos campos**, que es la regla de esta pantalla.
 */
export interface HistoricalColumn {
  readonly key: string;
  readonly header: string;
  readonly type?: HistoricalFieldType;
  readonly required?: boolean;
  /** Sólo para `select`. */
  readonly options?: readonly HistoricalFieldOption[];
  /** `false` quita el filtro de esa columna. Por defecto se filtra. */
  readonly filterable?: boolean;
  readonly placeholder?: string;
}

/** Una fila: un identificador y los valores por clave de columna. */
export interface HistoricalRecord {
  readonly id: string;
  readonly [key: string]: string | number | null | undefined;
}

export const HISTORICAL_RECORD_MODES = ['create', 'edit'] as const;
export type HistoricalRecordMode = (typeof HISTORICAL_RECORD_MODES)[number];

/**
 * Persistencia opcional. Si el padre no la da, la tabla muta su propia
 * lista y emite `rowsChange`; si la da, espera la promesa y sólo entonces
 * aplica el cambio y avisa. Un rechazo se muestra como toast de error y
 * la fila queda como estaba.
 */
export interface HistoricalRecordPersistence<Row extends HistoricalRecord> {
  readonly create?: (draft: Omit<Row, 'id'>) => Promise<Row>;
  readonly update?: (row: Row) => Promise<Row>;
  readonly remove?: (row: Row) => Promise<void>;
}

export const HISTORICAL_CONFIRM_MESSAGE = '¿Estás seguro de aplicar estos cambios?';

export const HISTORICAL_DEFAULT_PAGE_SIZE = 10;
